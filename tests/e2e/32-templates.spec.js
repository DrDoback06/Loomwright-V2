// Workflow U32: Phase 13 — reusable templates (Alkemion-inspired).
//
// Entity templates: genre starters + your own snapshots prefill the
// entity editor's "Start from" strip. Board templates stamp tangle
// clusters. Also locks in the editor round-trip fix: id-initials
// hydrate the form from the live record, and flat form fields pack
// back into entity.data on save.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function openEditor(page, detail) {
  await page.evaluate((d) => {
    window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: d }));
  }, detail);
  await page.waitForTimeout(350);
}

test.describe("U32. Templates + editor round-trip", () => {
  test("genre starter template prefills a new class", async ({ page }) => {
    await openFreshApp(page);
    await openEditor(page, { type: "classes", mode: "full" });
    const ee = page.locator("[data-ui='EntityEditor']");
    await expect(ee).toBeVisible();
    const strip = ee.locator("[data-ui='EeTemplateStrip']");
    await expect(strip).toBeVisible();
    await strip.locator("button", { hasText: "Knight-errant" }).click();
    // The template's summary lands in the live preview; name stays ours.
    await expect(ee).toContainText("oath first, lord second");
    await ee.locator("input.ee-input").first().fill("Hedge Knight");
    await ee.locator("button", { hasText: "Save (Active)" }).click();
    await page.waitForTimeout(400);
    const saved = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("classes")[0]);
    expect(saved.name).toBe("Hedge Knight");
    expect(saved.data.description).toContain("personal oath");
    expect(saved.data.defaultStats.length).toBe(2);
  });

  test("Save as template snapshots the form and reappears in the strip", async ({ page }) => {
    await openFreshApp(page);
    await openEditor(page, { type: "locations", mode: "full" });
    const ee = page.locator("[data-ui='EntityEditor']");
    await ee.locator("input.ee-input").first().fill("Border Keep");
    await ee.locator("[data-testid='ee-save-template']").click();
    await page.waitForTimeout(400);
    const tpls = await page.evaluate(() =>
      window.LoomwrightBackend.TemplateService.listSync({ kind: "entity", entityType: "locations" })
        .filter((t) => t.source !== "builtin").map((t) => t.name));
    expect(tpls).toContain("Border Keep template");
    // Close, reopen create — the custom chip is offered.
    await ee.locator("button", { hasText: "Cancel" }).first().click();
    await openEditor(page, { type: "locations", mode: "full" });
    await expect(page.locator("[data-ui='EeTemplateStrip'] button", { hasText: "Border Keep template" })).toBeVisible();
  });

  test("editor hydrates id-initials and packs fields back into data (round-trip)", async ({ page }) => {
    await openFreshApp(page);
    const seeded = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      return B.EntityService.save("cast", {
        name: "Anwen Hale", summary: "Holds the north road.",
        data: { role: "protagonist", personality: "Wry, watchful.", goals: ["Keep the gate open"] },
      }, { status: "active" });
    });
    // Open the editor by id only (the dossier's Edit path).
    await openEditor(page, { type: "cast", initial: { id: seeded.id }, mode: "full" });
    const ee = page.locator("[data-ui='EntityEditor']");
    await expect(ee).toBeVisible();
    // Nested data hydrated into the form.
    await expect(ee.locator("textarea")).toHaveCount(await ee.locator("textarea").count());
    const personality = ee.locator("textarea", { hasText: "Wry, watchful." }).first();
    await expect(personality).toBeVisible();
    // Edit one field and save.
    await personality.fill("Wry, watchful, tired.");
    await ee.locator("button", { hasText: "Save (Active)" }).click();
    await page.waitForTimeout(400);
    const after = await page.evaluate((id) =>
      window.LoomwrightBackend.EntityService.getSync(id, "cast"), seeded.id);
    expect(after.data.personality).toBe("Wry, watchful, tired.");
    expect(after.data.role).toBe("protagonist");      // untouched fields survive
    expect(after.data.goals).toEqual(["Keep the gate open"]);
    expect(after.name).toBe("Anwen Hale");
  });

  test("tangle cluster saves as a board template and stamps elsewhere", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const board = await B.TangleService.addBoard({ name: "Origin" });
      const a = await B.TangleService.addNode({ boardId: board.id, kind: "note", title: "Cause", x: 200, y: 200 });
      const b = await B.TangleService.addNode({ boardId: board.id, kind: "note", title: "Effect", x: 420, y: 280 });
      await B.TangleService.addEdge({ from: a.id, to: b.id, label: "leads to" });
    });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "tangle" } }));
    });
    await page.waitForTimeout(300);
    await page.locator("[data-testid='tan-open-canvas']").click();
    const fs = page.locator("[data-ui='TangleFullScreen']");
    await expect(fs).toBeVisible();
    // Select the Cause card, save its cluster as a template.
    await fs.locator("[data-ui='TangleNode']", { hasText: "Cause" }).dispatchEvent("mousedown");
    await fs.locator("[data-ui='TangleNode']", { hasText: "Cause" }).dispatchEvent("mouseup");
    await fs.locator("[data-testid='tan-save-template']").click();
    await page.waitForTimeout(400);
    // Stamp it onto a fresh board.
    await page.evaluate(async () => {
      await window.LoomwrightBackend.TangleService.addBoard({ name: "Target" });
    });
    await page.waitForTimeout(300);
    const tplTile = fs.locator("[data-testid^='tan-template-']").first();
    await expect(tplTile).toBeVisible();
    await tplTile.click();
    await page.waitForTimeout(400);
    const stamped = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      const s = B.TangleService.loadSync();
      const target = s.boards.find((b) => b.name === "Target");
      const view = B.TangleService.listBoardSync(target.id);
      return { nodes: view.nodes.length, edges: view.edges.length, label: view.edges[0]?.label };
    });
    expect(stamped.nodes).toBe(2);
    expect(stamped.edges).toBe(1);
    expect(stamped.label).toBe("leads to");
  });
});
