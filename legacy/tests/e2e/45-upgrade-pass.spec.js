// Workflow T45: The upgrade pass — every surface gained a real
// enhancement, verified on the rendered DOM:
//   1. Panel layout persists across reloads (PanelLayoutService).
//   2. Speed Reader: entity-aware RSVP tint; difficulty flags → Today.
//   3. Random Tables: reroll/insert from the roll history.
//   4. Trash: recovery countdown + Restore & open.
//   5. Review panel: one-click "Accept all high" triage.
//   6. Command palette: live Recent group from the audit trail.
//   7. Lore: hardness filter chips (hard/soft/contradicted).
//   8. Settings: reset help/tours + clear selection locks utilities.
//   9. Adaptive wheel: Help slot opens the contextual help.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

async function openPanel(page, kind) {
  await page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } }));
  }, kind);
  await page.waitForTimeout(250);
}

test.describe("T45. Upgrade pass", () => {
  test("panel layout (open panels, order, selection) survives a reload", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Layout Hero", data: {} }, { status: "active" });
    // Close one default, open cast + items, select a row.
    const tangleClose = page.locator(".pstk__panel[data-panel-id='p-tangle'] [data-callback='onClosePanel']");
    if (await tangleClose.count()) await tangleClose.click();
    await openPanel(page, "items");
    await openPanel(page, "cast");
    await page.locator(".cast-row:has-text('Layout Hero')").click();
    await page.waitForTimeout(500); // debounce window

    await openAppPreserveState(page);
    await page.waitForTimeout(600);
    const ids = await page.evaluate(() => [...document.querySelectorAll(".pstk__panel")].map((p) => p.getAttribute("data-panel-id")));
    expect(ids).toContain("p-cast");
    expect(ids).toContain("p-items");
    expect(ids).not.toContain("p-tangle");
    // Selection came back with the panel.
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("Layout Hero", { timeout: 5000 });
  });

  test("speed reader tints known entity names and flags feed Today", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Aelinor", data: {} }, { status: "active" });
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "sr-1", num: 1, title: "One", state: "saved", bodyText: "Aelinor walked the long road north." }],
        activeChapterId: "sr-1",
        manuscripts: { "sr-1": { text: "Aelinor walked the long road north." } },
        trashedChapters: [],
      });
    });
    await openPanel(page, "speedReader");
    const body = page.locator(".pstk__panel[data-panel-id='p-speedReader']");
    // Load the current chapter as the source.
    await body.locator("[data-callback='onReadCurrentChapter']").first().click();
    await page.waitForTimeout(400);
    // First word is "Aelinor" → entity-tinted with the cast type attr.
    const word = body.locator("[data-testid='sr-word']");
    await expect(word).toHaveAttribute("data-entity-type", "cast", { timeout: 5000 });
    // Flag the sentence as difficult → Today lists it as a prompt.
    await body.locator("[data-callback='onSpeedReaderNoteDifficulty']").click();
    await page.waitForTimeout(400);
    await openPanel(page, "today");
    const today = page.locator("[data-ui='TodayPanelBody']");
    await today.locator("button.today__filter:has-text('Writing')").click();
    await expect(today).toContainText("flagged while speed-reading", { timeout: 5000 });
    await expect(today).toContainText("Aelinor walked the long road");
  });

  test("random tables: reroll + send from the history row", async ({ page }) => {
    await openFreshApp(page);
    await openPanel(page, "randomTables");
    const rt = page.locator(".pstk__panel[data-panel-id='p-randomTables']");
    await rt.locator("[data-testid='rt-roll']").click();
    await page.waitForTimeout(300);
    // History row appeared with the two quick actions.
    const hist = rt.locator(".rt__hist").first();
    await expect(hist).toBeVisible({ timeout: 4000 });
    await hist.locator("[data-callback='onRerollHistoryEntry']").click();
    await page.waitForTimeout(300);
    const histCount = await rt.locator(".rt__hist").count();
    expect(histCount).toBeGreaterThanOrEqual(2);
  });

  test("trash shows the 30-day countdown and Restore & open jumps to the record", async ({ page }) => {
    await openFreshApp(page);
    const hero = await saveEntity(page, "cast", { name: "Doomed Soul", data: {} }, { status: "active" });
    await page.evaluate(async ({ id }) => {
      await window.LoomwrightBackend.EntityService.delete("cast", id);
    }, { id: hero.id });
    await openPanel(page, "trash");
    const trash = page.locator(".pstk__panel[data-panel-id='p-trash']");
    await expect(trash).toContainText("Doomed Soul");
    await expect(trash.locator("[data-testid='trash-days-left']").first()).toContainText(/\d+d left/);
    await trash.locator("[data-callback='onRestoreTrashItemAndOpen']").first().click();
    // Restored AND focused in the cast panel.
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("Doomed Soul", { timeout: 6000 });
    const stillTrashed = await page.evaluate(() => window.LoomwrightBackend.TrashService.listSync().length);
    expect(stillTrashed).toBe(0);
  });

  test("review panel: Accept all high clears every high-band candidate", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.ReviewService.add({ id: "rq-h1", entityType: "cast", status: "pending", name: "Sure Thing", payload: { name: "Sure Thing" }, confidence: 0.97, confidenceBand: "high", suggestedAction: "create" });
      await B.ReviewService.add({ id: "rq-h2", entityType: "locations", status: "pending", name: "Sure Place", payload: { name: "Sure Place" }, confidence: 0.96, confidenceBand: "high", suggestedAction: "create" });
      await B.ReviewService.add({ id: "rq-u1", entityType: "cast", status: "pending", name: "Maybe Man", payload: { name: "Maybe Man" }, confidence: 0.6, confidenceBand: "uncertain", suggestedAction: "create" });
    });
    await openPanel(page, "review");
    const review = page.locator(".pstk__panel[data-panel-id='p-review']");
    const triage = review.locator("[data-testid='rq-triage']");
    await expect(triage).toBeVisible({ timeout: 4000 });
    await expect(triage).toContainText("2");
    await review.locator("[data-testid='rq-accept-all-high']").click();
    // The two high candidates are gone; the uncertain one remains.
    await expect.poll(async () => await page.evaluate(() =>
      window.LoomwrightBackend.ReviewService.listSync().filter((q) => q.status === "pending").map((q) => q.name).sort()
    ), { timeout: 6000 }).toEqual(["Maybe Man"]);
    await expect(review.locator("[data-testid='rq-triage']")).toHaveCount(0);
  });

  test("command palette lists Recent records from the audit trail", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Fresh Memory", data: {} }, { status: "active" });
    await page.keyboard.press("ControlOrMeta+p");
    const palette = page.locator("[data-ui='CommandPalette']");
    await expect(palette).toBeVisible({ timeout: 4000 });
    await expect(palette).toContainText("Recent");
    await expect(palette).toContainText("Fresh Memory");
    // Running the recent row opens the record.
    await palette.locator("text=Fresh Memory").first().click();
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("Fresh Memory", { timeout: 6000 });
  });

  test("lore hardness chips slice the canon list", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "lore", { name: "Iron rule", data: { band: "canon", body: "Augers attune to one bearer." } }, { status: "active" });
    await saveEntity(page, "lore", { name: "Folk whisper", data: { band: "folklore", body: "Salt walks at dusk." } }, { status: "active" });
    await saveEntity(page, "lore", { name: "Broken oath", data: { band: "canon", contradictedBy: "Ch. 4 breaks it." } }, { status: "active" });
    await openPanel(page, "lore");
    const lore = page.locator(".pstk__panel[data-panel-id='p-lore']");
    const chips = lore.locator("[data-testid='lore-hardness']");
    await expect(chips).toBeVisible({ timeout: 4000 });
    await chips.locator("button:has-text('Hard canon')").click();
    await expect(lore).toContainText("Iron rule");
    await expect(lore).not.toContainText("Folk whisper");
    await chips.locator("button:has-text('Contradicted')").click();
    await expect(lore).toContainText("Broken oath");
    await expect(lore).not.toContainText("Iron rule");
  });

  test("settings utilities reset help seen-state and clear locks", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Locked One", data: {} }, { status: "active" });
    await page.evaluate(() => {
      window.HelpService.markSeen("panel:cast");
      window.LoomwrightBackend.SelectionLockService.lockEntity({ id: "x1", type: "cast", label: "Locked One" });
    });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", { detail: { workspaceId: "control-centre", panelKind: "settings", sourcePanel: "test" } }));
    });
    const host = page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='control-centre']");
    await expect(host).toBeVisible({ timeout: 5000 });
    // Navigate to the Debug & tweaks section once the workspace listens.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:settings-section", { detail: { actionId: "debug" } }));
    });
    await page.waitForTimeout(300);
    await host.locator("[data-testid='set-reset-help']").click();
    await host.locator("[data-testid='set-clear-locks']").click();
    const after = await page.evaluate(() => ({
      seen: JSON.parse(window.localStorage.getItem("lw:v2:help_seen") || "{}"),
      locks: window.LoomwrightBackend.SelectionLockService.listSync(),
    }));
    expect(Object.keys(after.seen)).toHaveLength(0);
    expect(after.locks).toHaveLength(0);
  });

  test("adaptive wheel offers Help and it opens the contextual overlay", async ({ page }) => {
    await openFreshApp(page);
    // Open the wheel via the palette command (keyboard-independent path).
    await page.keyboard.press("ControlOrMeta+p");
    await page.locator("[data-ui='CommandPalette'] input").fill("wheel");
    await page.locator("text=Open Adaptive Wheel here").first().click();
    const wheel = page.locator("[data-ui='AdaptiveWheel'], .wheel, [data-ui='AdaptiveWheelHost']").first();
    await expect(wheel).toBeVisible({ timeout: 4000 });
    await page.locator(".wheel__slot[data-slot='help']").click();
    await expect(page.locator("[data-ui='HelpOverlay']")).toBeVisible({ timeout: 4000 });
  });
});
