// Workflow T26: Area 9 — per-task AI model picker.
//
// The routing backend (AIRoutingService.taskRoutes) and the onSetAITaskRoute
// callback were already wired + service-tested; the gap was a UI to drive
// them. This adds a "Per-task AI model" card under Settings → AI routing that
// lists the AI tasks and lets you route each to a chosen provider + model,
// persisting to AIRoutingService and honoured by resolveRoute.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedProvider(page) {
  await page.evaluate(async () => {
    await window.LoomwrightBackend.AIService.saveProviderConfig({
      id: "openai", providerType: "openai", label: "OpenAI", apiKey: "sk-e2e-routing",
      defaultModel: "gpt-4o-mini", availableModels: ["gpt-4o-mini", "gpt-4o"], enabled: true,
    });
  });
}

async function openAIRoutingSettings(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "settings" } })));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", { detail: { workspaceId: "control-centre", panelKind: "settings", sourcePanel: "p-settings" } })));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:settings-section", { detail: { actionId: "ai-routing" } })));
  await page.waitForTimeout(300);
}

const routeOf = (page, task) => page.evaluate((t) => {
  const st = window.LoomwrightBackend.AIRoutingService.loadSync();
  return (st.taskRoutes || {})[t] || null;
}, task);

test.describe("T26. Per-task AI model picker", () => {
  test("the picker renders a row per task with a provider selector", async ({ page }) => {
    await openFreshApp(page);
    await seedProvider(page);
    await openAIRoutingSettings(page);
    await expect(page.locator("[data-testid='tr-prov-writingDraft']")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("[data-testid='tr-prov-deepExtraction']")).toBeVisible();
    // The seeded provider is an option.
    await expect(page.locator("[data-testid='tr-prov-writingDraft'] option", { hasText: "OpenAI" })).toHaveCount(1);
  });

  test("choosing a provider + model for a task persists and is honoured by resolveRoute", async ({ page }) => {
    await openFreshApp(page);
    await seedProvider(page);
    await openAIRoutingSettings(page);
    const prov = page.locator("[data-testid='tr-prov-writingDraft']");
    await expect(prov).toBeVisible({ timeout: 8000 });
    // Route "Draft prose" → OpenAI.
    await prov.selectOption("openai");
    await expect.poll(() => routeOf(page, "writingDraft").then((r) => r && r.providerId)).toBe("openai");
    // A model field appears; set a specific model.
    const model = page.locator("[data-testid='tr-model-writingDraft']");
    await expect(model).toBeVisible({ timeout: 5000 });
    await model.fill("gpt-4o");
    await expect.poll(() => routeOf(page, "writingDraft").then((r) => r && r.model)).toBe("gpt-4o");
    // resolveRoute honours the explicit per-task route.
    const resolved = await page.evaluate(() => window.LoomwrightBackend.AIRoutingService.resolveRoute("writingDraft"));
    expect(resolved).toEqual({ providerId: "openai", model: "gpt-4o" });
    // Other tasks are untouched (still default → provider default model).
    expect(await routeOf(page, "deepExtraction")).toBeNull();
  });

  test("resetting a task to Default clears its explicit route", async ({ page }) => {
    await openFreshApp(page);
    await seedProvider(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.AIRoutingService.save({ taskRoutes: { rewritePassage: { providerId: "openai", model: "gpt-4o" } } });
    });
    await openAIRoutingSettings(page);
    const prov = page.locator("[data-testid='tr-prov-rewritePassage']");
    await expect(prov).toBeVisible({ timeout: 8000 });
    await expect(prov).toHaveValue("openai");
    await prov.selectOption(""); // Default
    await expect.poll(() => routeOf(page, "rewritePassage").then((r) => (r && r.providerId) || "")).toBe("");
  });
});
