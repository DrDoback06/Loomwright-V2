// Workflow T80: Factions tab. The dossier read flat keys (facType / leaders /
// members / territory / relationships) but live factions store these under
// entity.data.* (and `kind` is a top-level identity key). A new
// liveFactionToDetail adapter maps them, mirrors the bestiary adapter, and
// the dead +Leader/+Member/+Territory buttons were replaced by a real Edit.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openFactionsPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "factions" } })));
  await page.waitForTimeout(300);
}

test.describe("T80. Factions tab", () => {
  test("dossier renders LIVE data via the adapter", async ({ page }) => {
    await openFreshApp(page);
    const leader = await saveEntity(page, "cast", { name: "Magister Hale" }, { status: "active" });
    const member = await saveEntity(page, "cast", { name: "Sergeant Pike" }, { status: "active" });
    const hq = await saveEntity(page, "locations", { name: "Grey Bastion" }, { status: "active" });
    const rival = await saveEntity(page, "factions", { name: "The Tide Cult" }, { status: "active" });
    await saveEntity(page, "factions", {
      name: "The Grey Coats",
      kind: "Order",                                  // top-level identity key
      summary: "A salt-bitten martial order.",
      data: {
        ideology: "Order through the blade.",
        goals: ["Hold the pass", "Purge the cult"],
        leader: leader.id, members: [member.id], headquarters: hq.id,
        enemies: [rival.id],
      },
    }, { status: "active" });
    await openFactionsPanel(page);
    const body = page.locator("[data-ui='FactionsPanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });
    await body.locator(".loc-tree__name", { hasText: "The Grey Coats" }).click();

    const detail = page.locator("[data-ui='FactionDetail']");
    await expect(detail).toBeVisible({ timeout: 5000 });
    await expect(detail).toContainText("Order through the blade"); // data.ideology
    await expect(detail).toContainText("Magister Hale");           // data.leader resolved
    await expect(detail).toContainText("Sergeant Pike");           // data.members resolved
    await expect(detail).toContainText("Grey Bastion");            // data.headquarters -> territory
    await expect(detail).toContainText("The Tide Cult");           // data.enemies -> relationships

    // the reworked footer exposes a real Edit (dead +Leader/+Member removed)
    await detail.locator("[data-testid='fac-edit']").click();
    await expect(page.locator("[data-ui='EntityEditor'][data-entity-type='factions']")).toBeVisible({ timeout: 5000 });
  });
});
