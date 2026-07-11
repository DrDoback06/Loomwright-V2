// Workflow AC — Persistent live Tangle boards and canonical entity nodes.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedTangleProject(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    await B.EntityService.save("cast", {
      id: "ac-mara", name: "Mara Vale", data: { summary: "A courier carrying an inherited debt." },
    }, { status: "active" });
    await B.EntityService.save("items", {
      id: "ac-key", name: "Witness Key", data: { summary: "Records every transfer." },
    }, { status: "active" });
    await B.EntityService.save("locations", {
      id: "ac-court", name: "Lantern Court", data: { summary: "Neutral ritual ground." },
    }, { status: "active" });
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
  });
}

async function openTangle(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "tangle" } })));
  const tangle = page.locator("[data-testid='live-tangle-workspace']");
  await expect(tangle).toBeVisible({ timeout: 10000 });
  return tangle;
}

async function nodeIdForEntity(page, entityId) {
  return page.evaluate((id) => window.LoomwrightBackend.LiveTangleService.buildWorkspace().nodes.find((node) => node.entityId === id)?.id || null, entityId);
}

async function latestPlanningNodeId(page, title) {
  return page.evaluate((wanted) => {
    const nodes = window.LoomwrightBackend.LiveTangleService.buildWorkspace().nodes.filter((node) => !node.entityId);
    return [...nodes].reverse().find((node) => node.title === wanted)?.id || nodes.at(-1)?.id || null;
  }, title);
}

test.describe("AC. Live Tangle boards", () => {
  test("uses canonical entities, persists notes, links, groups, movement and promotion without sample leakage", async ({ page }) => {
    await openFreshApp(page);
    await seedTangleProject(page);
    const tangle = await openTangle(page);

    await expect(tangle.locator("[data-testid='live-tangle-empty']")).toBeVisible();
    await expect(tangle).not.toContainText("Aelinor");
    await expect(tangle).not.toContainText("Pale Reach");

    await tangle.locator("[data-testid='live-tangle-tray-ac-mara']").click();
    await tangle.locator("[data-testid='live-tangle-tray-ac-key']").click();
    const maraNodeId = await nodeIdForEntity(page, "ac-mara");
    const keyNodeId = await nodeIdForEntity(page, "ac-key");
    expect(maraNodeId).toBeTruthy();
    expect(keyNodeId).toBeTruthy();
    await expect(tangle.locator(`[data-testid='live-tangle-node-${maraNodeId}']`)).toContainText("Mara Vale");
    await expect(tangle.locator(`[data-testid='live-tangle-node-${keyNodeId}']`)).toContainText("Witness Key");

    await page.evaluate(async () => {
      await window.LoomwrightBackend.EntityService.update("cast", "ac-mara", { data: { summary: "A courier who now distrusts the court." } });
      window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    });
    await expect(tangle.locator(`[data-testid='live-tangle-node-${maraNodeId}']`)).toContainText("distrusts the court");

    await tangle.locator("[data-testid='live-tangle-new-note']").click();
    const noteId = await latestPlanningNodeId(page, "New note");
    expect(noteId).toBeTruthy();
    const inspector = tangle.locator(`[data-testid='live-tangle-inspector-${noteId}']`);
    await expect(inspector).toBeVisible();
    await inspector.locator("[data-testid='live-tangle-inspector-title']").fill("The missing oath");
    await inspector.locator("[data-testid='live-tangle-inspector-body']").fill("Decide who broke the first promise.");
    await inspector.locator("[data-testid='live-tangle-inspector-save']").click();
    await expect(tangle.locator(`[data-testid='live-tangle-node-${noteId}']`)).toContainText("The missing oath");

    const note = tangle.locator(`[data-testid='live-tangle-node-${noteId}']`);
    const before = await page.evaluate((id) => {
      const row = window.LoomwrightBackend.LiveTangleService.loadStateSync().nodes.find((node) => node.id === id);
      return { x: row.x, y: row.y };
    }, noteId);
    const box = await note.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + 50, box.y + 45);
    await page.mouse.down();
    await page.mouse.move(box.x + 180, box.y + 120, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(({ id, x, y }) => {
      const row = window.LoomwrightBackend.LiveTangleService.loadStateSync().nodes.find((node) => node.id === id);
      return row && (row.x !== x || row.y !== y);
    }, { id: noteId, ...before });

    await tangle.locator(`[data-testid='live-tangle-node-${maraNodeId}']`).click();
    await tangle.locator("[data-testid='live-tangle-connect']").click();
    await tangle.getByLabel("Connection label").fill("carries");
    await tangle.locator(`[data-testid='live-tangle-node-${keyNodeId}']`).click();
    await page.waitForFunction(({ from, to }) => window.LoomwrightBackend.LiveTangleService.loadStateSync().edges.some((edge) => edge.from === from && edge.to === to && edge.label === "carries"), { from: maraNodeId, to: keyNodeId });

    await tangle.locator(`[data-testid='live-tangle-node-${maraNodeId}']`).click();
    await tangle.locator(`[data-testid='live-tangle-node-${noteId}']`).click({ modifiers: ["Shift"] });
    await expect(tangle.locator("[data-testid='live-tangle-group-selected']")).toBeEnabled();
    await tangle.locator("[data-testid='live-tangle-group-selected']").click();
    const groupDialog = page.locator("[data-testid='live-tangle-group-dialog']");
    await groupDialog.locator("[data-testid='live-tangle-group-name']").fill("Oath cluster");
    await groupDialog.locator("[data-testid='live-tangle-group-create']").click();
    await expect(groupDialog).toBeHidden();
    const group = await page.evaluate(() => window.LoomwrightBackend.LiveTangleService.loadStateSync().groups.find((row) => row.name === "Oath cluster"));
    expect(group.nodeIds.sort()).toEqual([maraNodeId, noteId].sort());
    await expect(tangle.locator(`[data-testid='live-tangle-group-${group.id}']`)).toBeVisible();

    await tangle.locator(`[data-testid='live-tangle-node-${noteId}']`).click();
    const noteInspector = tangle.locator(`[data-testid='live-tangle-inspector-${noteId}']`);
    await noteInspector.locator("[data-testid='live-tangle-promote-type']").selectOption("quests");
    await noteInspector.locator("[data-testid='live-tangle-promote']").click();
    await page.waitForFunction((id) => {
      const node = window.LoomwrightBackend.LiveTangleService.buildWorkspace().nodes.find((row) => row.id === id);
      return !!node?.entityId && node.entityType === "quests";
    }, noteId);
    const promoted = await page.evaluate((id) => {
      const node = window.LoomwrightBackend.LiveTangleService.buildWorkspace().nodes.find((row) => row.id === id);
      const entity = window.LoomwrightBackend.EntityService.getSync(node.entityId, "quests");
      return { nodeId: node.id, entityId: node.entityId, name: entity.name, status: entity.status };
    }, noteId);
    expect(promoted.nodeId).toBe(noteId);
    expect(promoted.name).toBe("The missing oath");
    expect(promoted.status).toBe("draft");

    await page.reload();
    await page.waitForFunction(() => !!window.LoomwrightBackend?.LiveTangleService, null, { timeout: 45000 });
    const restored = await openTangle(page);
    await expect(restored.locator(`[data-testid='live-tangle-node-${maraNodeId}']`)).toBeVisible({ timeout: 10000 });
    await expect(restored.locator(`[data-testid='live-tangle-node-${noteId}']`)).toContainText("The missing oath");
    await expect(restored.locator(`[data-testid^='live-tangle-edge-']`)).toHaveCount(1);
    await expect(restored.locator(`[data-testid='live-tangle-group-${group.id}']`)).toBeVisible();
  });

  test("creates isolated boards and keeps their planning state across board switches", async ({ page }) => {
    await openFreshApp(page);
    await seedTangleProject(page);
    const tangle = await openTangle(page);

    await tangle.locator("[data-testid='live-tangle-tray-ac-court']").click();
    const courtNodeId = await nodeIdForEntity(page, "ac-court");
    expect(courtNodeId).toBeTruthy();
    await tangle.getByRole("button", { name: "New board" }).click();
    const dialog = page.locator("[data-testid='live-tangle-board-dialog']");
    await dialog.locator("[data-testid='live-tangle-board-name']").fill("Alternate ending");
    await dialog.locator("[data-testid='live-tangle-board-create']").click();
    await expect(dialog).toBeHidden();
    await expect(tangle.locator("[data-testid='live-tangle-board-select']")).toContainText("Alternate ending");
    await expect(tangle.locator("[data-testid='live-tangle-empty']")).toBeVisible();

    await tangle.locator("[data-testid='live-tangle-new-note']").click();
    const altNoteId = await latestPlanningNodeId(page, "New note");
    const inspector = tangle.locator(`[data-testid='live-tangle-inspector-${altNoteId}']`);
    await inspector.locator("[data-testid='live-tangle-inspector-title']").fill("The key is never found");
    await inspector.locator("[data-testid='live-tangle-inspector-save']").click();

    await tangle.locator("[data-testid='live-tangle-board-select']").selectOption("tangle-board-main");
    await expect(tangle.locator(`[data-testid='live-tangle-node-${courtNodeId}']`)).toContainText("Lantern Court");
    await expect(tangle.locator(`[data-testid='live-tangle-node-${altNoteId}']`)).toHaveCount(0);

    const alternateBoard = await page.evaluate(() => window.LoomwrightBackend.LiveTangleService.loadStateSync().boards.find((board) => board.name === "Alternate ending"));
    await tangle.locator("[data-testid='live-tangle-board-select']").selectOption(alternateBoard.id);
    await expect(tangle.locator(`[data-testid='live-tangle-node-${altNoteId}']`)).toContainText("The key is never found");
    await expect(tangle.locator(`[data-testid='live-tangle-node-${courtNodeId}']`)).toHaveCount(0);

    const persisted = await page.evaluate(() => {
      const state = window.LoomwrightBackend.LiveTangleService.loadStateSync();
      return {
        boards: state.boards.map((board) => board.name),
        mainNodes: state.nodes.filter((node) => node.boardId === "tangle-board-main").length,
        alternateNodes: state.nodes.filter((node) => node.boardId !== "tangle-board-main").length,
      };
    });
    expect(persisted.boards).toContain("Alternate ending");
    expect(persisted.mainNodes).toBe(1);
    expect(persisted.alternateNodes).toBe(1);
  });
});
