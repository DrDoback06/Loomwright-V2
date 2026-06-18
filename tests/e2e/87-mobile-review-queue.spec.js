// Workflow T87: purpose-built mobile Review queue. Triage on the phone gets
// touch-sized filter controls and card actions, with Accept growing so the
// common "yes" is the easy thumb tap. Cards already collapse to one column.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.describe("T87. Mobile review queue", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/Loomwright%20Shell.html");
    await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 45000 });
    const wired = await page.evaluate(() => typeof window.MobileBottomNav !== "undefined");
    test.skip(!wired, "mobile shell not wired into the dev shell yet");
  });

  test("review card actions are touch-sized and Accept is prominent", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const cand = B.buildCandidate({ entityType: "cast", name: "Queued Stranger", sourceQuote: "A stranger waited at the gate." });
      cand.id = "rq-m87";
      await B.ReviewService.add(cand);
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
    });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "review" } })));

    const body = page.locator("[data-ui='ReviewPanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });
    await expect(body).toContainText("Queued Stranger");

    const accept = page.locator("[data-testid='rqc-accept-rq-m87']");
    await expect(accept).toBeVisible();
    const h = await accept.evaluate((el) => Math.round(el.getBoundingClientRect().height));
    expect(h).toBeGreaterThanOrEqual(36);

    // Accept grows (flex) so it's the dominant action vs. Deny.
    const aw = await accept.evaluate((el) => el.getBoundingClientRect().width);
    const dw = await page.locator("[data-testid='rqc-deny-rq-m87']").evaluate((el) => el.getBoundingClientRect().width);
    expect(aw).toBeGreaterThan(dw);

    // Triage still works on touch.
    await accept.click();
    await page.waitForTimeout(400);
    const saved = await page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("cast").some((e) => e.name === "Queued Stranger"));
    expect(saved).toBe(true);
  });
});
