// Workflow T42: AI fidelity — the style/voice/avoid signal actually
// reaches the provider request, and the no-provider path is a useful
// local brief instead of a dead end. All provider traffic is stubbed
// (zero real tokens).

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

// Fetch stub that records request BODIES so prompt fidelity is assertable.
async function installRecordingFetchStub(page) {
  await page.addInitScript(() => {
    const realFetch = window.fetch;
    window.__LW_FETCH_CALLS__ = [];
    window.fetch = async (url, init) => {
      const u = String(url);
      if (u.includes("api.openai.com") || u.includes("/chat/completions") || u.includes("anthropic.com") || u.includes("googleapis.com")) {
        window.__LW_FETCH_CALLS__.push({ url: u, body: init && init.body ? String(init.body) : "" });
        if (u.includes("anthropic.com")) {
          return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "MOCKED ANTHROPIC DRAFT" }] }), text: async () => "" };
        }
        if (u.includes("googleapis.com")) {
          return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "MOCKED GEMINI DRAFT" }] } }] }), text: async () => "" };
        }
        return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "MOCKED STYLED DRAFT" } }] }), text: async () => "" };
      }
      return realFetch ? realFetch(url, init) : { ok: false, status: 404, text: async () => "not found" };
    };
  });
}

async function seedStyleIntel(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    await B.ProjectIntelService.save({
      writingStyleGuide: "Narrator tone: dry, wintry\nSignature: short declaratives, weather as mood\nAvoid: purple prose, em-dash chains",
      toneKeywords: ["dry", "wintry", "patient"],
      pov: "close third",
      tense: "past",
      genre: "literary fantasy",
      forbidden: ["modern slang", "firearms"],
      canonRules: ["Augers attune to a single bearer"],
      projectFoundation: "Premise: a queen carries a relic that listens.",
    });
  });
}

test.describe("T42. AI fidelity + no-provider excellence", () => {
  test("the provider request carries style directives, avoid-constraints, and canon", async ({ page }) => {
    await installRecordingFetchStub(page);
    await openFreshApp(page);
    await seedStyleIntel(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.AIService.saveProviderConfig({ id: "openai", providerType: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", apiKey: "sk-e2e-test" });
      await B.AIRoutingService.save({ mode: "cloud", defaultProviderId: "openai", confirmBeforeSendingManuscript: false });
    });
    // Trigger a draft through the real callback path.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:dispatch-callback", {
        detail: { name: "onGenerateAIWriterDraft", detail: { prompt: "Task: Write Chapter.\nOpen on the gate at dusk." } },
      }));
    });
    await expect.poll(async () => await page.evaluate(() => (window.__LW_FETCH_CALLS__ || []).length), { timeout: 8000 }).toBeGreaterThan(0);
    const call = await page.evaluate(() => (window.__LW_FETCH_CALLS__ || [])[0]);
    expect(call.body).toContain("Style directives");
    expect(call.body).toContain("close third");
    expect(call.body).toContain("dry, wintry");
    expect(call.body).toContain("Avoid (hard constraints)");
    expect(call.body).toContain("modern slang");
    expect(call.body).toContain("Canon (never contradict)");
    expect(call.body).toContain("Augers attune");
    expect(call.body).toContain("Open on the gate at dusk.");
  });

  test("the mocked completion renders in the AI Writer preview", async ({ page }) => {
    await installRecordingFetchStub(page);
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.AIService.saveProviderConfig({ id: "openai", providerType: "openai", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", apiKey: "sk-e2e-test" });
      await B.AIRoutingService.save({ mode: "cloud", defaultProviderId: "openai" });
      window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "aiWriter" } }));
    });
    const aiw = page.locator("[data-ui='AiWriterPanelBody']");
    await expect(aiw).toBeVisible({ timeout: 5000 });
    await aiw.locator("[data-testid='aiw-generate']").click();
    await expect(aiw.locator("[data-ui='AiwPreview']")).toContainText("MOCKED STYLED DRAFT", { timeout: 8000 });
  });

  test("Anthropic and Gemini adapters round-trip through their wire formats", async ({ page }) => {
    await installRecordingFetchStub(page);
    await openFreshApp(page);
    const out = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.AIService.saveProviderConfig({ id: "anthropic", providerType: "anthropic", baseUrl: "https://api.anthropic.com", defaultModel: "claude-x", apiKey: "sk-ant-e2e" });
      const a = await B.AIService.complete({ providerId: "anthropic", messages: [{ role: "system", content: "S" }, { role: "user", content: "U" }] });
      await B.AIService.saveProviderConfig({ id: "gemini", providerType: "gemini", baseUrl: "https://generativelanguage.googleapis.com", defaultModel: "gemini-pro", apiKey: "g-e2e" });
      const g = await B.AIService.complete({ providerId: "gemini", messages: [{ role: "system", content: "S" }, { role: "user", content: "U" }] });
      return { a: a?.text || a, g: g?.text || g, calls: (window.__LW_FETCH_CALLS__ || []).map((c) => c.url) };
    });
    expect(String(out.a)).toContain("MOCKED ANTHROPIC DRAFT");
    expect(String(out.g)).toContain("MOCKED GEMINI DRAFT");
    expect(out.calls.some((u) => u.includes("anthropic.com"))).toBe(true);
    expect(out.calls.some((u) => u.includes("googleapis.com"))).toBe(true);
  });

  test("no provider: Generate renders a useful local draft brief, never a dead end", async ({ page }) => {
    await openFreshApp(page);
    await seedStyleIntel(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "aiWriter" } }));
    });
    const aiw = page.locator("[data-ui='AiWriterPanelBody']");
    await expect(aiw).toBeVisible({ timeout: 5000 });
    await aiw.locator("[data-testid='aiw-generate']").click();
    const brief = aiw.locator("[data-testid='aiw-fallback-brief']");
    await expect(brief).toBeVisible({ timeout: 5000 });
    await expect(brief).toContainText("DRAFT BRIEF");
    await expect(brief).toContainText("no AI provider configured");
    // The brief carries the project's actual style + canon context.
    await expect(brief).toContainText("Style directives");
    await expect(brief).toContainText("dry, wintry");
    await expect(brief).toContainText("Canon (never contradict)");
    // And points to provider setup rather than dead-ending.
    await expect(brief).toContainText("configure an AI provider");
  });
});
