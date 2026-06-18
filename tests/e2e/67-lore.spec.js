// Workflow T67: Lore / Canon tab. The tab is already live + persistent
// (audit: buildLoreContext reads entity.data.*, edits persist via
// EntityService.update, filters/buttons wired). The gap matching the
// "surface invisible authored data" pattern: the fact card never showed
// subjects/appliesTo. This verifies a live fact renders (incl. the new
// applies-to chips + resolved linked entity) and that the canon band toggle
// persists.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openLorePanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "lore" } })));
  await page.waitForTimeout(300);
}

test.describe("T67. Lore / Canon tab", () => {
  test("lore fact renders live + canon band toggle persists", async ({ page }) => {
    await openFreshApp(page);
    const place = await saveEntity(page, "locations", { name: "The Salt-Coast" }, { status: "active" });
    const f = await saveEntity(page, "lore", {
      name: "The tides obey the moon",
      summary: "A cosmological constant of the Reach.",
      data: {
        kind: "cosmology", band: "canon",
        body: "Twice-daily tides, sworn by the auger-priests.",
        subjects: ["Salt-Coast tides"], relatedEntities: [place.id],
      },
    }, { status: "active" });
    await openLorePanel(page);
    await expect(page.locator("[data-ui='LorePanelBody']")).toBeVisible({ timeout: 5000 });
    const card = page.locator(".lore-fact");
    await expect(card.first()).toBeVisible({ timeout: 5000 });
    await expect(card).toContainText("tides obey the moon"); // name -> fact text
    await expect(card).toContainText("HARD CANON");          // data.band canon -> hard
    await expect(card).toContainText("Salt-Coast tides");    // data.subjects -> applies-to chip
    await expect(card).toContainText("The Salt-Coast");      // data.relatedEntities resolved to name
    // toggle the canon band -> persists to entity.data.band
    await card.getByRole("button", { name: "→ Soft" }).click();
    await page.waitForTimeout(250);
    const band = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "lore").data.band, f.id);
    expect(band).toBe("provisional");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/lore.png" });
  });

  test("editing a fact opens the purpose-built canon editor (not the generic)", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "lore", {
      name: "Salt wards the dead",
      summary: "A burial custom of the Reach.",
      data: { kind: "cultural belief", band: "provisional", body: "Graves are lined with salt." },
    }, { status: "active" });
    await openLorePanel(page);
    const card = page.locator(".lore-fact").first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.getByRole("button", { name: "Edit" }).click();

    const editor = page.locator("[data-ui='EntityEditor'][data-entity-type='lore']");
    await expect(editor).toBeVisible({ timeout: 5000 });
    // purpose-built lore fields (the generic fallback would not have these)
    await expect(editor).toContainText("Confidence band");
    await expect(editor).toContainText("Full statement");
  });

  test("a fact whose kind is stored top-level (editor-saved) still resolves its scope", async ({ page }) => {
    await openFreshApp(page);
    // the editor persists `kind` as a top-level identity key, not under data;
    // buildLoreContext must read it so the scope isn't silently wrong.
    await saveEntity(page, "lore", { name: "The moon pulls the tides", kind: "cosmology", data: { band: "canon" } }, { status: "active" });
    await openLorePanel(page);
    const card = page.locator(".lore-fact").first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toContainText(/magic rule/i); // cosmology -> magic rule (read from top-level kind)
  });
});
