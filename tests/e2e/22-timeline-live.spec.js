// Workflow U22: Area 4 phase 2 — Timeline panel renders live data.
//
// The designed UI (era bands, vertical/horizontal cards, inspector,
// filters, review queue) is unchanged; these tests verify it is driven by
// the live events + timeline stores and that the demo events are gone.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

async function openTimelinePanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "timeline" } }));
  });
  await page.waitForTimeout(300);
}

// One manuscript-era event (with cast + location links) and one
// before-the-story timeline beat with an approximate date.
async function seedTimeline(page) {
  const anwen = await saveEntity(page, "cast", { name: "Anwen Hale", data: { role: "protagonist" } });
  const gate = await saveEntity(page, "locations", { name: "Toll Gate", data: { kind: "city" } });
  const parley = await page.evaluate(async ({ a, l }) => {
    const B = window.LoomwrightBackend;
    return B.EntityService.save("events", {
      name: "Toll Gate Parley",
      summary: "Anwen bargains for road rights.",
      data: { chapter: "Ch. 2", participants: [a], location: [{ id: l, name: "Toll Gate", type: "locations" }] },
    }, { status: "active" });
  }, { a: anwen.id, l: gate.id });
  await page.evaluate(async ({ a }) => {
    const B = window.LoomwrightBackend;
    await B.EntityService.save("timeline", {
      name: "The Old Flood",
      summary: "The river took the first bridge.",
      data: { dateLabel: "Year 700, approx.", timelinePosition: "long before the story", characters: [a] },
    }, { status: "active" });
  }, { a: anwen.id });
  return { anwen, gate, parley };
}

test.describe("U22. Timeline — live panel", () => {
  test("fresh project shows the designed empty state (no demo events)", async ({ page }) => {
    await openFreshApp(page);
    await openTimelinePanel(page);
    const tl = page.locator("[data-ui='TimelinePanelBody']");
    await expect(tl).toBeVisible();
    await expect(tl.locator("[data-ui='TLEmptyState']")).toBeVisible();
    await expect(tl).not.toContainText("Treaty of Brittlewood");
    await expect(tl).not.toContainText("Glass Audience");
  });

  test("live events render in their eras with chips, pills and inspector", async ({ page }) => {
    await openFreshApp(page);
    await seedTimeline(page);
    await openTimelinePanel(page);
    const tl = page.locator("[data-ui='TimelinePanelBody']");

    // Both eras render with the right cards.
    await expect(tl.locator(".tl-vert__era-name", { hasText: "The Manuscript" })).toBeVisible();
    await expect(tl.locator(".tl-vert__era-name", { hasText: "Before the Story" })).toBeVisible();
    const parleyCard = tl.locator(".tl-card", { hasText: "Toll Gate Parley" });
    await expect(parleyCard).toBeVisible();
    await expect(parleyCard.locator(".tl-card__chapter")).toHaveText("Ch. 2");
    await expect(parleyCard.locator(".tl-card__loc")).toHaveText("Toll Gate");
    await expect(parleyCard.locator(".tl-card__avatar")).toHaveText("AH");
    const floodCard = tl.locator(".tl-card", { hasText: "The Old Flood" });
    await expect(floodCard.locator(".tl-card__pill", { hasText: "~" })).toBeVisible();

    // Inspector opens from a card click with live rows + cast chip.
    await parleyCard.click();
    const insp = tl.locator(".tl-insp");
    await expect(insp).toBeVisible();
    await expect(insp.locator(".tl-insp__title")).toHaveText("Toll Gate Parley");
    await expect(insp.locator(".tl-row", { hasText: "Location" })).toContainText("Toll Gate");
    await expect(insp.locator(".tl-insp__chip", { hasText: "Anwen Hale" })).toBeVisible();

    // Character filter narrows the list.
    await tl.locator(".tl-bar__filt").click();
    await tl.locator(".tl-filt__chip", { hasText: "Anwen Hale" }).click();
    await expect(tl.locator(".tl-card")).toHaveCount(2); // both events involve Anwen
  });

  test("flashback toggle persists across reload", async ({ page }) => {
    await openFreshApp(page);
    await seedTimeline(page);
    await openTimelinePanel(page);
    const tl = page.locator("[data-ui='TimelinePanelBody']");
    const parleyCard = tl.locator(".tl-card", { hasText: "Toll Gate Parley" });
    await parleyCard.click();
    await tl.locator("[data-callback='onMarkTimelineFlashback']").click();
    await expect(tl.locator(".tl-card.is-flashback", { hasText: "Toll Gate Parley" })).toBeVisible();
    // Reload preserving state — the flag came from data.flashback.
    await openAppPreserveState(page);
    await openTimelinePanel(page);
    await expect(page.locator(".tl-card.is-flashback", { hasText: "Toll Gate Parley" })).toBeVisible();
  });

  test("review queue card accepts into a persisted event", async ({ page }) => {
    await openFreshApp(page);
    await seedTimeline(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.ReviewService.add({
        id: "rq-tl-e2e", entityType: "events", name: "Bridge collapse",
        suggestedAction: "create", confidence: 0.8, status: "pending",
        sourceQuote: "The bridge went down with the third wagon.",
        payload: { name: "Bridge collapse", entityType: "events", summary: "The bridge went down." },
      });
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
    });
    await openTimelinePanel(page);
    const tl = page.locator("[data-ui='TimelinePanelBody']");
    await tl.locator(".tl-bar__mode", { hasText: "Review" }).click();
    await expect(tl.locator(".tl-review__card")).toHaveCount(1);
    await expect(tl).toContainText("The bridge went down with the third wagon.");
    await tl.locator("[data-testid='tl-accept-rq-tl-e2e']").click();
    await page.waitForTimeout(400);
    await expect(tl.locator(".tl-review__card")).toHaveCount(0);
    const count = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("events").filter((r) => r.status !== "deleted").length);
    expect(count).toBe(2);
  });
});

// Phase-2 follow-through: a selected event shows its participants'
// relationship state AS OF that chapter (shared scenes up to it; bonds
// whose first traced chapter lies later are marked not-yet-formed).
test.describe("U22b. Timeline — relationship snapshot at the event's chapter", () => {
  test("inspector renders the pair bond filtered to the event's chapter", async ({ page }) => {
    const { openFreshApp, saveEntity } = require("./helpers");
    await openFreshApp(page);
    const a = await saveEntity(page, "cast", { name: "Snap Alpha", data: {} }, { status: "active" });
    const b = await saveEntity(page, "cast", { name: "Snap Bravo", data: {} }, { status: "active" });
    await saveEntity(page, "relationships", {
      name: "Alpha-Bravo pact",
      data: { from: { id: a.id, type: "cast" }, to: { id: b.id, type: "cast" }, bondType: "friend", chapters: [1] },
    }, { status: "active" });
    await page.evaluate(async ({ aId, bId }) => {
      const B = window.LoomwrightBackend;
      await B.ManuscriptChapterService.save({
        chapters: [
          { id: "tl-1", num: 1, title: "One", state: "saved", bodyText: "Alpha met Bravo." },
          { id: "tl-2", num: 2, title: "Two", state: "saved", bodyText: "They rode together." },
        ],
        activeChapterId: "tl-2",
        manuscripts: { "tl-1": { text: "Alpha met Bravo." }, "tl-2": { text: "They rode together." } },
        trashedChapters: [],
      });
      await B.OccurrenceService.saveMany([
        { entityId: aId, entityType: "cast", chapterId: "tl-1", exactText: "Alpha met Bravo." },
        { entityId: bId, entityType: "cast", chapterId: "tl-1", exactText: "Alpha met Bravo." },
      ]);
    }, { aId: a.id, bId: b.id });
    await saveEntity(page, "events", {
      name: "The Pact Holds",
      data: { eventType: "Reveal", chapter: "Ch. 2", participants: [{ id: a.id, type: "cast" }, { id: b.id, type: "cast" }] },
    }, { status: "active" });

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "timeline" } })));
    await page.waitForTimeout(300);
    const panel = page.locator(".pstk__panel[data-panel-id='p-timeline']");
    await panel.locator(".tl-card:has-text('The Pact Holds'), [data-ui='TLEventCard']:has-text('The Pact Holds')").first().click();
    const snap = panel.locator("[data-testid='tl-rel-snapshot']");
    await expect(snap).toBeVisible({ timeout: 5000 });
    await expect(snap).toContainText("as of Ch. 2");
    await expect(snap).toContainText("Snap Alpha ↔ Snap Bravo");
    await expect(snap).toContainText("Friend");
    await expect(snap).toContainText("Ch. 1");
  });
});
