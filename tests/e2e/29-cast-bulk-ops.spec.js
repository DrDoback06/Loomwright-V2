// Workflow U29: Phase 10 — cast bulk operations are real.
//
// Multi-select (ctrl+click) Tag / Delete / Merge act on the live store:
// tags persist to data.tags through the shared TagEntitiesModal, deletes
// land in the trash, merges rebind references via LinkService.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openCastPanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } }));
  });
  await page.waitForTimeout(300);
}

async function seedPair(page) {
  const a = await saveEntity(page, "cast", { name: "Anwen Hale", data: { role: "protagonist" } });
  const b = await saveEntity(page, "cast", { name: "Bram Iron", data: { role: "antagonist" } });
  return { a, b };
}

async function selectBoth(page) {
  const rows = page.locator(".cast-row[data-cast-id]");
  await rows.nth(0).click({ modifiers: ["Control"] });
  await rows.nth(1).click();
  await expect(page.locator("[data-ui='CastMultiBar']")).toContainText("2");
}

test.describe("U29. Cast bulk ops — tag / delete / merge", () => {
  test("Tag multiple writes data.tags through the tag modal", async ({ page }) => {
    await openFreshApp(page);
    await seedPair(page);
    await openCastPanel(page);
    await selectBoth(page);
    await page.locator("[data-ui='CastMultiBar'] button", { hasText: "Tag" }).click();
    const modal = page.locator("[data-testid='tag-entities-modal']");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Tag 2 entries");
    await modal.locator("[data-testid='tag-input']").fill("northern, suspects");
    await modal.locator("[data-testid='tag-apply']").click();
    await page.waitForTimeout(400);
    const tags = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("cast")
        .filter((e) => e.status !== "deleted")
        .map((e) => (e.data && e.data.tags) || []));
    expect(tags.length).toBe(2);
    for (const t of tags) expect(t).toEqual(["northern", "suspects"]);
  });

  test("Delete multiple moves both to the trash after confirm", async ({ page }) => {
    await openFreshApp(page);
    await seedPair(page);
    page.on("dialog", (d) => d.accept());
    await openCastPanel(page);
    await selectBoth(page);
    await page.locator("[data-ui='CastMultiBar'] button", { hasText: "Delete" }).click();
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => ({
      live: window.LoomwrightBackend.EntityService.listSync("cast").filter((e) => e.status !== "deleted").length,
      trash: window.LoomwrightBackend.TrashService.listSync().length,
    }));
    expect(result.live).toBe(0);
    expect(result.trash).toBe(2);
  });

  test("Merge multiple rebinds references into the first selection", async ({ page }) => {
    await openFreshApp(page);
    const { a, b } = await seedPair(page);
    // An item owned by Bram — the merge must rebind it to Anwen.
    await page.evaluate(async ({ bId }) => {
      const B = window.LoomwrightBackend;
      await B.EntityService.save("items", { name: "Iron seal", data: { ownerId: bId } }, { status: "active" });
    }, { bId: b.id });
    page.on("dialog", (d) => d.accept());
    await openCastPanel(page);
    // Select Anwen FIRST (merge target), then Bram.
    const anwenRow = page.locator(`.cast-row[data-cast-id='${a.id}']`);
    const bramRow = page.locator(`.cast-row[data-cast-id='${b.id}']`);
    await anwenRow.click({ modifiers: ["Control"] });
    await bramRow.click();
    await expect(page.locator("[data-ui='CastMultiBar']")).toContainText("2");
    await page.locator("[data-ui='CastMultiBar'] button", { hasText: "Merge" }).click();
    await page.waitForTimeout(600);
    const result = await page.evaluate(({ aId, bId }) => {
      const B = window.LoomwrightBackend;
      const cast = B.EntityService.listSync("cast").filter((e) => e.status !== "deleted");
      const item = B.EntityService.listSync("items")[0];
      return {
        names: cast.map((c) => c.name),
        bramGone: !cast.some((c) => c.id === bId),
        owner: item && item.data && item.data.ownerId,
      };
    }, { aId: a.id, bId: b.id });
    expect(result.names).toEqual(["Anwen Hale"]);
    expect(result.bramGone).toBe(true);
    expect(result.owner).toBe(a.id);
  });
});
