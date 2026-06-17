// Workflow T74: AI Writer tab. Audit: well-built end-to-end — generation is
// provider-gated with a graceful local-brief fallback, context is assembled
// from live project data, and insert/create-chapter outputs are wired. Two
// UX bugs fixed: the no-provider path fired a redundant notice on top of the
// brief, and Copy/Accept read a global the local brief never set. This
// verifies Generate without a provider shows the local brief (not a crash /
// not only a notice) and that the brief becomes the copy/accept target.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openAiWriterPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "aiWriter" } })));
  await page.waitForTimeout(300);
}

test.describe("T74. AI Writer tab", () => {
  test("generate without a provider shows the local draft brief", async ({ page }) => {
    await openFreshApp(page);
    await openAiWriterPanel(page);
    const panel = page.locator("[data-ui='AiWriterPanelBody']");
    await expect(panel).toBeVisible({ timeout: 5000 });

    await panel.locator(".aiw__textarea").fill("Open on the salt flats at dawn.");
    await page.locator("[data-testid='aiw-generate']").click();

    // no provider in the test env -> the deterministic local brief is the result
    const brief = page.locator("[data-testid='aiw-fallback-brief']");
    await expect(brief).toBeVisible({ timeout: 5000 });
    await expect(brief).toContainText("DRAFT BRIEF");
    await expect(brief).toContainText("Open on the salt flats"); // instruction folded into the brief

    // the brief is now the Copy/Accept target (was unset before the fix)
    const lastDraft = await page.evaluate(() => window.__LW_LAST_GENERATED_DRAFT__ || "");
    expect(lastDraft).toContain("DRAFT BRIEF");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/aiwriter.png" });
  });
});
