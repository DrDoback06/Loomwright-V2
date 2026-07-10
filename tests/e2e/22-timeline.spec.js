// Workflow T22: Area 5 — Timeline tab renders LIVE data.
//
// Verifies TimelinePanelBody reads the live "events" entity collection
// (title / summary / chapter / participants / location), resolves cast +
// location against the live store, buckets events into eras from their
// chapter placement, and lists live pending event candidates in Review
// (Deny resolves the real queue item). Empty project → empty state, not
// the old TL_EVENTS demo (Auger Wake / Glass Audience …).

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openTimelinePanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "timeline" } }));
  });
  await page.waitForTimeout(300);
}

test.describe("T22. Timeline — live data", () => {
  test("empty project shows an empty state, not the demo events", async ({ page }) => {
    await openFreshApp(page);
    await openTimelinePanel(page);
    const body = page.locator("[data-ui='TimelinePanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });
    await expect(body).toContainText(/No events yet/i);
    // Old demo events must NOT appear.
    await expect(body).not.toContainText("Auger Wake");
    await expect(body).not.toContainText("Glass Audience");
  });

  test("a live event entity renders with its title, summary and chapter", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "events", {
      name: "The Iron Vigil",
      summary: "Theron holds the gate through the night.",
      data: { chapter: "Ch. 3 — the long night", eventType: "Battle" },
    }, { status: "active" });
    await openTimelinePanel(page);
    const body = page.locator("[data-ui='TimelinePanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });
    const card = body.locator(".tl-card", { hasText: "The Iron Vigil" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Theron holds the gate");
    await expect(card).toContainText("Ch. 3");
    // Chapter 3 → the "In the manuscript" era band.
    await expect(body.locator(".tl-vert__era-name", { hasText: "In the manuscript" })).toBeVisible();
  });

  test("event card resolves live participants (cast avatars)", async ({ page }) => {
    await openFreshApp(page);
    const theron = await saveEntity(page, "cast", { name: "Theron Vale", data: { role: "protagonist" } }, { status: "active" });
    await saveEntity(page, "events", {
      name: "The Reckoning",
      summary: "A confrontation at dawn.",
      data: { chapter: "Ch. 2", participants: [{ id: theron.id, name: theron.name, type: "cast" }] },
    }, { status: "active" });
    await openTimelinePanel(page);
    const card = page.locator(".tl-card", { hasText: "The Reckoning" });
    await expect(card).toBeVisible({ timeout: 5000 });
    // Theron's initials avatar appears in the card footer.
    await expect(card.locator(".tl-card__avatar")).toContainText("TV");
  });

  test("clicking an event opens the inspector with live detail", async ({ page }) => {
    await openFreshApp(page);
    const loc = await saveEntity(page, "locations", { name: "Gate of Ash", data: { type: "city" } }, { status: "active" });
    await saveEntity(page, "events", {
      name: "The Iron Vigil",
      summary: "Theron holds the gate through the night.",
      data: { chapter: "Ch. 3", eventType: "Battle", location: { id: loc.id, name: loc.name, type: "locations" } },
    }, { status: "active" });
    await openTimelinePanel(page);
    await page.locator(".tl-card", { hasText: "The Iron Vigil" }).click();
    const insp = page.locator(".tl-insp");
    await expect(insp).toBeVisible({ timeout: 5000 });
    await expect(insp).toContainText("The Iron Vigil");
    await expect(insp).toContainText("Battle");
    await expect(insp).toContainText("Gate of Ash");
  });

  test("Review tab lists live event candidates and Deny resolves them", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rq-evt-1",
        entityType: "events",
        status: "pending",
        name: "The Salt Watch Ambush",
        suggestedAction: "create",
        confidence: 0.7,
        sourceQuote: "Steel rang out along the watchtower stair.",
      });
    });
    await openTimelinePanel(page);
    await page.locator(".tl-bar__mode:has-text('Review')").click();
    const review = page.locator(".tl-review");
    await expect(review).toBeVisible({ timeout: 5000 });
    await expect(review).toContainText("The Salt Watch Ambush");
    await expect(review).toContainText("Steel rang out");
    await page.locator(".tl-review__actions button:has-text('Deny')").first().click();
    await page.waitForTimeout(400);
    const stillPending = await page.evaluate(() =>
      window.LoomwrightBackend.ReviewService.listSync("events").filter((q) => q.status === "pending").length);
    expect(stillPending).toBe(0);
  });

  test("events with no chapter fall into the Backstory era", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "events", {
      name: "The Old Betrayal",
      summary: "Long before the story opens.",
      data: { timelinePosition: "Year 738" },
    }, { status: "active" });
    await openTimelinePanel(page);
    const body = page.locator("[data-ui='TimelinePanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });
    await expect(body.locator(".tl-vert__era-name", { hasText: "Backstory" })).toBeVisible();
    await expect(body.locator(".tl-card", { hasText: "The Old Betrayal" })).toBeVisible();
  });
});
