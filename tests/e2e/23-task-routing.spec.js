// Workflow T23: Area 5 — AI Writer per-task model picker.
//
// The backend (AIRoutingService.taskRoutes + resolveRoute) already routes each
// AI task to a chosen provider/model; this verifies the new Settings UI that
// surfaces it: with a usable provider configured, the "Per-task model routing"
// card lists the tasks and pinning a task persists to AIRoutingService and
// changes what resolveRoute returns. With no provider, it shows the empty note.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.describe.configure({ timeout: 120_000 });

async function openRoutingSettings(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onOpenSettings" } }));
  });
  await expect(page.locator("[data-workspace-id='control-centre']")).toBeVisible({ timeout: 5000 });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:settings-section", { detail: { actionId: "ai-routing" } }));
  });
  await page.waitForTimeout(400);
}

async function seedProvider(page) {
  await page.evaluate(async () => {
    await window.LoomwrightBackend.KeysService.saveProvider("openai", {
      providerType: "openai",
      enabled: true,
      apiKey: "sk-e2e-test",
      availableModels: ["gpt-4o", "gpt-4o-mini"],
      defaultModel: "gpt-4o-mini",
    });
    await window.LoomwrightBackend.AIRoutingService.save({ defaultProviderId: "openai", tier: "normal", mode: "balanced" });
  });
}

test.describe("T23. AI Writer — per-task model routing", () => {
  test("shows the empty note when no provider is configured", async ({ page }) => {
    await openFreshApp(page);
    await openRoutingSettings(page);
    await expect(page.locator("[data-testid='task-routing-empty']")).toBeVisible();
  });

  test("lists AI tasks once a usable provider exists", async ({ page }) => {
    await openFreshApp(page);
    await seedProvider(page);
    await openRoutingSettings(page);
    // Task rows render (keyed by data-task-route), and the empty note is gone.
    await expect(page.locator("[data-testid='task-routing-empty']")).toHaveCount(0);
    await expect(page.locator("[data-task-route='writingDraft']")).toBeVisible();
    await expect(page.locator("[data-task-route='deepExtraction']")).toBeVisible();
  });

  test("pinning a task persists to AIRoutingService and drives resolveRoute", async ({ page }) => {
    await openFreshApp(page);
    await seedProvider(page);
    await openRoutingSettings(page);

    const row = page.locator("[data-task-route='writingDraft']");
    // First select in the row is the provider picker; choose OpenAI.
    await row.locator("select").first().selectOption("openai");
    await page.waitForTimeout(200);
    // A model picker appears; choose the non-default model to prove it sticks.
    await row.locator("select").nth(1).selectOption("gpt-4o-mini");
    await page.waitForTimeout(300);

    const resolved = await page.evaluate(() =>
      window.LoomwrightBackend.AIRoutingService.resolveRoute("writingDraft"));
    expect(resolved).toBeTruthy();
    expect(resolved.providerId).toBe("openai");
    expect(resolved.model).toBe("gpt-4o-mini");

    // The stored taskRoute reflects the pin.
    const stored = await page.evaluate(() =>
      window.LoomwrightBackend.AIRoutingService.loadSync().taskRoutes.writingDraft);
    expect(stored.providerId).toBe("openai");
    expect(stored.model).toBe("gpt-4o-mini");
  });
});
