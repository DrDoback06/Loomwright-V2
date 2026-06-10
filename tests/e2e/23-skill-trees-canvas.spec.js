// Workflow U23: Area 4 phase 3 — the designed Skill Trees constellation
// UI is the live panel.
//
// SkillTreesSidePanel (roster / mini constellation / node card / bearers /
// orphans) and SkillTreeEditor (toolbar tools, rails, drafts, strip) render
// SkillTreeService + EntityService("skills") data; every edit persists.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState } = require("./helpers");

async function openSkillsPanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "skillTrees" } }));
  });
  await page.waitForTimeout(300);
}

async function seedConstellation(page) {
  return await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    const cast = await B.EntityService.save("cast", { name: "Anwen Hale", data: { role: "protagonist" } }, { status: "active" });
    const s1 = await B.EntityService.save("skills", {
      name: "Ember Step", summary: "A short fiery dash.",
      data: { skillType: "active", effect: "+2 movement through flame", cost: "1 focus",
              learnedBy: [{ id: cast.id, name: "Anwen Hale", type: "cast" }] },
    }, { status: "active" });
    const s2 = await B.EntityService.save("skills", {
      name: "Cinder Guard", summary: "Embers turn aside the first blow.",
      data: { skillType: "passive" },
    }, { status: "active" });
    const tree = await B.SkillTreeService.addTree({ name: "Path of Embers", description: "Fire discipline" });
    await B.SkillTreeService.addNode(tree.id, s1.id, { x: 50, y: 76 });
    await B.SkillTreeService.addNode(tree.id, s2.id, { x: 40, y: 56 });
    await B.SkillTreeService.connectNodes(tree.id, s1.id, s2.id);
    await B.SkillTreeService.setNodeUnlocked(tree.id, s1.id, true);
    await B.SkillTreeService.assignCast(tree.id, cast.id);
    return { castId: cast.id, s1: s1.id, s2: s2.id, treeId: tree.id };
  });
}

test.describe("U23. Skill Trees — designed constellation UI is live", () => {
  test("side panel renders the live tree, node card and bearers (no demo)", async ({ page }) => {
    await openFreshApp(page);
    await seedConstellation(page);
    await openSkillsPanel(page);
    const stp = page.locator("[data-ui='SkillTreesSidePanel']");
    await expect(stp).toBeVisible();
    await expect(stp.locator(".stp__roster-row", { hasText: "Path of Embers" })).toBeVisible();
    // Node card shows the live first star.
    await expect(stp.locator(".stp__node-name")).toHaveText("Ember Step");
    await expect(stp).toContainText("+2 movement through flame");
    // Mini foot counts: 2 skills, 1 unlocked, 1 bearer.
    await expect(stp.locator(".stp__mini-foot")).toContainText("2 skills");
    await expect(stp.locator(".stp__mini-foot")).toContainText("1 unlocked");
    // Bearers come from tree.assignedCast.
    await expect(stp.locator(".stp__chars .stp__char", { hasText: "Anwen Hale" })).toBeVisible();
    // The old demo constellation is gone.
    await expect(stp).not.toContainText("The Augur");
    await expect(stp).not.toContainText("Glass Court");
  });

  test("fresh project shows designed empty roster + preview", async ({ page }) => {
    await openFreshApp(page);
    await openSkillsPanel(page);
    const stp = page.locator("[data-ui='SkillTreesSidePanel']");
    await expect(stp.locator("[data-ui='STEmptyRoster']")).toBeVisible();
    await expect(stp.locator("[data-ui='STEmptyPreview']")).toBeVisible();
    await expect(stp).not.toContainText("Salt-Sense");
  });

  test("orphan skill gets suggested and placed into the tree", async ({ page }) => {
    await openFreshApp(page);
    const ids = await seedConstellation(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.EntityService.save("skills", {
        name: "Ember Ward", summary: "A guard of embers along the fire discipline path.",
        data: { skillType: "triggered" },
      }, { status: "active" });
    });
    await openSkillsPanel(page);
    const stp = page.locator("[data-ui='SkillTreesSidePanel']");
    const orphan = stp.locator(".stp__orphan", { hasText: "Ember Ward" });
    await expect(orphan).toBeVisible();
    // Suggestion button names the live tree; clicking places the skill.
    await orphan.locator("button", { hasText: "Path of Embers" }).click();
    await page.waitForTimeout(300);
    const placed = await page.evaluate(({ treeId }) => {
      const tree = window.LoomwrightBackend.SkillTreeService.loadSync().trees.find((t) => t.id === treeId);
      return (tree.nodeIds || []).length;
    }, ids);
    expect(placed).toBe(3);
    await expect(stp.locator(".stp__orphan", { hasText: "Ember Ward" })).toHaveCount(0);
  });

  test("editor drafts rail accepts an extraction candidate into the chosen tree", async ({ page }) => {
    await openFreshApp(page);
    const ids = await seedConstellation(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.ReviewService.add({
        id: "rq-st-e2e", entityType: "skills", name: "Flame Ward",
        suggestedAction: "create", confidence: 0.8, status: "pending",
        sourceQuote: "She drew the heat into a ring before the blow landed.",
        payload: { name: "Flame Ward", entityType: "skills", summary: "A ring of heat." },
      });
      window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
    });
    await openSkillsPanel(page);
    const stp = page.locator("[data-ui='SkillTreesSidePanel']");
    await stp.locator(".stp__preview-edit").click();
    const ste = page.locator("[data-ui='SkillTreeEditor']");
    await expect(ste).toBeVisible();
    await ste.locator("[data-testid='st-tab-drafts']").click();
    await expect(ste.locator(".ste-list__draft", { hasText: "Flame Ward" })).toBeVisible();
    await ste.locator("[data-testid='st-draft-accept-rq-st-e2e']").click();
    await page.waitForTimeout(400);
    const result = await page.evaluate(({ treeId }) => {
      const B = window.LoomwrightBackend;
      const tree = B.SkillTreeService.loadSync().trees.find((t) => t.id === treeId);
      const skill = B.EntityService.listSync("skills").find((s) => s.name === "Flame Ward" && s.status !== "deleted");
      const pending = B.ReviewService.listSync("skills").filter((q) => q.status === "pending").length;
      return { nodes: (tree.nodeIds || []).length, hasSkill: !!skill, inTree: !!skill && tree.nodeIds.includes(skill.id), pending };
    }, ids);
    expect(result.hasSkill).toBe(true);
    expect(result.inTree).toBe(true);
    expect(result.nodes).toBe(3);
    expect(result.pending).toBe(0);
  });

  test("unlock toggle persists across reload", async ({ page }) => {
    await openFreshApp(page);
    const ids = await seedConstellation(page);
    await openSkillsPanel(page);
    const stp = page.locator("[data-ui='SkillTreesSidePanel']");
    // Ember Step is unlocked — the button offers "Lock".
    await expect(stp.locator("[data-testid='stp-toggle-lock']")).toHaveText("Lock");
    await stp.locator("[data-testid='stp-toggle-lock']").click();
    await page.waitForTimeout(300);
    await expect(stp.locator("[data-testid='stp-toggle-lock']")).toHaveText("Unlock");
    await openAppPreserveState(page);
    const after = await page.evaluate(({ treeId, s1 }) => {
      const tree = window.LoomwrightBackend.SkillTreeService.loadSync().trees.find((t) => t.id === treeId);
      return !!((tree.layout || {})[s1] || {}).unlocked;
    }, ids);
    expect(after).toBe(false);
  });
});
