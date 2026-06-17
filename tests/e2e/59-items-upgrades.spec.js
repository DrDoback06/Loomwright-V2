// Workflow T59: Items tab upgrades — live-data adapter. The bespoke
// roster/dossier widgets + the shared ItemDetail were written against flat
// demo objects; live items store custom fields under entity.data.*, so a
// real item rendered empty (no rarity/slot/owner, dead rarity filter, empty
// locations). The adapter maps data.* -> the flat shape, resolves related
// owner/location refs, and derives mentions from occurrences.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openItemsPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } })));
  await page.waitForTimeout(300);
}

test.describe("T59. Items tab upgrades", () => {
  test("dossier renders LIVE data via the adapter", async ({ page }) => {
    await openFreshApp(page);
    const owner = await saveEntity(page, "cast", { name: "Aelinor Vey" }, { status: "active" });
    const place = await saveEntity(page, "locations", { name: "Pale Reach Hold" }, { status: "active" });
    await saveEntity(page, "items", {
      name: "Bone Auger",
      summary: "A salt-bitten relic of carved whalebone.",
      data: {
        itemType: "Relic", rarity: "Heirloom", slot: "Relic", weight: "1.2 lb",
        description: "Yellowed bone, scrimshawed with tide-marks.",
        currentOwner: owner.id, foundLocation: place.id,
        modifiers: [{ target: "Resolve", delta: 2, note: "while carried" }],
      },
    }, { status: "active" });
    await openItemsPanel(page);
    const panel = page.locator("[data-ui='ItemsPanelBody']");
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel).toContainText("Bone Auger");
    await expect(panel).toContainText("Heirloom");        // data.rarity (eyebrow + facet)
    await expect(panel).toContainText("Relic");           // data.itemType / slot
    await expect(panel).toContainText("Aelinor Vey");     // data.currentOwner id -> resolved owner
    await expect(panel).toContainText("Pale Reach Hold"); // data.foundLocation id -> resolved site
    await expect(panel).toContainText("Resolve");         // data.modifiers target
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/items.png" });
  });

  test("rarity filter narrows the inventory (reads data.rarity via adapter)", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "items", { name: "Bone Auger",   data: { itemType: "Relic",  rarity: "Heirloom" } }, { status: "active" });
    await saveEntity(page, "items", { name: "Salt Cloak",   data: { itemType: "Armour", rarity: "Common" } },   { status: "active" });
    await saveEntity(page, "items", { name: "Vey Signet",   data: { itemType: "Relic",  rarity: "Rare" } },     { status: "active" });
    await openItemsPanel(page);
    const rows = page.locator(".item-roster__row");
    await expect(rows).toHaveCount(3, { timeout: 5000 });

    await page.locator(".loc-body__search input").fill("signet");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Vey Signet");
    await page.locator(".loc-body__search input").fill("");
    await expect(rows).toHaveCount(3);

    // rarity filter is the second select; it silently failed before the adapter
    await page.locator(".loc-body__filter").nth(1).selectOption("Heirloom");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Bone Auger");
  });
});
