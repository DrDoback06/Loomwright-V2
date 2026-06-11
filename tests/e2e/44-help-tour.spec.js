// Workflow T44: The help system — a persistent "?" on every chrome
// (topbar, panel headers, workspace topbars, mobile More sheet), a
// per-surface help panel listing the REAL controls, and a guided
// coachmark tour over the live DOM. Deterministic, zero-token,
// seen-state persisted.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.describe("T44. Help panel + guided tour", () => {
  test("'?' is present on topbar, panel header, and workspace topbar; overlay lists real controls", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Helped Hero", data: {} }, { status: "active" });

    // The topbar "?" helps with what you're LOOKING at: the front panel
    // when one is open, else the route. Close the default panels first so
    // the route topic is the deterministic answer.
    for (const id of ["p-locations", "p-quests", "p-tangle"]) {
      const btn = page.locator(`.pstk__panel[data-panel-id='${id}'] [data-callback='onClosePanel']`);
      if (await btn.count()) await btn.click();
    }
    await expect(page.locator(".topbar .helpbtn")).toBeVisible();
    await page.locator(".topbar .helpbtn").click();
    const overlay = page.locator("[data-ui='HelpOverlay']");
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText(/Writer's Room|Home|Today/);
    await page.keyboard.press("Escape");
    await expect(overlay).toHaveCount(0);

    // Panel header "?" opens the panel's topic with its real controls.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
    await page.waitForTimeout(250);
    await page.locator(".pstk__panel[data-panel-id='p-cast'] .helpbtn").click();
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText("Cast");
    // ≥3 real controls listed, each named after an actual affordance.
    const controls = overlay.locator(".help-overlay__control");
    expect(await controls.count()).toBeGreaterThanOrEqual(3);
    await expect(overlay).toContainText("Lock selection");
    await expect(overlay).toContainText("Open workspace");
    await page.keyboard.press("Escape");

    // Workspace topbar "?" resolves the open workspace's topic.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", { detail: { workspaceId: "cast-dossier", panelKind: "cast", sourcePanel: "p-cast" } }));
    });
    await expect(page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='cast-dossier']")).toBeVisible({ timeout: 5000 });
    await page.locator(".fws-topbar .helpbtn").click();
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText("Cast Dossier");
    await expect(overlay).toContainText("Full record");
  });

  test("every nav surface and registered workspace has a help entry (no orphan pages)", async ({ page }) => {
    await openFreshApp(page);
    const missing = await page.evaluate(() => {
      const reg = window.HELP_CONTENT || {};
      const out = [];
      for (const n of window.NAV_ITEMS || []) {
        const id = n.kind === "route" ? "route:" + n.id : "panel:" + (n.panelKind || n.entity || n.id);
        // Settings route opens the control-centre workspace topic instead.
        if (n.id === "settings") continue;
        if (!reg[id]) out.push(id);
      }
      for (const [kind, acc] of Object.entries(window.PANEL_ACCESS || {})) {
        if (acc && acc.workspaceId && acc.workspaceMode !== "existing" && !reg["workspace:" + acc.workspaceId]) {
          out.push("workspace:" + acc.workspaceId);
        }
      }
      return out;
    });
    expect(missing, "surfaces without help entries: " + missing.join(", ")).toHaveLength(0);
  });

  test("guided tour spotlights the real controls and remembers completion", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Tour Hero", data: {} }, { status: "active" });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
    await page.waitForTimeout(250);
    await page.locator(".pstk__panel[data-panel-id='p-cast'] .helpbtn").click();
    const overlay = page.locator("[data-ui='HelpOverlay']");
    await expect(overlay).toBeVisible();
    await overlay.locator("[data-callback='onStartHelpTour']").click();

    const tour = page.locator("[data-ui='CoachmarkTour']");
    await expect(tour).toBeVisible();
    const card = page.locator("[data-testid='help-tour-card']");
    await expect(card).toContainText("1 /");
    await expect(card).toContainText("The roster");
    // The spotlight ring tracks the real target's rect.
    const ring = page.locator(".help-tour__ring");
    await expect(ring).toBeVisible();
    const ringBox = await ring.boundingBox();
    const targetBox = await page.locator(".cast-row").first().boundingBox();
    expect(Math.abs(ringBox.x + 8 - targetBox.x)).toBeLessThan(30);

    // Walk to the end.
    await card.locator("[data-callback='onTourNext']").click();
    await expect(card).toContainText("2 /");
    await card.locator("[data-callback='onTourNext']").click();
    await card.locator("[data-callback='onTourDone']").click();
    await expect(tour).toHaveCount(0);

    // Seen-state persisted with tour completion.
    const seen = await page.evaluate(() => JSON.parse(window.localStorage.getItem("lw:v2:help_seen") || "{}"));
    expect(seen["panel:cast"]).toBeTruthy();
    expect(seen["panel:cast"].tourDone).toBeTruthy();
  });

  test("mobile: Help lives in the More sheet and opens as a bottom sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFreshApp(page);
    await page.locator("[data-testid='mnav-more']").first().click();
    await page.locator("[data-testid='mnav-more-help']").click();
    const overlay = page.locator("[data-ui='HelpOverlay']");
    await expect(overlay).toBeVisible({ timeout: 4000 });
    // Bottom-sheet presentation: the card hugs the bottom edge.
    const box = await overlay.locator(".help-overlay__card").boundingBox();
    expect(box.y + box.height).toBeGreaterThan(800);
  });
});
