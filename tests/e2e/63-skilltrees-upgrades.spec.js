// Workflow T63: Skill Trees tab. The canvas editor is already fully wired to
// SkillTreeService (live skills as nodes; drag/connect/unlock persist to
// KEYS.skillTrees). The one gap was that a tree could not be renamed after
// creation (updateTree existed but was never called). This verifies the
// editor renders a live tree node AND that the new inline rename persists.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openSkillTreesPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "skillTrees" } })));
  await page.waitForTimeout(300);
}

test.describe("T63. Skill Trees tab", () => {
  test("editor renders a live tree node + renaming persists", async ({ page }) => {
    await openFreshApp(page);
    const skill = await saveEntity(page, "skills", { name: "Court tongue", data: { skillType: "active" } }, { status: "active" });
    const treeId = await page.evaluate(async (sid) => {
      const S = window.LoomwrightBackend.SkillTreeService;
      const t = await S.addTree({ name: "Court arts" });
      await S.addNode(t.id, sid, { x: 120, y: 120 });
      return t.id;
    }, skill.id);

    await openSkillTreesPanel(page);
    await expect(page.locator(".stp-host")).toBeVisible({ timeout: 5000 });

    // open the full-screen constellation editor on this tree
    await page.evaluate((tid) => window.dispatchEvent(new CustomEvent("lw:open-existing-fullscreen", { detail: { workspaceId: "skill-tree-editor", entityId: tid } })), treeId);
    const editor = page.locator("[data-ui='SkillTreeEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });
    await expect(editor).toContainText("Court tongue"); // live skill entity rendered as a node

    // rename the tree inline -> persists via SkillTreeService.updateTree
    const nameInput = page.locator("[data-testid='ste-tree-name']");
    await expect(nameInput).toHaveValue("Court arts");
    await nameInput.fill("Court arts (revised)");
    await nameInput.press("Enter");
    await page.waitForTimeout(250);
    const persisted = await page.evaluate((tid) => {
      const t = (window.LoomwrightBackend.SkillTreeService.loadSync().trees || []).find((x) => x.id === tid);
      return t && t.name;
    }, treeId);
    expect(persisted).toBe("Court arts (revised)");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/skilltrees.png" });
  });

  test("picking a star icon persists to the skill node", async ({ page }) => {
    await openFreshApp(page);
    const skill = await saveEntity(page, "skills", { name: "Embercall", data: { skillType: "active" } }, { status: "active" });
    const treeId = await page.evaluate(async (sid) => {
      const S = window.LoomwrightBackend.SkillTreeService;
      const t = await S.addTree({ name: "Pyromancy" });
      await S.addNode(t.id, sid, { x: 50, y: 60 });   // 0-100 space, on-canvas
      return t.id;
    }, skill.id);

    await openSkillTreesPanel(page);
    await expect(page.locator(".stp-host")).toBeVisible({ timeout: 5000 });
    await page.evaluate((tid) => window.dispatchEvent(new CustomEvent("lw:open-existing-fullscreen", { detail: { workspaceId: "skill-tree-editor", entityId: tid } })), treeId);
    const editor = page.locator("[data-ui='SkillTreeEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    await editor.locator("[data-st-node]").first().click();      // select the star
    const picker = page.locator("[data-ui='StIconPicker']");
    await expect(picker).toBeVisible({ timeout: 5000 });
    await picker.locator("[data-testid='ste-icon-fire']").click();
    await page.waitForTimeout(250);

    const icon = await page.evaluate((sid) => window.LoomwrightBackend.EntityService.getSync(sid, "skills").data.icon, skill.id);
    expect(icon).toBe("fire");
  });

  test("a prerequisite renders as a directional link and can be removed from the inspector", async ({ page }) => {
    await openFreshApp(page);
    const a = await saveEntity(page, "skills", { name: "Stance", data: { skillType: "passive" } }, { status: "active" });
    const b = await saveEntity(page, "skills", { name: "Lunge", data: { skillType: "active" } }, { status: "active" });
    const treeId = await page.evaluate(async (ids) => {
      const S = window.LoomwrightBackend.SkillTreeService;
      const t = await S.addTree({ name: "Blade" });
      await S.addNode(t.id, ids.a, { x: 40, y: 75 });
      await S.addNode(t.id, ids.b, { x: 60, y: 45 });
      await S.connectNodes(t.id, ids.a, ids.b, "prereq");   // seed a prereq edge
      return t.id;
    }, { a: a.id, b: b.id });
    const edgesNow = () => page.evaluate((tid) => ((window.LoomwrightBackend.SkillTreeService.loadSync().trees.find((t) => t.id === tid) || {}).edges) || [], treeId);

    await openSkillTreesPanel(page);
    await expect(page.locator(".stp-host")).toBeVisible({ timeout: 5000 });
    await page.evaluate((tid) => window.dispatchEvent(new CustomEvent("lw:open-existing-fullscreen", { detail: { workspaceId: "skill-tree-editor", entityId: tid } })), treeId);
    const editor = page.locator("[data-ui='SkillTreeEditor']");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // the edge renders as a directional connection line (arrowhead marker)
    await expect(editor.locator("path[marker-end]")).toHaveCount(1, { timeout: 5000 });

    // select Lunge, remove the prerequisite via the inspector ✕ (disconnectNodes)
    await editor.locator(`[data-st-node="${b.id}"]`).click();
    await page.waitForTimeout(200);
    await page.locator(`[data-testid="ste-disconnect-${a.id}"]`).click();
    await page.waitForTimeout(300);
    expect((await edgesNow()).some((e) => e.from === a.id && e.to === b.id)).toBe(false);
  });
});
