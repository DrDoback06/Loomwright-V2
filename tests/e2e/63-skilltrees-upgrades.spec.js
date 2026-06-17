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
});
