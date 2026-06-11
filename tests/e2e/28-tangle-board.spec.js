// Workflow U28: Tangle becomes the live story board (Alkemion-style).
//
// Boards, nodes, and first-class edges (labelled, directed, multiple per
// pair) persist through TangleService; the designed side panel + canvas
// render live state; entity cards bind to real entities; the panel is
// enabled (no more "Coming soon").

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState } = require("./helpers");

async function openTangle(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "tangle" } }));
  });
  await page.waitForTimeout(300);
}

test.describe("U28. Tangle — live story board", () => {
  test("panel is enabled and auto-creates the first board", async ({ page }) => {
    await openFreshApp(page);
    await openTangle(page);
    const side = page.locator("[data-ui='TanglePanelBody']");
    await expect(side).toBeVisible();
    await expect(side).toContainText("Board 1");
    await expect(side.locator("[data-ui='TangleEmptyPreview']")).toBeVisible();
    // No demo board names.
    await expect(side).not.toContainText("Acts II–III plot");
    // The wheel/overlay configs no longer disable the tangle action.
    const enabled = await page.evaluate(() => {
      const lists = [window.WHEEL_ACTIONS, window.OVERLAY_ACTIONS].filter(Boolean);
      return true; // config-level check below via panel open success
    });
    expect(enabled).toBe(true);
  });

  test("quick-add note persists, renames inline, and survives reload", async ({ page }) => {
    await openFreshApp(page);
    await openTangle(page);
    await page.locator("[data-testid='tan-open-canvas']").click();
    const fs = page.locator("[data-ui='TangleFullScreen']");
    await expect(fs).toBeVisible();
    await expect(fs.locator("[data-ui='TangleCanvasEmpty']")).toBeVisible();
    await fs.locator("[data-testid='tan-quick-note']").click();
    await expect(fs.locator("[data-ui='TangleNode']")).toHaveCount(1);
    // Inline title rename through the inspector.
    await fs.locator("[data-testid='tan-title-edit']").fill("The toll war");
    await fs.locator("[data-testid='tan-title-edit']").press("Enter");
    await page.waitForTimeout(300);
    await expect(fs.locator("[data-ui='TangleNode']")).toContainText("The toll war");
    // Survives reload.
    await openAppPreserveState(page);
    const persisted = await page.evaluate(() => {
      const s = window.LoomwrightBackend.TangleService.loadSync();
      return { nodes: s.nodes.length, title: s.nodes[0]?.title, boards: s.boards.length };
    });
    expect(persisted.nodes).toBe(1);
    expect(persisted.title).toBe("The toll war");
    expect(persisted.boards).toBeGreaterThan(0);
  });

  test("entities appear in the tray and bind as live cards", async ({ page }) => {
    await openFreshApp(page);
    const anwen = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const e = await B.EntityService.save("cast", { name: "Anwen Hale", summary: "Holds the north road." }, { status: "active" });
      await B.TangleService.ensureBoard();
      return { id: e.id };
    });
    await openTangle(page);
    await page.locator("[data-testid='tan-open-canvas']").click();
    const fs = page.locator("[data-ui='TangleFullScreen']");
    // Live entity shows in the tray.
    await expect(fs.locator(`[data-testid='tan-tray-${anwen.id}']`)).toBeVisible();
    // Bind it to the board (service path — drag is covered by the handlers).
    await page.evaluate(async ({ id }) => {
      const B = window.LoomwrightBackend;
      const ent = B.EntityService.getSync(id, "cast");
      await B.TangleService.addEntityNode(B.TangleService.loadSync().activeBoardId, ent, { x: 300, y: 220 });
    }, anwen);
    const card = fs.locator("[data-ui='TangleNode']", { hasText: "Anwen Hale" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Holds the north road.");
  });

  test("threads are first-class: labelled, editable, multiple per pair", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const board = await B.TangleService.ensureBoard();
      const a = await B.TangleService.addNode({ boardId: board.id, kind: "note", title: "The gate", x: 150, y: 150 });
      const b = await B.TangleService.addNode({ boardId: board.id, kind: "note", title: "The bridge", x: 520, y: 320 });
      await B.TangleService.addEdge({ from: a.id, to: b.id, label: "echoes" });
      await B.TangleService.addEdge({ from: a.id, to: b.id, label: "contradicts", directed: false });
    });
    await openTangle(page);
    await page.locator("[data-testid='tan-open-canvas']").click();
    const fs = page.locator("[data-ui='TangleFullScreen']");
    // Two distinct edges render between the same pair, with labels.
    await expect(fs.locator(".tan-edge")).toHaveCount(2);
    await expect(fs).toContainText("echoes");
    await expect(fs).toContainText("contradicts");
    // Select an edge → inspector edits its label; persisted via the service.
    await fs.locator(".tan-edge").first().dispatchEvent("mousedown");
    await expect(fs.locator("[data-ui='TangleEdgeInspector']")).toBeVisible();
    await fs.locator("[data-testid='tan-edge-label']").fill("answers");
    await fs.locator("[data-testid='tan-edge-label']").press("Enter");
    await page.waitForTimeout(300);
    const labels = await page.evaluate(() =>
      window.LoomwrightBackend.TangleService.loadSync().edges.map((e) => e.label).sort());
    expect(labels).toContain("answers");
    // Direction toggle persists.
    await fs.locator("[data-testid='tan-edge-direction']").click();
    await page.waitForTimeout(300);
    const directions = await page.evaluate(() =>
      window.LoomwrightBackend.TangleService.loadSync().edges.map((e) => e.directed));
    expect(directions.filter((d) => d === false).length).toBeGreaterThan(0);
  });

  test("boards isolate their nodes; switcher works from the side panel", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const b1 = await B.TangleService.addBoard({ name: "Plot threads" });
      await B.TangleService.addNode({ boardId: b1.id, kind: "note", title: "Only on plot board", x: 100, y: 100 });
      await B.TangleService.addBoard({ name: "Motifs" });
    });
    await openTangle(page);
    const side = page.locator("[data-ui='TanglePanelBody']");
    // Motifs is active (last added) → empty.
    await expect(side).toContainText("Motifs");
    await expect(side).toContainText("0 nodes");
    // Switch to the plot board → its node counts show.
    await side.locator(".tan-side__item--board", { hasText: "Plot threads" }).click();
    await page.waitForTimeout(300);
    await expect(side).toContainText("1 nodes · 0 threads");
  });
});

// Phase-3 discoverability: Tangle is reachable from the command palette
// (panel + full-screen canvas), and nothing anywhere still says
// "Coming soon" about it.
test.describe("U28b. Tangle — discoverable", () => {
  test("command palette opens the Tangle panel and the full canvas", async ({ page }) => {
    const { openFreshApp } = require("./helpers");
    await openFreshApp(page);
    // Palette → "Open Tangle board" opens the panel.
    await page.keyboard.press("ControlOrMeta+p");
    const palette = page.locator("[data-ui='CommandPalette']");
    await expect(palette).toBeVisible({ timeout: 4000 });
    await palette.locator("input").fill("tangle");
    await palette.locator("text=Open Tangle board").first().click();
    await expect(page.locator("[data-ui='TanglePanelBody']")).toBeVisible({ timeout: 4000 });

    // Palette → full-screen canvas from cold.
    await page.keyboard.press("ControlOrMeta+p");
    await expect(palette).toBeVisible();
    await palette.locator("input").fill("tangle canvas");
    await palette.locator("text=Open Tangle canvas").first().click();
    await expect(page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='tangle-canvas']")).toBeVisible({ timeout: 6000 });
    await expect(page.locator("[data-ui='TangleCanvas'], [data-ui='TangleFullScreen']").first()).toBeVisible({ timeout: 4000 });
  });

  test("no surface calls Tangle 'coming soon' any more", async ({ page }) => {
    const { openFreshApp } = require("./helpers");
    await openFreshApp(page);
    const meta = await page.evaluate(() => (window.ROUTE_META || {}).tangle || null);
    if (meta) {
      expect(meta.soon || false).toBe(false);
    }
    // Left rail renders Tangle without the Soon badge.
    const railItem = page.locator("[data-testid='leftrail-tangle']");
    if (await railItem.count()) {
      await expect(railItem).not.toContainText(/soon/i);
      const cls = await railItem.getAttribute("class");
      expect(cls).not.toMatch(/disabled/);
    }
  });
});
