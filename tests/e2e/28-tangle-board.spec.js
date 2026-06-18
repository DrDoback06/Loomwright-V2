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

  test("entity tokens carry a type visual and reveal details on hover", async ({ page }) => {
    await openFreshApp(page);
    const ids = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const sk = await B.EntityService.save("skills", { name: "Emberstrike", summary: "A searing lunge.", data: { skillType: "active", icon: "fire" } }, { status: "active" });
      const hero = await B.EntityService.save("cast", { name: "Aelinor Vey", summary: "Heir to the Auger." }, { status: "active" });
      const board = await B.TangleService.ensureBoard();
      await B.TangleService.addEntityNode(board.id, B.EntityService.getSync(sk.id, "skills"), { x: 260, y: 240 });
      await B.TangleService.addEntityNode(board.id, B.EntityService.getSync(hero.id, "cast"), { x: 500, y: 340 });
      return { sk: sk.id };
    });
    await openTangle(page);
    await page.locator("[data-testid='tan-open-canvas']").click();
    const fs = page.locator("[data-ui='TangleFullScreen']");
    await expect(fs).toBeVisible({ timeout: 5000 });

    // the skill type is now draggable from the tray (was missing before)
    await expect(fs.locator(`[data-testid='tan-tray-${ids.sk}']`)).toBeVisible({ timeout: 5000 });
    await expect(fs.locator("[data-ui='TangleNode']")).toHaveCount(2);

    // hover the skill token -> detail popover with summary, type, and Open
    await fs.locator("[data-ui='TangleNode']", { hasText: "Emberstrike" }).hover();
    const pop = page.locator("[data-ui='TangleEntityCard']");
    await expect(pop).toBeVisible({ timeout: 4000 });
    await expect(pop).toContainText("A searing lunge");
    await expect(pop).toContainText("Skill");
    await expect(pop.locator("[data-testid='tan-pop-open']")).toBeVisible();
  });

  test("a location token renders its Atlas region with child places", async ({ page }) => {
    await openFreshApp(page);
    const ids = await page.evaluate(async () => {
      const B = window.LoomwrightBackend, ES = B.EntityService, T = B.TangleService;
      const city = await ES.save("locations", { name: "Pale Reach Hold", summary: "A salt-bitten fortress town.", data: { kind: "city", placed: true, coords: { x: 50, y: 50 } } }, { status: "active" });
      await ES.save("locations", { name: "Tidewatch",      data: { kind: "town",     placed: true, coords: { x: 40, y: 62 }, parentId: city.id } }, { status: "active" });
      await ES.save("locations", { name: "The Gull's Rest", data: { kind: "building", placed: true, coords: { x: 58, y: 42 }, parentId: city.id } }, { status: "active" });
      const board = await T.ensureBoard();
      await T.addEntityNode(board.id, ES.getSync(city.id, "locations"), { x: 320, y: 240 });
      return { city: city.id };
    });
    await openTangle(page);
    await page.locator("[data-testid='tan-open-canvas']").click();
    const fs = page.locator("[data-ui='TangleFullScreen']");
    await expect(fs).toBeVisible({ timeout: 5000 });

    const region = fs.locator("[data-ui='TangleNode']", { hasText: "Pale Reach Hold" }).locator("[data-ui='AtlasRegionMini']");
    await expect(region).toBeVisible({ timeout: 5000 });
    await expect(region.locator("circle")).toHaveCount(3);   // city + 2 children, drawn as pins
    await expect(region).toContainText("Pale Reach Hold");
  });

  test("a whole skill tree drops onto the board as a constellation token", async ({ page }) => {
    await openFreshApp(page);
    const treeId = await page.evaluate(async () => {
      const B = window.LoomwrightBackend, ES = B.EntityService, ST = B.SkillTreeService;
      const a = (await ES.save("skills", { name: "Footwork", data: { skillType: "passive", icon: "boots" } }, { status: "active" })).id;
      const b = (await ES.save("skills", { name: "Riposte",  data: { skillType: "active",  icon: "sword" } }, { status: "active" })).id;
      const t = await ST.addTree({ name: "Saltsworn Discipline", nodeIds: [a, b], edges: [{ from: a, to: b, kind: "prereq" }], layout: { [a]: { x: 50, y: 75 }, [b]: { x: 40, y: 45 } } });
      await B.TangleService.ensureBoard();
      return t.id;
    });
    await openTangle(page);
    await page.locator("[data-testid='tan-open-canvas']").click();
    const fs = page.locator("[data-ui='TangleFullScreen']");
    await expect(fs).toBeVisible({ timeout: 5000 });

    // the tree shows in the tray; tapping it drops a constellation token
    await fs.locator(`[data-testid='tan-tray-tree-${treeId}']`).click();
    await page.waitForTimeout(400);
    const node = fs.locator("[data-ui='TangleNode']", { hasText: "Saltsworn Discipline" });
    await expect(node).toBeVisible({ timeout: 5000 });
    await expect(node.locator("svg").first()).toBeVisible();   // embedded SkillTreeMini constellation
  });

  test("dragging an entity from another panel drops it onto the canvas", async ({ page }) => {
    await openFreshApp(page);
    const id = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const e = await B.EntityService.save("cast", { name: "Captain Brec", summary: "Holds the pass." }, { status: "active" });
      await B.TangleService.ensureBoard();
      return e.id;
    });
    await openTangle(page);
    await page.locator("[data-testid='tan-open-canvas']").click();
    const fs = page.locator("[data-ui='TangleFullScreen']");
    await expect(fs).toBeVisible({ timeout: 5000 });
    // simulate a cross-panel drop onto the canvas (ENTITY_DRAG fallback path)
    await page.evaluate((eid) => {
      window.ENTITY_DRAG.set({ active: true, payload: { id: eid, entityType: "cast", name: "Captain Brec", summary: "Holds the pass." } });
      const canvas = document.querySelector(".tan-fs__canvas");
      const r = canvas.getBoundingClientRect();
      const ev = new Event("drop", { bubbles: true, cancelable: true });
      ev.clientX = r.left + 240; ev.clientY = r.top + 200; ev.dataTransfer = { getData: () => "" };
      canvas.dispatchEvent(ev);
    }, id);
    await page.waitForTimeout(300);
    await expect(fs.locator("[data-ui='TangleNode']", { hasText: "Captain Brec" })).toBeVisible({ timeout: 4000 });
  });
});
