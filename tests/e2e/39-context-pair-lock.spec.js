// Workflow T39: Cross-tab context, the two-cast pair view, and the
// selection lock.
//
// Phase-2 behaviours, all asserted on the rendered DOM:
//   1. Selecting an entity in one panel filters other open panels
//      (focusedByType → panelContext.focusedEntity → row filters), with
//      the "Filtered by X" chip rendered and clearable.
//   2. Multi-selecting exactly two cast offers "View relationship" and
//      renders the RelationshipPairView (bond, meters, shared chapters);
//      an open Relationships panel jumps into compare mode (lw:pair-focus).
//   3. The PanelChrome lock keeps an entity selected across panel
//      close/reopen AND full reloads (SelectionLockService +
//      localStorage), with LockTray chips on desktop and mobile.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

async function openPanel(page, kind) {
  await page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } }));
  }, kind);
  await page.waitForTimeout(250);
}

test.describe("T39. Cross-tab context + pair view + lock", () => {
  test("selecting a cast member filters the Items panel to their belongings", async ({ page }) => {
    await openFreshApp(page);
    const hero = await saveEntity(page, "cast", { name: "Owner Hero", data: { role: "protagonist" } }, { status: "active" });
    await saveEntity(page, "items", { name: "Hero Blade", data: { itemType: "Weapon", currentOwner: { id: hero.id, name: "Owner Hero", type: "cast" } } }, { status: "active" });
    await saveEntity(page, "items", { name: "Stray Lantern", data: { itemType: "Tool" } }, { status: "active" });

    await openPanel(page, "items");
    await openPanel(page, "cast");
    // Both items visible before any focus.
    const itemsPanel = page.locator(".pstk__panel[data-panel-id='p-items']");
    await expect(itemsPanel).toContainText("Hero Blade");
    await expect(itemsPanel).toContainText("Stray Lantern");

    // Select the hero in the Cast panel → broadcast focus.
    await page.locator(".cast-row:has-text('Owner Hero')").click();
    // The Items panel shows the filter chip and only the owned item.
    await expect(itemsPanel.locator(".pstk__filter-chip")).toContainText("Filtered by Owner Hero", { timeout: 4000 });
    await expect(itemsPanel).toContainText("Hero Blade");
    await expect(itemsPanel).not.toContainText("Stray Lantern");

    // Clearing the chip restores the full vault.
    await itemsPanel.locator(".pstk__filter-chip").click();
    await expect(itemsPanel).toContainText("Stray Lantern", { timeout: 4000 });
  });

  test("two multi-selected cast → View relationship → pair view with bond + compare mode", async ({ page }) => {
    await openFreshApp(page);
    const a = await saveEntity(page, "cast", { name: "Pair Alpha", data: { role: "protagonist" } }, { status: "active" });
    const b = await saveEntity(page, "cast", { name: "Pair Bravo", data: { role: "antagonist" } }, { status: "active" });
    await saveEntity(page, "relationships", {
      name: "Alpha–Bravo rivalry",
      data: {
        from: { id: a.id, name: "Pair Alpha", type: "cast" },
        to: { id: b.id, name: "Pair Bravo", type: "cast" },
        bondType: "rival", strength: 70, trust: 25, conflict: 80,
        summary: "Old wound, new war.",
      },
    }, { status: "active" });

    await openPanel(page, "relationships");
    await openPanel(page, "cast");
    // Ctrl-click both rows → multi-select mode with 2 selected.
    await page.locator(".cast-row:has-text('Pair Alpha')").click({ modifiers: ["Control"] });
    await page.locator(".cast-row:has-text('Pair Bravo')").click({ modifiers: ["Control"] });
    const multibar = page.locator("[data-ui='CastMultiBar']");
    await expect(multibar).toContainText("2");

    await multibar.locator("button:has-text('View relationship')").click();
    const pairView = page.locator("[data-ui='RelationshipPairView']");
    await expect(pairView).toBeVisible();
    await expect(pairView).toContainText("Pair Alpha");
    await expect(pairView).toContainText("Pair Bravo");
    await expect(pairView).toContainText("Rival");
    await expect(pairView).toContainText("Old wound, new war.");
    // Meters render with values.
    await expect(pairView.locator(".rel-meter").first()).toBeVisible();

    // The open Relationships panel jumped to compare mode with both names.
    const relPanel = page.locator(".pstk__panel[data-panel-id='p-relationships']");
    await expect(relPanel.locator(".rel-bar__mode.is-on")).toContainText("Compare");
    await expect(relPanel).toContainText("Pair Alpha");
    await expect(relPanel).toContainText("Pair Bravo");
  });

  test("pair view with no recorded bond offers the create CTA", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Lone Alpha", data: {} }, { status: "active" });
    await saveEntity(page, "cast", { name: "Lone Bravo", data: {} }, { status: "active" });
    await openPanel(page, "cast");
    await page.locator(".cast-row:has-text('Lone Alpha')").click({ modifiers: ["Control"] });
    await page.locator(".cast-row:has-text('Lone Bravo')").click({ modifiers: ["Control"] });
    await page.locator("[data-ui='CastMultiBar'] button:has-text('View relationship')").click();
    const pairView = page.locator("[data-ui='RelationshipPairView']");
    await expect(pairView).toContainText("No recorded bond");
    await pairView.locator("button:has-text('Record their relationship')").click();
    // Prefilled relationship editor opens.
    const editor = page.locator("[data-ui='EntityEditor']");
    await expect(editor).toBeVisible({ timeout: 4000 });
    await expect(editor).toContainText(/Relationship/i);
  });

  test("lock keeps the selection across panel close/reopen and full reloads", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "First Soul", data: {} }, { status: "active" });
    const keep = await saveEntity(page, "cast", { name: "Kept Soul", data: {} }, { status: "active" });

    await openPanel(page, "cast");
    await page.locator(".cast-row:has-text('Kept Soul')").click();
    // Lock via the panel-header lock button.
    const castPanel = page.locator(".pstk__panel[data-panel-id='p-cast']");
    await castPanel.locator("[data-callback='onLockSelection']").click();
    // Tray chip appears.
    const tray = page.locator("[data-ui='LockTray']");
    await expect(tray).toBeVisible();
    await expect(tray).toContainText("Kept Soul");
    // localStorage persisted.
    const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem("lw:v2:selection_locks") || "[]"));
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe(keep.id);

    // Close the panel, reopen → the locked entity is selected again.
    await castPanel.locator("[data-callback='onClosePanel']").click();
    await openPanel(page, "cast");
    await expect(page.locator(".pstk__panel[data-panel-id='p-cast']")).toContainText("Kept Soul");
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("Kept Soul", { timeout: 4000 });

    // Survives a full reload (no IDB clear).
    await openAppPreserveState(page);
    await expect(page.locator("[data-ui='LockTray']")).toContainText("Kept Soul", { timeout: 8000 });
    await openPanel(page, "cast");
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("Kept Soul", { timeout: 4000 });

    // Unlock from the tray removes the chip + storage.
    await page.locator("[data-ui='LockTray'] [data-callback='onUnlockEntity']").click();
    await expect(page.locator("[data-ui='LockTray']")).toHaveCount(0);
    const after = await page.evaluate(() => JSON.parse(window.localStorage.getItem("lw:v2:selection_locks") || "[]"));
    expect(after.length).toBe(0);
  });

  test("lock tray chip re-asserts the selection after picking another row", async ({ page }) => {
    await openFreshApp(page);
    const keep = await saveEntity(page, "cast", { name: "Anchor Soul", data: {} }, { status: "active" });
    await saveEntity(page, "cast", { name: "Drift Soul", data: {} }, { status: "active" });
    await openPanel(page, "cast");
    await page.locator(".cast-row:has-text('Anchor Soul')").click();
    await page.locator(".pstk__panel[data-panel-id='p-cast'] [data-callback='onLockSelection']").click();
    // Manual selection wins while the panel stays open…
    await page.locator(".cast-detail__back").click();
    await page.locator(".cast-row:has-text('Drift Soul')").click();
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("Drift Soul");
    // …until the tray chip re-asserts the lock.
    await page.locator("[data-ui='LockTray'] [data-callback='onFocusLockedEntity']").click();
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("Anchor Soul", { timeout: 4000 });
  });

  test("mobile: lock tray renders as a chips row above the bottom nav", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Pocket Hero", data: {} }, { status: "active" });
    await page.evaluate(() => {
      window.LoomwrightBackend.SelectionLockService.lockEntity({ id: "x", type: "cast", label: "Pocket Hero" });
    });
    const tray = page.locator("[data-ui='LockTray'].locktray--mobile");
    await expect(tray).toBeVisible({ timeout: 4000 });
    await expect(tray).toContainText("Cast");
    await expect(tray).toContainText("Pocket Hero");
    // Sits above the bottom nav (both visible, tray's bottom edge above nav's).
    const nav = page.locator("[data-ui='MobileBottomNav'], .mnav").first();
    await expect(nav).toBeVisible();
    const trayBox = await tray.boundingBox();
    const navBox = await nav.boundingBox();
    expect(trayBox.y + trayBox.height).toBeLessThanOrEqual(navBox.y + 2);
  });
});
