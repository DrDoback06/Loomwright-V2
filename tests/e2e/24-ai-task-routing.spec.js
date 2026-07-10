// Workflow T24: Area 5 — per-task AI model routing UI.
//
// The routing backend (AIRoutingService.taskRoutes + resolveRoute) already
// supported per-task provider/model routes, but nothing drove it. The
// Settings → AI routing section now renders a provider+model picker per AI
// task. This test drives the real DOM: seed a provider, open the section,
// pick a provider + model for a task, and assert it persists AND that
// resolveRoute honours it.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openAIRoutingSection(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
      detail: { workspaceId: "control-centre", panelKind: "settings", sourcePanel: "p-settings" },
    }));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:settings-section", { detail: { actionId: "ai-routing" } }));
  });
  await page.waitForTimeout(300);
}

test.describe("T24. AI routing — per-task model picker", () => {
  test("picking a provider + model for a task persists to taskRoutes and drives resolveRoute", async ({ page }) => {
    await openFreshApp(page);
    // Seed a usable cloud provider (enabled + keyed).
    await page.evaluate(async () => {
      await window.LoomwrightBackend.KeysService.saveProvider("openai", {
        enabled: true, providerType: "openai", label: "OpenAI", apiKey: "sk-test-xxxxxxxx", defaultModel: "gpt-4o-mini",
      });
      // A default provider + normal tier so resolveRoute can return a route.
      await window.LoomwrightBackend.AIRoutingService.save({ mode: "balanced", tier: "normal", defaultProviderId: "openai" });
    });

    await openAIRoutingSection(page);

    // The per-task routing card renders a row per task.
    const row = page.locator(".set-airoute", { hasText: "Writing / drafting" });
    await expect(row).toBeVisible({ timeout: 5000 });

    // Pick the provider, then a specific model.
    await row.locator("select").first().selectOption("openai");
    await page.waitForTimeout(150);
    await row.locator("select").nth(1).selectOption("gpt-4o");
    await page.waitForTimeout(200);

    // Persisted to AIRoutingService.taskRoutes …
    const route = await page.evaluate(() => window.LoomwrightBackend.AIRoutingService.loadSync().taskRoutes?.writingDraft);
    expect(route).toBeTruthy();
    expect(route.providerId).toBe("openai");
    expect(route.model).toBe("gpt-4o");

    // … and resolveRoute honours it.
    const resolved = await page.evaluate(() => window.LoomwrightBackend.AIRoutingService.resolveRoute("writingDraft"));
    expect(resolved).toBeTruthy();
    expect(resolved.providerId).toBe("openai");
    expect(resolved.model).toBe("gpt-4o");
  });

  test("a task left on Default routes to the default provider", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.KeysService.saveProvider("openai", {
        enabled: true, providerType: "openai", label: "OpenAI", apiKey: "sk-test-xxxxxxxx", defaultModel: "gpt-4o-mini",
      });
      await window.LoomwrightBackend.AIRoutingService.save({ mode: "balanced", tier: "normal", defaultProviderId: "openai" });
    });
    await openAIRoutingSection(page);
    // No explicit route for rewritePassage → resolveRoute falls back to default.
    const resolved = await page.evaluate(() => window.LoomwrightBackend.AIRoutingService.resolveRoute("rewritePassage"));
    expect(resolved.providerId).toBe("openai");
    expect(resolved.model).toBe("gpt-4o-mini");
  });

  test("the wheel's Deep · AI slot advertises the resolved model", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.KeysService.saveProvider("openai", {
        enabled: true, providerType: "openai", label: "OpenAI", apiKey: "sk-test-xxxxxxxx", defaultModel: "gpt-4o-mini",
      });
      // Pin deep extraction to a specific model.
      await window.LoomwrightBackend.AIRoutingService.save({
        mode: "balanced", tier: "normal", defaultProviderId: "openai",
        taskRoutes: { deepExtraction: { providerId: "openai", model: "gpt-4o" } },
      });
    });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "writers-room" } })));
    await page.waitForTimeout(250);
    // Open the wheel over the manuscript (chapter context).
    await page.locator("[data-testid='wr-manuscript-body']").first().dispatchEvent("contextmenu");
    await expect(page.locator("[data-testid='adaptive-wheel']")).toBeVisible({ timeout: 4000 });
    // The Deep slot shows the pinned model as its sublabel.
    const sub = page.locator("[data-testid='wheel-sub-extract-chapter-deep']");
    await expect(sub).toHaveText("gpt-4o");
  });
});
