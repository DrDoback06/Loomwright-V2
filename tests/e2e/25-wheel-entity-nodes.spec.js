// Workflow T25: Area 6 — the adaptive wheel reaches entity-tab nodes.
//
// Extends the context-aware wheel beyond the manuscript: right-clicking a live
// timeline event card opens the wheel with that event's entity context, and its
// actions resolve (Edit opens the entity editor for the right event). Demo
// cards have no backing entity, so they don't arm the wheel.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.describe.configure({ timeout: 120_000 });

async function openTimelineWithEvent(page) {
  const ev = await saveEntity(page, "events", {
    name: "The Keep Falls",
    summary: "The outer wall was breached at dawn.",
    data: { eventType: "Battle", timelinePosition: "Day 12" },
  }, { status: "active" });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "timeline" } })));
  const body = page.locator("[data-ui='TimelinePanelBody']");
  await expect(body).toBeVisible({ timeout: 5000 });
  return { body, ev };
}

test.describe("T25. Adaptive wheel — entity-tab nodes", () => {
  test("right-clicking a live timeline card opens the wheel with entity context", async ({ page }) => {
    await openFreshApp(page);
    const { body, ev } = await openTimelineWithEvent(page);

    await body.locator(`[data-event-id='${ev.id}']`).click({ button: "right" });
    const wheel = page.locator("[data-testid='adaptive-wheel']");
    await expect(wheel).toBeVisible({ timeout: 5000 });
    // The wheel hub labels the context with the event name, and offers the
    // entity actions (Open / Edit / Merge).
    await expect(wheel).toContainText("The Keep Falls");
    await expect(wheel.locator("[data-testid='wheel-edit-entity']")).toBeVisible();
    await expect(wheel.locator("[data-testid='wheel-open-entity']")).toBeVisible();
  });

  test("the wheel's Edit action opens the editor for that event", async ({ page }) => {
    await openFreshApp(page);
    const { body, ev } = await openTimelineWithEvent(page);

    await page.evaluate(() => {
      window.__editorOpen = null;
      window.addEventListener("lw:open-entity-editor", (e) => { window.__editorOpen = e.detail; });
    });

    await body.locator(`[data-event-id='${ev.id}']`).click({ button: "right" });
    await expect(page.locator("[data-testid='adaptive-wheel']")).toBeVisible();
    await page.locator("[data-testid='wheel-edit-entity']").click();

    const opened = await page.evaluate(() => window.__editorOpen);
    expect(opened).toBeTruthy();
    expect(opened.type).toBe("events");
    expect(opened.initial && opened.initial.id).toBe(ev.id);
  });

  test("right-clicking a relationship backed by a real entity opens the wheel", async ({ page }) => {
    await openFreshApp(page);
    // Two cast + a standalone relationship entity between them (has _relEntity).
    const rowan = await saveEntity(page, "cast", { name: "Rowan Vale", data: { role: "protagonist" } }, { status: "active" });
    const kessa = await saveEntity(page, "cast", { name: "Kessa Dune", data: { role: "antagonist" } }, { status: "active" });
    const rel = await saveEntity(page, "relationships", {
      name: "Rowan Vale → Kessa Dune",
      summary: "Kessa broke faith at the ridge.",
      data: { fromId: rowan.id, toId: kessa.id, relationshipType: "betrayed" },
    }, { status: "active" });

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "relationships" } })));
    const body = page.locator("[data-ui='RelationshipsPanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });

    await page.evaluate(() => {
      window.__editorOpen = null;
      window.addEventListener("lw:open-entity-editor", (e) => { window.__editorOpen = e.detail; });
    });

    // The single view shows Rowan's relationship card; right-click arms the wheel.
    await body.locator(".rel-card").first().click({ button: "right" });
    const wheel = page.locator("[data-testid='adaptive-wheel']");
    await expect(wheel).toBeVisible({ timeout: 5000 });
    await wheel.locator("[data-testid='wheel-edit-entity']").click();

    const opened = await page.evaluate(() => window.__editorOpen);
    expect(opened).toBeTruthy();
    expect(opened.type).toBe("relationships");
    expect(opened.initial && opened.initial.id).toBe(rel.id);
  });

  test("delegated handler arms the wheel on a bespoke tab row (Items)", async ({ page }) => {
    await openFreshApp(page);
    const item = await saveEntity(page, "items", { name: "The Auger Stone", data: { rarity: "legendary" } }, { status: "active" });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } })));

    // The Items roster row carries data-entity-id / data-entity-type; the
    // delegated contextmenu handler in app.jsx opens the wheel from it.
    const row = page.locator(`[data-entity-id='${item.id}']`).first();
    await expect(row).toBeVisible({ timeout: 5000 });
    await row.click({ button: "right" });

    const wheel = page.locator("[data-testid='adaptive-wheel']");
    await expect(wheel).toBeVisible({ timeout: 5000 });
    await expect(wheel).toContainText("The Auger Stone");
    await expect(wheel.locator("[data-testid='wheel-edit-entity']")).toBeVisible();
  });
});
