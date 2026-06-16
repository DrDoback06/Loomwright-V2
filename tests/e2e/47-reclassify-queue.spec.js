// Workflow T43: inline reclassification in the review queue.
//
// A misfiled candidate (extraction guessed "event" for a place) can be moved
// to the right entity type with the on-card dropdown BEFORE accepting — and
// Accept then creates the entity under the corrected type.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

test.describe("T47. Review-queue inline reclassification", () => {
  test("retype a candidate on the card, then Accept lands it under the new type", async ({ page }) => {
    await openFreshApp(page);

    // Seed a pending candidate that extraction misfiled as an event.
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rq-recl",
        entityType: "events",
        name: "Pale Cathedral",
        suggestedAction: "create",
        matchType: "new",
        status: "pending",
        confidence: 0.7,
        sourceQuote: "the bells of the Pale Cathedral rang at midnight",
        chapterId: "ch-1",
        payload: { name: "Pale Cathedral", discovered: true },
      });
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
    });

    // Open the docked Review Queue panel.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "review" } })));
    const body = page.locator("[data-ui='ReviewPanelBody']");
    await expect(body).toBeVisible({ timeout: 8000 });

    // Reclassify event -> location via the on-card dropdown.
    const retype = page.locator("[data-testid='rqc-retype-rq-recl']");
    await expect(retype).toBeVisible({ timeout: 6000 });
    await retype.selectOption("locations");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/reclassify.png", fullPage: false });

    // The persisted row should now be a location.
    await expect.poll(async () => page.evaluate(() => {
      const r = window.LoomwrightBackend.ReviewService.listSync().find((q) => q.id === "rq-recl");
      return r && r.entityType;
    }), { timeout: 4000 }).toBe("locations");

    // Accept → entity is created under the corrected type, not the original.
    await page.locator("[data-testid='rqc-accept-rq-recl']").click();

    await expect.poll(async () => page.evaluate(() => {
      const B = window.LoomwrightBackend;
      const inLoc = B.EntityService.listSync("locations").some((e) => e.name === "Pale Cathedral");
      const inEvt = B.EntityService.listSync("events").some((e) => e.name === "Pale Cathedral");
      return { inLoc, inEvt };
    }), { timeout: 6000 }).toEqual({ inLoc: true, inEvt: false });
  });
});
