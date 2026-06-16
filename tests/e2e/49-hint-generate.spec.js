// Workflow T45: hint-seeded AI generation in the universal entity editor's
// "AI-Assisted Draft" tab. Offline it gates gracefully (no provider → a clear
// message); with a provider it drafts from the author's brief and the result
// can be applied to the form. (The model is mocked in-page so no key/network
// is needed; the generation LOGIC is covered deterministically by
// scripts/hint-gen-check.js.)

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openEditorInAIMode(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "cast", initial: { name: "Steve" }, mode: "ai" } })));
  const ed = page.locator("[data-ui='EntityEditor']");
  await expect(ed).toBeVisible({ timeout: 6000 });
  await expect(page.locator("[data-testid='ee-ai-hint']")).toBeVisible({ timeout: 4000 });
  return ed;
}

test.describe("T49. Hint-seeded AI generation", () => {
  test("offline: generating without a provider shows a graceful message", async ({ page }) => {
    await openFreshApp(page);
    await openEditorInAIMode(page);
    await page.locator("[data-testid='ee-ai-hint']").fill("main character, best friends with Graham");
    await page.locator("[data-testid='ee-ai-generate']").click();
    await expect(page.locator("[data-testid='ee-ai-error']")).toContainText(/Add an AI provider/i, { timeout: 6000 });
  });

  test("with a provider: a brief drafts fields that can be applied", async ({ page }) => {
    await openFreshApp(page);
    // Mock the routed provider + the model (no key/network), and skip the
    // send-confirmation so the flow runs unattended.
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.AIRoutingService.save({ confirmBeforeSendingManuscript: false });
      B.AIRoutingService.resolveRoute = () => ({ providerId: "test", model: "test-model" });
      B.AIService.getProviderConfig = async () => ({ needsKey: false, model: "test-model" });
      B.AIService.complete = async () => JSON.stringify({ summary: "A courier who owes a debt to Graham.", backstory: "Raised in the salt-houses of Hess." });
    });
    const ed = await openEditorInAIMode(page);
    await page.locator("[data-testid='ee-ai-hint']").fill("main character, best friends with Graham");
    await page.locator("[data-testid='ee-ai-generate']").click();
    // The draft preview renders the generated values.
    await expect(ed).toContainText("A courier who owes a debt to Graham.", { timeout: 6000 });
    await expect(page.locator("[data-testid='ee-ai-apply']")).toBeVisible();
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/hint-generate.png" });
    // Apply merges into the form without error; the editor stays open. (Field-
    // merge correctness — name/summary preserved — is covered deterministically
    // by scripts/hint-gen-check.js.)
    await page.locator("[data-testid='ee-ai-apply']").click();
    await expect(ed).toBeVisible();
  });
});
