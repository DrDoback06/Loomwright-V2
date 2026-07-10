// Workflow T23: Area 3 leftover — a discovered travel location (cast.data.location,
// set by the extraction travel pass) surfaces in the Cast dossier and its
// Atlas links, not only explicit home/currentLocation fields.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openCastPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
  await page.waitForTimeout(300);
}

test.describe("T23. Cast dossier — discovered travel location", () => {
  test("data.location resolves to the linked location and shows as 'Currently'", async ({ page }) => {
    await openFreshApp(page);
    const place = await saveEntity(page, "locations", { name: "Brittlewood", data: { summary: "A frost-bitten road town." } }, { status: "active" });
    // The travel accept flow lands data.location = <locationId> on the cast entity.
    await saveEntity(page, "cast", {
      name: "Thane Wolder",
      data: { role: "protagonist", summary: "Warden of the Ash Marches.", location: place.id },
    }, { status: "active" });

    await openCastPanel(page);
    await page.locator(".cast-row[data-cast-id]:has-text('Thane')").click();
    const dossier = page.locator("[data-ui='CastDetail']");
    await expect(dossier).toBeVisible({ timeout: 5000 });
    // The resolved travel location surfaces in the identity block.
    await expect(dossier).toContainText("Currently");
    await expect(dossier).toContainText("Brittlewood");
  });
});
