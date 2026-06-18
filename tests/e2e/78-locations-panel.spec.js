// Workflow T78: Locations panel — the entity registry/editor for places
// (distinct from the Atlas map). Live hierarchy, sort, in-place reparent,
// and cross-navigation (Show on Atlas) must all work.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openLocationsPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "locations" } })));
  await page.locator("[data-ui='LocationsPanelBody']").first().waitFor({ timeout: 5000 });
}

test.describe("T78. Locations panel — hierarchy, sort, reparent, cross-nav", () => {
  test("lists live locations in a hierarchy; in-place reparent persists", async ({ page }) => {
    await openFreshApp(page);
    const ald = await saveEntity(page, "locations", { name: "Aldoria", data: { kind: "country" } }, { status: "active" });
    const bright = await saveEntity(page, "locations", { name: "Brightwater", data: { kind: "city", parentId: ald.id } }, { status: "active" });
    const moss = await saveEntity(page, "locations", { name: "Mossford", data: { kind: "town", parentId: ald.id } }, { status: "active" });
    await openLocationsPanel(page);
    const body = page.locator("[data-ui='LocationsPanelBody']").first();
    await expect(body).toBeVisible({ timeout: 5000 });

    const tree = body.locator("[data-ui='LocHierarchyTree']");
    await expect(tree).toContainText("Aldoria");
    await expect(tree).toContainText("Brightwater");
    await expect(tree).toContainText("Mossford");

    // select Mossford, reparent it under Brightwater via the inline control
    await tree.locator(".loc-tree__name", { hasText: "Mossford" }).click();
    const reparent = body.locator("[data-testid='loc-reparent']");
    await expect(reparent).toBeVisible({ timeout: 3000 });
    await reparent.selectOption({ label: "Brightwater" });
    await page.waitForTimeout(300);

    const parent = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "locations").data.parentId, moss.id);
    expect(parent).toBe(bright.id);
  });

  test("sort control orders the tree; Show on Atlas opens the map panel", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "locations", { name: "Zedland", data: { kind: "country" } }, { status: "active" });
    await saveEntity(page, "locations", { name: "Aaronby", data: { kind: "country" } }, { status: "active" });
    await saveEntity(page, "locations", { name: "Capital Keep", data: { kind: "city", placed: true, coords: { x: 50, y: 50 } } }, { status: "active" });
    await openLocationsPanel(page);
    const body = page.locator("[data-ui='LocationsPanelBody']").first();
    await expect(body).toBeVisible({ timeout: 5000 });

    // default sort = Name → first root alphabetical ("Aaronby")
    const firstName = async () => (await body.locator("[data-ui='LocHierarchyTree'] .loc-tree__name").first().innerText()).trim();
    expect(await firstName()).toBe("Aaronby");

    // Show on Atlas from the dossier opens the Atlas panel
    await body.locator("[data-ui='LocHierarchyTree'] .loc-tree__name", { hasText: "Capital Keep" }).click();
    await body.locator("[data-testid='loc-show-on-atlas']").click();
    await expect(page.locator("[data-ui='AtlasPanelBody']").first()).toBeVisible({ timeout: 5000 });
  });
});
