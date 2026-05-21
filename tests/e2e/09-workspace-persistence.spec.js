// Workflow M (Workspace Persistence Pass 1):
//   - Per-workspace service-level persistence across page reload.
//   - Each workspace's edits survive a hard reload via the service
//     it owns: AtlasService, SkillTreeService, EntityService (for
//     relationships + timeline), TangleService.
//
// Scope-bounded to the priority 5 workspaces. UI rendering is not
// touched in this pass; we verify the persistence contract that the
// workspace components will read from in future passes.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

test.describe("M. Workspace persistence — service-level round-trip", () => {

  test("Atlas: place location + route persist across reload", async ({ page }) => {
    await openFreshApp(page);
    const vraska = await saveEntity(page, "locations", { name: "Vraska Pass" }, { status: "active" });
    const hess = await saveEntity(page, "locations", { name: "Hess" }, { status: "active" });
    await page.evaluate(async ({ vId, hId }) => {
      await window.LoomwrightBackend.AtlasService.placeLocation(vId, { x: 0.3, y: 0.5 }, { atlasMap: "Salt-Coast (default)" });
      await window.LoomwrightBackend.AtlasService.setRoute(vId, hId, "road");
    }, { vId: vraska.id, hId: hess.id });

    await openAppPreserveState(page);

    const persisted = await page.evaluate(({ vId }) => {
      const loc = window.LoomwrightBackend.EntityService.getSync(vId, "locations");
      return { placed: loc?.data?.placed, coords: loc?.data?.coords, routes: loc?.data?.routes };
    }, { vId: vraska.id });
    expect(persisted.placed).toBe(true);
    expect(persisted.coords?.x).toBe(0.3);
    expect(persisted.routes).toEqual(expect.arrayContaining([{ to: hess.id, kind: "road" }]));
  });

  test("Skill Trees: tree + nodes + edges persist across reload", async ({ page }) => {
    await openFreshApp(page);
    const skillA = await saveEntity(page, "skills", { name: "Quickstep" }, { status: "active" });
    const skillB = await saveEntity(page, "skills", { name: "Sidestep" }, { status: "active" });
    const treeId = await page.evaluate(async ({ aId, bId }) => {
      const STS = window.LoomwrightBackend.SkillTreeService;
      const tree = await STS.addTree({ name: "Footwork" });
      await STS.addNode(tree.id, aId, { x: 100, y: 200 });
      await STS.addNode(tree.id, bId, { x: 200, y: 200 });
      await STS.connectNodes(tree.id, aId, bId);
      return tree.id;
    }, { aId: skillA.id, bId: skillB.id });

    await openAppPreserveState(page);

    const reloaded = await page.evaluate(({ tId }) => {
      const s = window.LoomwrightBackend.SkillTreeService.loadSync();
      return s.trees.find((t) => t.id === tId);
    }, { tId: treeId });
    expect(reloaded?.nodeIds).toEqual(expect.arrayContaining([skillA.id, skillB.id]));
    expect(reloaded?.layout[skillA.id]).toEqual({ x: 100, y: 200 });
    expect(reloaded?.edges).toEqual(expect.arrayContaining([{ from: skillA.id, to: skillB.id, kind: "leads-to" }]));
  });

  test("Relationships: create + edit + evidence persist across reload", async ({ page }) => {
    await openFreshApp(page);
    const ael = await saveEntity(page, "cast", { name: "Aelinor" }, { status: "active" });
    const sar = await saveEntity(page, "cast", { name: "Saren" }, { status: "active" });
    const rel = await page.evaluate(async ({ aId, sId }) => {
      return await window.LoomwrightBackend.EntityService.save("relationships", {
        name: "Aelinor → Saren", fromId: aId, toId: sId,
        relationshipType: "ally", strength: 60,
      }, { status: "active" });
    }, { aId: ael.id, sId: sar.id });
    await page.evaluate(async (id) => {
      await window.LoomwrightBackend.EntityService.update("relationships", id, { strength: 80 });
      await window.LoomwrightBackend.LinkService.appendField(id, "relationships", "evidence", "Ch. 3: knife wound");
    }, rel.id);

    await openAppPreserveState(page);

    const reloaded = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "relationships"), rel.id);
    expect(reloaded.fromId).toBe(ael.id);
    expect(reloaded.toId).toBe(sar.id);
    expect(reloaded.strength).toBe(80);
    expect(reloaded.data?.evidence).toContain("Ch. 3: knife wound");
  });

  test("Timeline: event + linked characters persist across reload", async ({ page }) => {
    await openFreshApp(page);
    const ael = await saveEntity(page, "cast", { name: "Aelinor" }, { status: "active" });
    const ev = await page.evaluate(async (aId) => {
      const e = await window.LoomwrightBackend.EntityService.save("timeline", {
        name: "Auger Wake", track: "main", isMilestone: true, dateLabel: "Year 3",
      }, { status: "active" });
      await window.LoomwrightBackend.LinkService.appendField(e.id, "timeline", "characters", aId);
      return e;
    }, ael.id);

    await openAppPreserveState(page);

    const reloaded = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "timeline"), ev.id);
    expect(reloaded.name).toBe("Auger Wake");
    expect(reloaded.isMilestone).toBe(true);
    expect(reloaded.dateLabel).toBe("Year 3");
    expect(reloaded.data?.characters).toContain(ael.id);
  });

  test("Tangle: node + group + position persist across reload", async ({ page }) => {
    await openFreshApp(page);
    const nodeId = await page.evaluate(async () => {
      const T = window.LoomwrightBackend.TangleService;
      const s1 = await T.addNode({ title: "Idea: Aelinor's secret", body: "Tied to Hess." });
      const node = s1.nodes[s1.nodes.length - 1];
      await T.updateNode(node.id, { position: { x: 240, y: 320 } });
      await T.addGroup({ title: "Hess motifs" });
      return node.id;
    });

    await openAppPreserveState(page);

    const reloaded = await page.evaluate((nId) => {
      const s = window.LoomwrightBackend.TangleService.loadSync();
      return {
        node: s.nodes.find((n) => n.id === nId),
        groups: s.groups,
      };
    }, nodeId);
    expect(reloaded.node?.title).toBe("Idea: Aelinor's secret");
    expect(reloaded.node?.position).toEqual({ x: 240, y: 320 });
    expect(reloaded.groups?.[0]?.title).toBe("Hess motifs");
  });
});
