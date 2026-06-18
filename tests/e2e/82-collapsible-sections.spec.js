// Workflow T82: collapsible panel sections. Every roster/tree pane and every
// dossier section can collapse to reclaim room — the same behaviour in both the
// default stack and the opt-in floating panels (the sections live in the shared
// panel bodies, so one set of assertions covers both).

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.describe("T82. Collapsible panel sections", () => {
  test("a roster/tree pane collapses to reclaim width", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "locations", { name: "Pale Reach", data: { kind: "region" } });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "locations" } })));
    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-locations']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });

    const aside = panel.locator(".loc-body__tree").first();
    const toggle = panel.locator("[data-testid='loc-tree-toggle']").first();
    await expect(toggle).toBeVisible({ timeout: 5000 });
    // The hierarchy tree shows before collapse.
    await expect(panel.locator("[data-ui='LocHierarchyTree']")).toBeVisible();
    await expect(aside).not.toHaveClass(/is-collapsed/);

    // Collapse → tree hides, aside marked collapsed.
    await toggle.click();
    await expect(aside).toHaveClass(/is-collapsed/, { timeout: 2000 });
    await expect(panel.locator("[data-ui='LocHierarchyTree']")).toHaveCount(0);

    // Expand again → tree returns.
    await toggle.click();
    await expect(aside).not.toHaveClass(/is-collapsed/, { timeout: 2000 });
    await expect(panel.locator("[data-ui='LocHierarchyTree']")).toBeVisible();
  });

  test("a LocTreePane roster (Items) collapses", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "items", { name: "Saltglass Lantern", data: { rarity: "Common" } });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } })));
    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-items']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });

    const aside = panel.locator(".loc-body__tree").first();
    const toggle = panel.locator("[data-testid='loc-tree-toggle']").first();
    await expect(toggle).toBeVisible({ timeout: 5000 });
    await expect(panel.locator(".item-roster")).toBeVisible();

    await toggle.click();
    await expect(aside).toHaveClass(/is-collapsed/, { timeout: 2000 });
    await expect(panel.locator(".item-roster")).toHaveCount(0);
  });

  test("a dossier section (RpgSection) collapses its body", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "locations", { name: "Pale Reach", data: { kind: "region", summary: "A salt-bitten coast." } });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "locations" } })));
    const panel = page.locator("[data-ui='SlidingPanel'][data-panel-id='p-locations']").first();
    await expect(panel).toBeVisible({ timeout: 5000 });

    const section = panel.locator("[data-ui='RpgSection']").first();
    await expect(section).toBeVisible({ timeout: 5000 });
    await expect(section.locator(".rpg-section__body")).toBeVisible();

    await section.locator("[data-testid='rpg-section-toggle']").click();
    await expect(section).toHaveClass(/is-collapsed/, { timeout: 2000 });
    await expect(section.locator(".rpg-section__body")).toHaveCount(0);
  });
});
