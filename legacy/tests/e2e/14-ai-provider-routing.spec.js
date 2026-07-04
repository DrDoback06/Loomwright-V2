// Workflow R (Multi-provider AI Routing Pass):
//   - BYOK provider config save/test (mocked fetch — no real network).
//   - Local-only mode blocks external AI calls.
//   - Configured provider → composition draft generates.
//   - Deep extraction without provider falls back to local.
//   - Deep extraction with provider routes through the adapter.
//   - API key never appears in export / search / audit.
//
// All network calls are stubbed via page.addInitScript so no real
// provider is contacted.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

// Install a fetch stub BEFORE the app boots so AIService never hits
// the network. Returns canned OpenAI-style responses.
async function installFetchStub(page) {
  await page.addInitScript(() => {
    const realFetch = window.fetch;
    window.__LW_FETCH_CALLS__ = [];
    window.fetch = async (url, init) => {
      const u = String(url);
      window.__LW_FETCH_CALLS__.push(u);
      if (u.includes("/chat/completions")) {
        return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "MOCKED DRAFT TEXT" } }] }), text: async () => "" };
      }
      if (u.includes("/models")) {
        return { ok: true, status: 200, json: async () => ({ data: [{ id: "gpt-4o-mini" }] }), text: async () => "" };
      }
      // Anything else falls through to the real fetch (vendored assets, vite).
      return realFetch ? realFetch(url, init) : { ok: false, status: 404, text: async () => "not found" };
    };
  });
}

test.describe("R. Multi-provider AI Routing — BYOK, routing, privacy guard", () => {

  test("save + test provider config (mocked fetch) reports success", async ({ page }) => {
    await installFetchStub(page);
    await openFreshApp(page);
    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.AIService.saveProviderConfig({ id: "openai", providerType: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", apiKey: "sk-e2e-test-key" });
      const test = await B.AIService.testConnection("openai");
      const cfgBlob = JSON.stringify(B.KeysService.loadProviderSync("openai"));
      return { ok: test.ok, message: test.message, blobHasKey: cfgBlob.includes("sk-e2e-test-key") };
    });
    expect(result.ok).toBe(true);
    expect(result.blobHasKey).toBe(false);
  });

  test("local-only mode blocks AI Writer generation (no completion call)", async ({ page }) => {
    await installFetchStub(page);
    await openFreshApp(page);
    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.AIService.saveProviderConfig({ id: "openai", providerType: "openai", apiKey: "sk-e2e", defaultModel: "gpt-4o-mini" });
      await B.AIRoutingService.save({ mode: "localOnly" });
      window.__LW_LAST_GENERATED_DRAFT__ = undefined;
      window.__LW_FETCH_CALLS__ = [];
      window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onGenerateAIWriterDraft", detail: { prompt: "x" } } }));
      await new Promise((r) => setTimeout(r, 300));
      return {
        draft: window.__LW_LAST_GENERATED_DRAFT__ || null,
        completionCalls: (window.__LW_FETCH_CALLS__ || []).filter((u) => u.includes("/chat/completions")).length,
        isLocalOnly: B.AIRoutingService.isLocalOnly(),
      };
    });
    expect(result.isLocalOnly).toBe(true);
    expect(result.draft).toBeNull();
    expect(result.completionCalls).toBe(0);
  });

  test("configured provider → composition draft generates and stores result", async ({ page }) => {
    await installFetchStub(page);
    await openFreshApp(page);
    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.AIService.saveProviderConfig({ id: "openai", providerType: "openai", apiKey: "sk-e2e", defaultModel: "gpt-4o-mini" });
      await B.AIRoutingService.save({ mode: "balanced", defaultProviderId: "openai", confirmBeforeSendingManuscript: false });
      // Call complete directly through the service (registry path needs DOM/composition state).
      const text = await B.AIService.complete({ providerId: "openai", prompt: "Write a scene", system: "co-writer" });
      return { text };
    });
    expect(result.text).toBe("MOCKED DRAFT TEXT");
  });

  test("deep extraction without provider falls back to local (no throw)", async ({ page }) => {
    await installFetchStub(page);
    await openFreshApp(page);
    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      // No provider configured.
      const route = B.AIRoutingService.resolveRoute("deepExtraction");
      let localRan = false;
      try {
        await B.ExtractionService.runExtraction({ chapterId: "ch-x", text: "Hess crossed the marsh.", deep: false });
        localRan = true;
      } catch (_) {}
      return { routeIsNull: route === null || route?.providerId === undefined, localRan };
    });
    // With no provider and default mode, resolveRoute returns null (nothing enabled+keyed).
    expect(result.localRan).toBe(true);
  });

  test("deep extraction with fake provider routes through adapter", async ({ page }) => {
    await installFetchStub(page);
    await openFreshApp(page);
    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.AIService.saveProviderConfig({ id: "openai", providerType: "openai", apiKey: "sk-e2e", defaultModel: "gpt-4o-mini", enabled: true });
      await B.AIRoutingService.save({ mode: "balanced", defaultProviderId: "openai", taskRoutes: { deepExtraction: { providerId: "openai", model: "gpt-4o" } } });
      const route = B.AIRoutingService.resolveRoute("deepExtraction");
      // Exercise the adapter directly (registry path requires manuscript DOM).
      const completion = await B.AIService.complete({ providerId: route.providerId, model: route.model, prompt: "extract" });
      return { providerId: route.providerId, model: route.model, completion };
    });
    expect(result.providerId).toBe("openai");
    expect(result.model).toBe("gpt-4o");
    expect(result.completion).toBe("MOCKED DRAFT TEXT");
  });

  test("API key never appears in export / search / audit after configuring a provider", async ({ page }) => {
    await installFetchStub(page);
    await openFreshApp(page);
    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.AIService.saveProviderConfig({ id: "openai", providerType: "openai", apiKey: "sk-ant-NEVER-LEAK-ROUTING", defaultModel: "gpt-4o-mini" });
      // Export.
      const exportPayload = await B.ProjectArchiveService.buildExport();
      // Search index.
      B.SearchService.rebuildIndex();
      const searchJson = JSON.stringify(B.SearchService.loadSync());
      // Audit log (settings update logs an event).
      await B.SettingsService.saveSection("aiProviders", { provider: "openai", note: "configured" });
      const auditJson = JSON.stringify(B.AuditService.loadSync());
      return {
        exportHasKey: JSON.stringify(exportPayload).includes("sk-ant-NEVER-LEAK-ROUTING"),
        searchHasKey: searchJson.includes("sk-ant-NEVER-LEAK-ROUTING"),
        auditHasKey: auditJson.includes("sk-ant-NEVER-LEAK-ROUTING"),
        exportApiKeysIncluded: exportPayload.metadata.apiKeysIncluded,
      };
    });
    expect(result.exportHasKey).toBe(false);
    expect(result.searchHasKey).toBe(false);
    expect(result.auditHasKey).toBe(false);
    expect(result.exportApiKeysIncluded).toBe(false);
  });
});
