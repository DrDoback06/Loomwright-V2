// Workflow T77: Atlas full map editor — Phase 1 (foundation).
// Locations can now carry a drawable region shape (data.shape: rect/circle/
// polygon/freehand) that renders as a filled, labelled area on the map; and
// locations created in the entity editor auto-appear in the editor's
// "Unplaced" tray to be selected and drawn.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openAtlasEditor(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "atlas" } })));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-existing-fullscreen", { detail: { workspaceId: "atlas-editor" } })));
}

test.describe("T77. Atlas editor — shapes + unplaced tray", () => {
  test("drawn shapes render on the map; new locations land in the unplaced tray", async ({ page }) => {
    await openFreshApp(page);
    const region = await saveEntity(page, "locations", {
      name: "The Pale Reach",
      data: { kind: "region", shape: { type: "rect", x: 18, y: 22, w: 34, h: 28 } },
    }, { status: "active" });
    const unplaced = await saveEntity(page, "locations", { name: "Hidden Vale", data: { kind: "hidden" } }, { status: "active" });

    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // the drawn region renders as a real shape (a <rect>), not just a point pin
    const shape = editor.locator(`[data-atm-shape='${region.id}']`);
    await expect(shape).toBeVisible({ timeout: 5000 });
    await expect(shape.locator("rect")).toHaveCount(1);
    // and the region is NOT rendered as a point pin (shape replaces the pin)
    await expect(editor.locator(`[data-atm-pin='${region.id}']`)).toHaveCount(0);

    // the unplaced, editor-created location auto-appears in the tray
    const tray = page.locator(`[data-atlas-unplaced='${unplaced.id}']`);
    await expect(tray).toBeVisible({ timeout: 5000 });
    await expect(tray).toContainText("Hidden Vale");

    // the shaped region is NOT also listed as unplaced (it's placed via its shape)
    await expect(page.locator(`[data-atlas-unplaced='${region.id}']`)).toHaveCount(0);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/atlas-editor.png" });
  });

  test("drawing a rectangle assigns a persisted shape to the selected place", async ({ page }) => {
    await openFreshApp(page);
    const loc = await saveEntity(page, "locations", { name: "Glass Court", data: { kind: "city" } }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // pick the unplaced place from the tray, then choose the Rect tool
    await page.locator(`[data-atlas-unplaced='${loc.id}']`).click();
    await page.locator("[data-testid='ae-tool-draw-rect']").click();

    // drag a rectangle on the editor canvas
    const svg = editor.locator(".atm__svg");
    const box = await svg.boundingBox();
    const x1 = box.x + box.width * 0.30, y1 = box.y + box.height * 0.30;
    const x2 = box.x + box.width * 0.62, y2 = box.y + box.height * 0.60;
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2);
    await page.mouse.move(x2, y2);
    await page.mouse.up();
    await page.waitForTimeout(400);

    // the drawn rectangle is persisted onto that location
    const shape = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "locations")?.data?.shape, loc.id);
    expect(shape && shape.type).toBe("rect");
    expect(shape.w).toBeGreaterThan(1);
    expect(shape.h).toBeGreaterThan(1);
    // and it now renders as a region (no longer in the unplaced tray)
    await expect(editor.locator(`[data-atm-shape='${loc.id}'] rect`)).toHaveCount(1);
    await expect(page.locator(`[data-atlas-unplaced='${loc.id}']`)).toHaveCount(0);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/atlas-draw.png" });
  });

  test("moving a selected region persists the new position", async ({ page }) => {
    await openFreshApp(page);
    const loc = await saveEntity(page, "locations", {
      name: "Vault", data: { kind: "building", shape: { type: "rect", x: 30, y: 35, w: 18, h: 18 } },
    }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    const rect = editor.locator(`[data-atm-shape='${loc.id}'] rect`);
    await expect(rect).toHaveCount(1);
    await rect.click();                 // select the region (handles appear)
    await page.waitForTimeout(150);

    // drag the body down-right to move it
    const box = await rect.boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 45);
    await page.mouse.move(cx + 95, cy + 65);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const shape = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "locations")?.data?.shape, loc.id);
    expect(shape.type).toBe("rect");
    expect(shape.x).toBeGreaterThan(31); // moved right
    expect(shape.y).toBeGreaterThan(36); // moved down
    expect(Math.round(shape.w)).toBe(18); // size preserved by a move
  });

  test("wheel zoom transforms the canvas; style toggle flips", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "locations", { name: "Anyplace", data: { kind: "city", shape: { type: "rect", x: 40, y: 40, w: 12, h: 12 } } }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    const contentG = editor.locator(".atm__svg > g").first();
    await expect(contentG).toHaveAttribute("transform", /scale\(1\)/);

    // wheel up over the canvas zooms in (real interaction, toolbar-independent)
    const svg = editor.locator(".atm__svg");
    const box = await svg.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -360);
    await page.waitForTimeout(150);
    const zoomed = await contentG.getAttribute("transform");
    expect(zoomed).not.toContain("scale(1)"); // zoomed past 1x

    // the parchment/clean style toggle flips state
    const styleBtn = editor.locator("[data-testid='ae-style-toggle']");
    const wasActive = await styleBtn.evaluate((el) => el.classList.contains("is-active"));
    await styleBtn.evaluate((el) => el.click());
    await page.waitForTimeout(100);
    const nowActive = await styleBtn.evaluate((el) => el.classList.contains("is-active"));
    expect(nowActive).toBe(!wasActive);
  });

  test("double-click drills into a place's interior; breadcrumb returns", async ({ page }) => {
    await openFreshApp(page);
    const court = await saveEntity(page, "locations", {
      name: "Glass Court", data: { kind: "building", shape: { type: "rect", x: 28, y: 28, w: 30, h: 30 } },
    }, { status: "active" });
    const hall = await saveEntity(page, "locations", {
      name: "Throne Hall",
      data: { kind: "room", atlasMap: court.id, parentId: court.id, shape: { type: "rect", x: 34, y: 34, w: 22, h: 22 } },
    }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // World map: the building shows; its interior room does NOT; no floor grid
    await expect(editor.locator(`[data-atm-shape='${court.id}']`)).toBeVisible({ timeout: 5000 });
    await expect(editor.locator(`[data-atm-shape='${hall.id}']`)).toHaveCount(0);
    await expect(editor.locator('.atm__svg [fill="url(#atm-floor)"]')).toHaveCount(0);

    // drill into the building
    await editor.locator(`[data-atm-shape='${court.id}']`).dblclick();
    await expect(editor.locator(`[data-atlas-crumb='${court.id}']`)).toBeVisible({ timeout: 5000 });
    // now the room shows; the building (parent map) does not; floor-plan backdrop appears
    await expect(editor.locator(`[data-atm-shape='${hall.id}']`)).toBeVisible({ timeout: 5000 });
    await expect(editor.locator(`[data-atm-shape='${court.id}']`)).toHaveCount(0);
    await expect(editor.locator('.atm__svg [fill="url(#atm-floor)"]').first()).toBeVisible({ timeout: 3000 });

    // breadcrumb back to the world
    await editor.locator("[data-atlas-crumb='world']").click();
    await expect(editor.locator(`[data-atm-shape='${court.id}']`)).toBeVisible({ timeout: 5000 });
    await expect(editor.locator(`[data-atm-shape='${hall.id}']`)).toHaveCount(0);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/atlas-drill.png" });
  });

  test("the Path tool draws an open (unfilled) river/road stroke", async ({ page }) => {
    await openFreshApp(page);
    const loc = await saveEntity(page, "locations", { name: "Salt River", data: { kind: "river" } }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    await page.locator(`[data-atlas-unplaced='${loc.id}']`).click();   // select the place
    await editor.locator("[data-testid='ae-tool-draw-path']").click(); // Path tool

    const svg = editor.locator(".atm__svg");
    const box = await svg.boundingBox();
    const x0 = box.x + box.width * 0.25, y0 = box.y + box.height * 0.45;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x0 + 60, y0 - 25);
    await page.mouse.move(x0 + 120, y0 + 30);
    await page.mouse.move(x0 + 180, y0 - 12);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const shape = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "locations")?.data?.shape, loc.id);
    expect(shape.type).toBe("path");
    expect(shape.points.length).toBeGreaterThanOrEqual(2);
    // an open line — no fill
    await expect(editor.locator(`[data-atm-shape='${loc.id}'] path`).first()).toHaveAttribute("fill", "none");
  });

  test("stamping an object from the palette drops a map symbol that persists", async ({ page }) => {
    await openFreshApp(page);
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // open the Stamps palette and arm the Castle stamp
    await editor.locator(".ae-rail__tab", { hasText: "Stamps" }).click();
    await expect(editor.locator("[data-ui='AtlasStampPalette']")).toBeVisible({ timeout: 3000 });
    await editor.locator("[data-testid='ae-stamp-castle']").click();

    // a stamp-mode hint confirms the tool is armed; drop it on empty parchment
    await expect(editor.locator("[data-ui='AtlasStampHint']")).toBeVisible({ timeout: 3000 });
    const svg = editor.locator(".atm__svg");
    const box = await svg.boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.waitForTimeout(400);

    // a placed location now carries data.symbol === "castle"
    const placed = await page.evaluate(() => {
      const list = window.LoomwrightBackend.EntityService.listSync("locations");
      return list.filter((l) => l.data && l.data.symbol === "castle")
                 .map((l) => ({ id: l.id, placed: l.data.placed === true, x: l.data.coords && l.data.coords.x }));
    });
    expect(placed.length).toBe(1);
    expect(placed[0].placed).toBe(true);
    expect(Number.isFinite(placed[0].x)).toBe(true);

    // it renders as an object stamp (its motif), not a plain point pin
    await expect(editor.locator(`[data-atm-symbol='${placed[0].id}']`)).toBeVisible({ timeout: 5000 });
    await expect(editor.locator(`[data-atm-pin='${placed[0].id}']`)).toHaveCount(0);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/atlas-stamp.png" });
  });

  test("a placed object stamp resizes from its corner handle", async ({ page }) => {
    await openFreshApp(page);
    const loc = await saveEntity(page, "locations", {
      name: "Lone Tower",
      data: { placed: true, symbol: "tower", symbolSize: 1, coords: { x: 50, y: 45 }, kind: "building" },
    }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    const sym = editor.locator(`[data-atm-symbol='${loc.id}']`);
    await expect(sym).toBeVisible({ timeout: 5000 });

    // select it (default Select tool) so the resize handle appears
    await sym.click();
    await page.waitForTimeout(150);
    const handle = editor.locator("[data-atm-handle='symbol-size']");
    await expect(handle).toBeVisible({ timeout: 3000 });

    // drag the corner handle outward to grow the stamp
    const hb = await handle.boundingBox();
    const hx = hb.x + hb.width / 2, hy = hb.y + hb.height / 2;
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(hx + 50, hy - 30);
    await page.mouse.move(hx + 95, hy - 60);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const size = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "locations")?.data?.symbolSize, loc.id);
    expect(size).toBeGreaterThan(1.2);
  });

  test("the empty-map prompt conjures a full demo world (every element)", async ({ page }) => {
    await openFreshApp(page);
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // the empty plate offers a one-click example world
    await expect(editor.locator("[data-ui='AtlasSeedDemo']")).toBeVisible({ timeout: 5000 });
    await editor.locator("[data-ui='AtlasSeedDemo']").click();
    await page.waitForTimeout(800);

    // the seed exercises every element: drawn regions, object stamps,
    // road/sea routes, and a drilled-down interior.
    const stats = await page.evaluate(() => {
      const list = window.LoomwrightBackend.EntityService.listSync("locations");
      return {
        total: list.length,
        withShape: list.filter((l) => l.data && l.data.shape).length,
        withSymbol: list.filter((l) => l.data && l.data.symbol).length,
        interior: list.filter((l) => l.data && l.data.atlasMap && l.data.atlasMap !== "world").length,
        withRoutes: list.filter((l) => l.data && Array.isArray(l.data.routes) && l.data.routes.length).length,
      };
    });
    expect(stats.total).toBeGreaterThanOrEqual(60);
    expect(stats.withShape).toBeGreaterThanOrEqual(10);  // regions + rivers/roads + rooms
    expect(stats.withSymbol).toBeGreaterThanOrEqual(30); // object stamps
    expect(stats.interior).toBeGreaterThanOrEqual(7);    // castle rooms + interior stamps
    expect(stats.withRoutes).toBeGreaterThanOrEqual(3);  // road/sea connections

    // re-conjuring is idempotent (stable ids) — no duplicate world
    await page.evaluate(() => window.AtlasSampleWorld.seed());
    await page.waitForTimeout(500);
    const total2 = await page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("locations").length);
    expect(total2).toBe(stats.total);

    // a known landmark renders as a stamp; drilling in reveals its interior
    const cap = await page.evaluate(() => (window.LoomwrightBackend.EntityService.listSync("locations").find((l) => l.name === "Aldercrown") || {}).id);
    await expect(editor.locator(`[data-atm-symbol='${cap}']`)).toBeVisible({ timeout: 5000 });
    await editor.locator(`[data-atm-symbol='${cap}']`).dblclick();
    await expect(editor.locator(`[data-atlas-crumb='${cap}']`)).toBeVisible({ timeout: 5000 });
    await expect(editor.locator('.atm__svg [fill="url(#atm-floor)"]').first()).toBeVisible({ timeout: 3000 });
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/atlas-demo-world.png" });
  });

  test("the demo world can be cleared from the canvas bar", async ({ page }) => {
    await openFreshApp(page);
    page.on("dialog", (d) => d.accept());
    await page.evaluate(() => window.AtlasSampleWorld.seed());
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    await expect(editor.locator("[data-ui='AtlasDemoBar']")).toBeVisible({ timeout: 5000 });
    await editor.locator("[data-testid='ae-clear-demo']").click();
    await page.waitForTimeout(500);

    const left = await page.evaluate(() => window.AtlasSampleWorld.exists());
    expect(left).toBe(false);
    await expect(editor.locator("[data-ui='AtlasDemoBar']")).toHaveCount(0);
    // back to the empty-plate prompt
    await expect(editor.locator("[data-ui='AtlasSeedDemo']")).toBeVisible({ timeout: 5000 });
  });

  // pct (0-100) → screen point, mirroring the SVG xMidYMid-meet letterbox
  // (editor opens at view z=1,x=0,y=0 so no zoom/pan inversion needed).
  function pctToScreen(svgBox, xPct, yPct) {
    const scale = Math.min(svgBox.width / 1200, svgBox.height / 700);
    const ox = (svgBox.width - 1200 * scale) / 2, oy = (svgBox.height - 700 * scale) / 2;
    return { x: svgBox.x + ox + (xPct / 100) * 1200 * scale, y: svgBox.y + oy + (yPct / 100) * 700 * scale };
  }

  test("marquee selects multiple stamps; a group drag moves them together", async ({ page }) => {
    await openFreshApp(page);
    const A = await saveEntity(page, "locations", { name: "Aaa", data: { placed: true, symbol: "castle", symbolSize: 1.4, coords: { x: 30, y: 40 }, kind: "building" } }, { status: "active" });
    const B = await saveEntity(page, "locations", { name: "Bbb", data: { placed: true, symbol: "castle", symbolSize: 1.4, coords: { x: 44, y: 46 }, kind: "building" } }, { status: "active" });
    const C = await saveEntity(page, "locations", { name: "Ccc", data: { placed: true, symbol: "castle", symbolSize: 1.4, coords: { x: 82, y: 82 }, kind: "building" } }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });
    const svgBox = await editor.locator(".atm__svg").boundingBox();

    // marquee from empty (15,25) to (55,58) — encloses A & B anchors, not C
    const s = pctToScreen(svgBox, 15, 25), e = pctToScreen(svgBox, 55, 58);
    await page.mouse.move(s.x, s.y);
    await page.mouse.down();
    await page.mouse.move(e.x, e.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // grab A (at its anchor = motif centre) and drag the group down-right
    const a0 = pctToScreen(svgBox, 30, 40);
    await page.mouse.move(a0.x, a0.y);
    await page.mouse.down();
    await page.mouse.move(a0.x + 60, a0.y + 45);
    await page.mouse.move(a0.x + 110, a0.y + 80);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const co = await page.evaluate((ids) => {
      const g = (id) => window.LoomwrightBackend.EntityService.getSync(id, "locations").data.coords;
      return { a: g(ids.a), b: g(ids.b), c: g(ids.c) };
    }, { a: A.id, b: B.id, c: C.id });
    expect(co.a.x).toBeGreaterThan(31);  // A moved right
    expect(co.b.x).toBeGreaterThan(45);  // B moved right with the group
    expect(co.a.y).toBeGreaterThan(41);  // moved down
    expect(Math.round(co.c.x)).toBe(82); // C untouched
  });

  test("Delete key removes a marquee selection; Ctrl+C / Ctrl+V duplicates", async ({ page }) => {
    await openFreshApp(page);
    const A = await saveEntity(page, "locations", { name: "Del A", data: { placed: true, symbol: "tower", symbolSize: 1.3, coords: { x: 32, y: 40 }, kind: "building" } }, { status: "active" });
    const B = await saveEntity(page, "locations", { name: "Del B", data: { placed: true, symbol: "tower", symbolSize: 1.3, coords: { x: 46, y: 46 }, kind: "building" } }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });
    const svgBox = await editor.locator(".atm__svg").boundingBox();
    const activeCount = () => page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("locations").filter((l) => l.status !== "deleted").length);

    // copy/paste a single click-selected stamp first
    const a0 = pctToScreen(svgBox, 32, 40);
    await page.mouse.click(a0.x, a0.y);
    await page.waitForTimeout(150);
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    await page.waitForTimeout(400);
    expect(await activeCount()).toBe(3); // A, B, + one copy

    // marquee both originals + the copy region, then Delete
    const s = pctToScreen(svgBox, 18, 26), e = pctToScreen(svgBox, 60, 60);
    await page.mouse.move(s.x, s.y);
    await page.mouse.down();
    await page.mouse.move(e.x, e.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(400);

    // both originals are gone from the map
    await expect(editor.locator(`[data-atm-symbol='${A.id}']`)).toHaveCount(0);
    await expect(editor.locator(`[data-atm-symbol='${B.id}']`)).toHaveCount(0);
  });

  test("the inspector Delete button removes an individual place", async ({ page }) => {
    await openFreshApp(page);
    page.on("dialog", (d) => d.accept());
    const loc = await saveEntity(page, "locations", { name: "Doomed Keep", data: { placed: true, symbol: "castle", symbolSize: 1.4, coords: { x: 50, y: 45 }, kind: "building" } }, { status: "active" });
    await openAtlasEditor(page);
    const editor = page.locator("[data-ui='AtlasEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    await editor.locator(`[data-atm-symbol='${loc.id}']`).click();
    await page.waitForTimeout(150);
    await expect(editor.locator("[data-testid='ae-insp-delete']")).toBeVisible({ timeout: 3000 });
    await editor.locator("[data-testid='ae-insp-delete']").click();
    await page.waitForTimeout(400);

    await expect(editor.locator(`[data-atm-symbol='${loc.id}']`)).toHaveCount(0);
    const status = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "locations")?.status, loc.id);
    expect(status).toBe("deleted");
  });
});
