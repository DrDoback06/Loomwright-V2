// Workflow T25: Area 8 — the Skill Tree constellation canvas.
//
// The skill-tree panel was already live (SkillTreeLiveManager over
// SkillTreeService + skills entities); the one deferred piece was the visual
// drag-and-drop constellation canvas. This adds it: nodes render at their
// persisted layout positions, edges draw between connected nodes, dragging a
// star repositions it and persists via SkillTreeService.updateNodePosition,
// and tapping a star selects it (or completes an armed connection).

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openSkillsPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "skillTrees" } })));
  await page.waitForTimeout(300);
}

async function createTreeWithNodes(page, n) {
  await page.locator("[data-testid='st-create-tree']").dispatchEvent("click");
  await expect(page.locator("[data-testid='st-add-node']")).toBeVisible({ timeout: 5000 });
  for (let i = 0; i < n; i++) {
    await page.locator("[data-testid='st-add-node']").dispatchEvent("click");
    await page.waitForTimeout(200);
  }
}

const treeState = (page) => page.evaluate(() => window.LoomwrightBackend.SkillTreeService.loadSync().trees[0]);

test.describe("T25. Skill Tree constellation canvas", () => {
  test("nodes render as stars on the live canvas", async ({ page }) => {
    await openFreshApp(page);
    await openSkillsPanel(page);
    await createTreeWithNodes(page, 2);
    const t = await treeState(page);
    await expect(page.locator("[data-testid='st-constellation']")).toBeVisible({ timeout: 5000 });
    for (const id of t.nodeIds) {
      await expect(page.locator("[data-testid='st-star-" + id + "']")).toBeVisible();
    }
  });

  test("dragging a star repositions it and persists the new position", async ({ page }) => {
    await openFreshApp(page);
    await openSkillsPanel(page);
    await createTreeWithNodes(page, 1);
    const t0 = await treeState(page);
    const id = t0.nodeIds[0];
    const before = t0.layout[id];
    const star = page.locator("[data-testid='st-star-" + id + "']");
    const box = await star.boundingBox();
    expect(box).toBeTruthy();
    // Drag the star ~180px right / 40px down (real pointer events via the mouse).
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 50, { steps: 8 });
    await page.mouse.move(cx + 180, cy + 40, { steps: 8 });
    await page.mouse.up();
    // The new position persisted, and it actually moved.
    await expect.poll(async () => {
      const t = await treeState(page);
      const p = t.layout[id] || {};
      return (Math.abs((p.x || 0) - (before.x || 0)) > 1) || (Math.abs((p.y || 0) - (before.y || 0)) > 1);
    }, { timeout: 5000 }).toBe(true);
  });

  test("tapping a star while a connection is armed links the two nodes", async ({ page }) => {
    await openFreshApp(page);
    await openSkillsPanel(page);
    await createTreeWithNodes(page, 2);
    const t0 = await treeState(page);
    const [a, b] = t0.nodeIds;
    expect(t0.edges.length).toBe(0);
    // Arm a connection from node A via its list-row Connect button.
    await page.locator("[data-testid='st-connect-" + a + "']").dispatchEvent("click");
    // Tap node B's star on the canvas → the edge is created + persisted.
    await page.locator("[data-testid='st-star-" + b + "']").click();
    await expect.poll(async () => (await treeState(page)).edges.length, { timeout: 5000 }).toBe(1);
    const t1 = await treeState(page);
    expect(t1.edges[0].from).toBe(a);
    expect(t1.edges[0].to).toBe(b);
  });
});
