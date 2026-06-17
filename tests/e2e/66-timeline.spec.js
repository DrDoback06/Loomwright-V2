// Workflow T66: Timeline tab — regression + the source-quote fix. The tab
// is already live + persistent (audit: reads events+timeline entities,
// adapts data.* via liveEventToTL, sorts by era/chapter, flashback toggle
// persists). The one bug: source quotes never surfaced because the adapter
// read d.sourceMentions, but sourceMentions is an IDENTITY_KEY stored
// top-level (e.sourceMentions). This verifies live beats render in chapter
// order AND the source quote now shows.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openTimelinePanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "timeline" } })));
  await page.waitForTimeout(300);
}

test.describe("T66. Timeline tab", () => {
  test("live beats render in chapter order with source quotes", async ({ page }) => {
    await openFreshApp(page);
    const hero = await saveEntity(page, "cast", { name: "Aelinor Vey" }, { status: "active" });
    await saveEntity(page, "events", {
      title: "The Auger Wake", summary: "Funeral rite opens the tale.",
      sourceMentions: "the auger was already lit before dawn",
      data: { eventType: "Ritual", chapter: "Ch. 1", participants: [hero.id] },
    }, { status: "active" });
    await saveEntity(page, "events", {
      title: "Hess negotiation", summary: "The court talks break down.",
      data: { eventType: "Meeting", chapter: "Ch. 5" },
    }, { status: "active" });
    await openTimelinePanel(page);
    await expect(page.locator("[data-ui='TimelinePanelBody']")).toBeVisible({ timeout: 5000 });
    const titles = page.locator(".tl-card__title");
    await expect(titles).toHaveCount(2, { timeout: 5000 });
    await expect(titles.nth(0)).toContainText("Auger Wake");        // Ch. 1 sorts first
    await expect(titles.nth(1)).toContainText("Hess negotiation");  // Ch. 5 second
    // source quote now surfaces from top-level sourceMentions (was always a fallback)
    await expect(page.locator("[data-ui='TimelinePanelBody']")).toContainText("auger was already lit");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/timeline.png" });
  });
});
