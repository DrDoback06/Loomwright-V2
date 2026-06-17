// Workflow T61: Stats tab upgrades — live-data adapter + rule persistence.
// StatDetailUpgraded read flat fields stored under entity.data.* (so a live
// stat showed default facets and no rules), derived links were demo-only,
// and extraction-rule edits lived in local React state and vanished on
// reload. The adapter maps data.* + derives items-affecting/abilities/
// mentions live; rule mutations now persist via EntityService.update.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openStatsPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "stats" } })));
  await page.waitForTimeout(300);
}

test.describe("T61. Stats tab upgrades", () => {
  test("dossier renders LIVE stat data + derived items-affecting", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "stats", {
      name: "Resolve",
      summary: "How far a character will go before they fold.",
      data: {
        valueType: "scale", defaultValue: "Steady", min: 1, max: 20,
        appliesTo: ["Cast", "Factions"],
        extractionRules: [{ id: "r1", phrase: "held the line", matchType: "exact phrase", effect: "qualitative_inc", value: "+1", confidence: "green", active: true }],
      },
    }, { status: "active" });
    // an item whose modifier targets this stat by name -> derived items-affecting
    await saveEntity(page, "items", { name: "Bone Auger", data: { modifiers: [{ target: "Resolve", delta: 2 }] } }, { status: "active" });
    await openStatsPanel(page);
    const detail = page.locator("[data-ui='StatDetail']");
    await expect(detail).toBeVisible({ timeout: 5000 });
    await expect(detail).toContainText("scale");         // data.valueType facet
    await expect(detail).toContainText("Steady");        // data.defaultValue facet
    await expect(detail).toContainText("Cast");          // data.appliesTo
    await expect(detail).toContainText("held the line"); // data.extractionRules
    await expect(detail).toContainText("Bone Auger");    // derived items-affecting
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/stats.png" });
  });

  test("adding an extraction rule persists to entity.data", async ({ page }) => {
    await openFreshApp(page);
    const st = await saveEntity(page, "stats", { name: "Cunning", data: { valueType: "number", extractionRules: [] } }, { status: "active" });
    await openStatsPanel(page);
    await expect(page.locator("[data-ui='StatDetail']")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "+ Add rule" }).click();
    await page.waitForTimeout(250);
    const rules = await page.evaluate((id) => {
      const e = window.LoomwrightBackend.EntityService.getSync(id, "stats");
      return (e && e.data && e.data.extractionRules) || [];
    }, st.id);
    expect(rules.length).toBe(1); // persisted exactly one (no double-fire via registry)
  });
});
