// Workflow T22: Area 4 — Timeline tab renders the LIVE event store.
//
// Verifies the Timeline panel is driven by real `events` entities (not the
// TL_EVENTS demo): a seeded event appears on the timeline with its live
// participants + location, the review mode lists live event candidates wired
// to the real queue, and an empty project falls back to the demo so the
// surface is never blank.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

// Cold in-browser Babel over ~70 modules can be slow on constrained runners.
test.describe.configure({ timeout: 120_000 });

async function openTimelinePanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "timeline" } }));
  });
  const body = page.locator("[data-ui='TimelinePanelBody']");
  await expect(body).toBeVisible({ timeout: 5000 });
  return body;
}

// Seed a cast + location + an event that references both.
async function seedEvent(page) {
  const hero = await saveEntity(page, "cast", { name: "Tomas Reed", data: { role: "protagonist" } }, { status: "active" });
  const keep = await saveEntity(page, "locations", { name: "The Keep", data: { type: "city" } }, { status: "active" });
  await saveEntity(page, "events", {
    name: "The Keep Falls",
    summary: "The outer wall was breached at dawn.",
    data: {
      eventType: "Battle",
      timelinePosition: "Day 12",
      participants: [{ id: hero.id, name: hero.name, type: "cast" }],
      location: { id: keep.id, name: keep.name, type: "locations" },
    },
  }, { status: "active" });
  return { hero, keep };
}

test.describe("T22. Timeline — live from the event store", () => {
  test("timeline renders the LIVE event, not the demo", async ({ page }) => {
    await openFreshApp(page);
    await seedEvent(page);
    const body = await openTimelinePanel(page);

    // The seeded event shows; the demo events (e.g. Glass Audience) do not.
    await expect(body.locator(".tl-card__title", { hasText: "The Keep Falls" })).toBeVisible();
    await expect(body).not.toContainText("Glass Audience");
    // Its live date placement surfaces on the card.
    await expect(body.locator(".tl-card", { hasText: "The Keep Falls" })).toContainText("Day 12");
  });

  test("inspector shows the event's live participants + location", async ({ page }) => {
    await openFreshApp(page);
    await seedEvent(page);
    const body = await openTimelinePanel(page);

    // Click the event card to open the inspector drawer.
    await body.locator(".tl-card", { hasText: "The Keep Falls" }).click();
    const insp = body.locator(".tl-insp");
    await expect(insp).toBeVisible();
    await expect(insp).toContainText("The Keep Falls");
    await expect(insp).toContainText("Tomas Reed");
    await expect(insp).toContainText("The Keep");
  });

  test("review mode lists live event candidates", async ({ page }) => {
    await openFreshApp(page);
    await seedEvent(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rq-ev-e2e",
        entityType: "events",
        name: "The Long Night",
        confidence: 0.72,
        sourceQuote: "The dark came early and stayed.",
        chapterId: "ch-x",
        suggestedAction: "create",
        status: "pending",
      });
    });
    const body = await openTimelinePanel(page);

    const reviewMode = body.locator(".tl-bar__mode", { hasText: "Review" });
    await expect(reviewMode.locator(".tl-bar__q")).toHaveText("1");
    await reviewMode.click();
    const review = body.locator(".tl-review");
    await expect(review).toBeVisible();
    await expect(review.locator(".tl-review__title")).toContainText("The Long Night");
    await expect(review.locator(".tl-review__quote")).toContainText("dark came early");
  });

  test("an empty project falls back to the demo timeline (never blank)", async ({ page }) => {
    await openFreshApp(page);
    const body = await openTimelinePanel(page);
    // No events seeded — demo events render so the surface reads.
    await expect(body.locator(".tl-card__title").first()).toBeVisible();
    await expect(body).toContainText("Glass Audience");
  });
});
