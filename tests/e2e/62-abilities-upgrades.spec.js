// Workflow T62: Abilities tab — the panel already read entity.data.* for
// type/description/effects/requirements, but the dossier dropped the
// editor's cost/cooldown/limit, upgrade path, and linked entities. This
// surfaces them (linked refs resolved to names) so authored data is visible.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openAbilitiesPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "abilities" } })));
  await page.waitForTimeout(300);
}

test.describe("T62. Abilities tab upgrades", () => {
  test("ability dossier renders LIVE data incl. cost/cooldown + linked stats", async ({ page }) => {
    await openFreshApp(page);
    const stat = await saveEntity(page, "stats", { name: "Resolve" }, { status: "active" });
    await saveEntity(page, "skills", {
      name: "Court tongue",
      summary: "The art of saying nothing precisely.",
      data: {
        skillType: "active", cost: "1 charge", cooldown: "per scene",
        description: "A honeyed deflection that buys time in any audience.",
        effects: [{ trigger: "On parley", effect: "delay a demand one scene" }],
        requirements: ["Standing >= Court-recognized"],
        linkedStats: [stat.id],
      },
    }, { status: "active" });
    await openAbilitiesPanel(page);
    const panel = page.locator("[data-ui='AbilitiesPanelBody']");
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toContainText("Court tongue");
    await expect(panel).toContainText("honeyed deflection"); // data.description
    await expect(panel).toContainText("1 charge");           // data.cost meta
    await expect(panel).toContainText("per scene");          // data.cooldown meta
    await expect(panel).toContainText("delay a demand");     // data.effects
    await expect(panel).toContainText("Resolve");            // linkedStats id resolved to name
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/abilities.png" });
  });

  test("type filter narrows the catalogue", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "skills", { name: "Court tongue", data: { skillType: "active" } }, { status: "active" });
    await saveEntity(page, "skills", { name: "Saltsense",    data: { skillType: "passive" } }, { status: "active" });
    await openAbilitiesPanel(page);
    const rows = page.locator(".loc-tree__row");
    await expect(rows).toHaveCount(2, { timeout: 5000 });
    await page.locator(".loc-body__filter").first().selectOption("passive");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Saltsense");
  });
});
