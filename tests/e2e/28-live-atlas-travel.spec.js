// Workflow AB — Canonical live Atlas, travel and historical positions.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedAtlasProject(page) {
  return page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [
        { id: "ab-ch1", num: 1, title: "Salt Gate" },
        { id: "ab-ch2", num: 2, title: "Lantern Court" },
        { id: "ab-ch3", num: 3, title: "The Tower" },
      ],
      activeChapterId: "ab-ch3",
      manuscripts: {},
    });
    const gate = await B.EntityService.save("locations", { id: "ab-gate", name: "Salt Gate", data: { summary: "The western border.", locationType: "gate" } }, { status: "active" });
    const court = await B.EntityService.save("locations", { id: "ab-court", name: "Lantern Court", data: { summary: "Neutral ritual ground.", locationType: "court" } }, { status: "active" });
    const tower = await B.EntityService.save("locations", { id: "ab-tower", name: "Glass Tower", data: { summary: "An unplaced extracted landmark.", locationType: "tower" } }, { status: "active" });
    const mara = await B.EntityService.save("cast", {
      id: "ab-mara", name: "Mara Vale",
      data: {
        currentLocation: { id: court.id, name: court.name, type: "locations" },
        locationHistory: [
          { id: "ab-move-1", from: null, to: { id: gate.id, name: gate.name, type: "locations" }, chapterId: "ab-ch1", sourceQuote: "Mara crossed Salt Gate." },
          { id: "ab-move-2", from: { id: gate.id, name: gate.name, type: "locations" }, to: { id: court.id, name: court.name, type: "locations" }, chapterId: "ab-ch2", sourceQuote: "Mara entered Lantern Court." },
        ],
      },
    }, { status: "active" });
    await B.ReviewService.add({
      id: "ab-review-location", entityType: "locations", name: "Whisper Wharf", status: "pending",
      suggestedAction: "create", sourceQuote: "They moored at Whisper Wharf.", chapterId: "ab-ch3",
    });
    await B.LiveAtlasService.setPlacement(gate.id, { mapId: "atlas-map-world", x: 20, y: 45 });
    await B.LiveAtlasService.setPlacement(court.id, { mapId: "atlas-map-world", x: 72, y: 38 });
    const branch = await B.HistoricalWorldStateService.createBranch({ name: "Mara Turns Back", fromAnchor: { type: "chapter", id: "ab-ch2", label: "Ch. 2 · Lantern Court" } });
    await B.HistoricalWorldStateService.addBranchDelta({
      branchId: branch.id,
      entityId: mara.id,
      path: "data.currentLocation",
      after: { id: gate.id, name: gate.name, type: "locations" },
      anchor: { type: "chapter", id: "ab-ch2", label: "Ch. 2 · Lantern Court" },
      kind: "alternative-travel",
      relatedEntityIds: [gate.id, court.id],
    });
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
    window.dispatchEvent(new CustomEvent("lw:manuscript-chapters-updated"));
    return { branchId: branch.id, towerId: tower.id };
  });
}

async function openAtlas(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "atlas" } })));
  const panel = page.locator("[data-panel-id='p-atlas'], [data-ui='AtlasPanelBody']").first();
  await expect(panel).toBeVisible({ timeout: 10000 });
  const atlas = page.locator("[data-testid='live-atlas-workspace']");
  await expect(atlas).toBeVisible({ timeout: 10000 });
  return atlas;
}

test.describe("AB. Live Atlas and travel", () => {
  test("renders canonical geography, stages locations, persists placement and projects travel through chapters and branches", async ({ page }) => {
    await openFreshApp(page);
    const fixture = await seedAtlasProject(page);
    const atlas = await openAtlas(page);

    await expect(atlas).toContainText("Salt Gate");
    await expect(atlas).toContainText("Lantern Court");
    await expect(atlas).not.toContainText("Pale Reach");
    await expect(atlas).not.toContainText("Aelinor");
    await expect(atlas.locator("[data-testid='live-atlas-stage-ab-tower']")).toBeVisible();
    await expect(atlas.locator("[data-testid='live-atlas-route-ab-mara']")).toBeVisible();
    await expect(atlas.locator("[data-testid='live-atlas-position-list']")).toContainText("Lantern Court");

    await atlas.locator("[data-testid='live-atlas-stage-ab-tower']").click();
    const canvas = atlas.locator("[data-testid='live-atlas-canvas']");
    await canvas.click({ position: { x: 340, y: 145 } });
    await expect(atlas.locator("[data-testid='live-atlas-pin-ab-tower']")).toBeVisible();
    await page.waitForFunction(() => !!window.LoomwrightBackend.LiveAtlasService.loadStateSync().placements["ab-tower"]);

    await atlas.locator("[data-testid='live-atlas-anchor-select']").selectOption("ab-ch1");
    await expect(atlas.locator("[data-testid='live-atlas-position-list']")).toContainText("Salt Gate");
    await expect(atlas.locator("[data-testid='live-atlas-route-ab-mara']")).toHaveCount(0);

    await atlas.locator("[data-testid='live-atlas-anchor-select']").selectOption("current");
    await atlas.locator("[data-testid='live-atlas-branch-select']").selectOption(fixture.branchId);
    await expect(atlas.locator("[data-testid='live-atlas-position-list']")).toContainText("Salt Gate");

    await page.reload();
    await page.waitForFunction(() => !!window.LoomwrightBackend?.LiveAtlasService, null, { timeout: 45000 });
    const restored = await openAtlas(page);
    await expect(restored.locator("[data-testid='live-atlas-pin-ab-tower']")).toBeVisible({ timeout: 10000 });
  });

  test("creates nested maps linked to canonical locations", async ({ page }) => {
    await openFreshApp(page);
    await seedAtlasProject(page);
    const atlas = await openAtlas(page);

    await atlas.getByRole("button", { name: "New map" }).click();
    const dialog = page.locator("[data-testid='live-atlas-map-dialog']");
    await expect(dialog).toBeVisible();
    await dialog.locator("[data-testid='live-atlas-map-name']").fill("Lantern Court Interior");
    await dialog.getByLabel("Represented location").selectOption("ab-court");
    await dialog.locator("[data-testid='live-atlas-map-create']").click();
    await expect(dialog).toBeHidden();
    await expect(atlas.locator("[data-testid='live-atlas-map-select']")).toHaveValue(/atlas-map-/);
    await expect(atlas.locator("[data-testid='live-atlas-map-select']")).toContainText("Lantern Court Interior");

    const linked = await page.evaluate(() => window.LoomwrightBackend.LiveAtlasService.loadStateSync().maps.find((map) => map.name === "Lantern Court Interior"));
    expect(linked.locationId).toBe("ab-court");
    expect(linked.parentMapId).toBe("atlas-map-world");
  });
});
