// Workflow T22: Area 4 — Timeline workspace reads the LIVE store.
//
// Verifies the Timeline panel is driven by live entities instead of the old
// TL_EVENTS / ATLAS_* demo constants:
//   - beats come from BOTH "timeline" and "events" entities, bucketed into
//     Backstory (no chapter) and The Story (has chapter) eras,
//   - cards resolve live cast avatars + location names,
//   - filter chips list live cast / locations,
//   - the review tab shows pending event candidates and Accept creates a
//     real entity + clears the queue,
//   - an empty project shows the honest "No timeline yet" state.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openTimelinePanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "timeline" } }));
  });
  await page.waitForSelector("[data-ui='TimelinePanelBody']", { timeout: 5000 });
  await page.waitForTimeout(200);
}

test.describe("T22. Timeline — live workspace", () => {
  test("empty project shows the honest no-timeline state", async ({ page }) => {
    await openFreshApp(page);
    await openTimelinePanel(page);
    await expect(page.locator("[data-ui='TimelinePanelBody']")).toContainText("No timeline yet");
  });

  test("beats from timeline + events entities render in Backstory / Story eras", async ({ page }) => {
    await openFreshApp(page);
    const kestrel = await saveEntity(page, "cast", { name: "Kestrel Vane", data: { role: "protagonist" } }, { status: "active" });
    const gate = await saveEntity(page, "locations", { name: "Iron Gate", data: {} }, { status: "active" });

    // A "timeline" beat anchored to a chapter (→ The Story era).
    const beat = await saveEntity(page, "timeline", {
      name: "The Gate Opens", summary: "Kestrel reaches the Iron Gate.",
      isMilestone: true, chapter: "Ch. 3", dateLabel: "Day 12",
    }, { status: "active" });
    await page.evaluate(async ({ beatId, kId, lId }) => {
      const LS = window.LoomwrightBackend.LinkService;
      await LS.appendField(beatId, "timeline", "characters", kId);
      await LS.appendField(beatId, "timeline", "locations", lId);
    }, { beatId: beat.id, kId: kestrel.id, lId: gate.id });

    // An "events" beat with no chapter (→ Backstory era).
    await saveEntity(page, "events", {
      name: "The Old Oath", summary: "Sworn generations before.",
      data: { participants: [kestrel.id], timelinePosition: "Year 700" },
    }, { status: "active" });

    await openTimelinePanel(page);

    await expect(page.locator(".tl-stage")).toContainText("The Gate Opens");
    await expect(page.locator(".tl-stage")).toContainText("The Old Oath");
    await expect(page.locator(".tl-vert")).toContainText("The Story");
    await expect(page.locator(".tl-vert")).toContainText("Backstory");
    // Live location name resolved onto the card; no demo beats leak through.
    await expect(page.locator(".tl-stage")).toContainText("Iron Gate");
    await expect(page.locator(".tl-stage")).not.toContainText("Treaty of Brittlewood");

    // Filter chips list live entities.
    await page.locator(".tl-bar__filt").click();
    await expect(page.locator(".tl-filt")).toContainText("Kestrel Vane");
    await expect(page.locator(".tl-filt")).toContainText("Iron Gate");
  });

  test("review tab lists pending event candidates and Accept creates a beat", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Kestrel Vane", data: { role: "protagonist" } }, { status: "active" });

    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "tq-test-1",
        entityType: "events",
        name: "Salt Watch night",
        status: "pending",
        confidence: 0.83,
        sourceQuote: "the watch at Salt was already lit when she came down",
      });
    });

    await openTimelinePanel(page);
    await page.locator(".tl-bar__mode", { hasText: "Review" }).click();

    await expect(page.locator(".tl-bar__q")).toHaveText("1");
    await expect(page.locator(".tl-review__card")).toContainText("Salt Watch night");
    await expect(page.locator(".tl-review__quote")).toContainText("already lit");

    const before = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("events").length);
    await page.locator(".tl-review__actions button", { hasText: "Accept" }).first().click();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("events").length);
    expect(after).toBe(before + 1);
    await expect(page.locator(".tl-bar__q")).toHaveCount(0);
  });
});
