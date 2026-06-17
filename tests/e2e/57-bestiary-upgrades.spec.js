// Workflow T57: Bestiary tab upgrades — live-data adapter (the dossier now
// reads entity.data.* with the editor's field ids, derives mentions from
// occurrences, and maps the threat tier to the 1-5 bar) + the review button.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openBestiaryPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "bestiary" } })));
  await page.waitForTimeout(300);
}

test.describe("T57. Bestiary tab upgrades", () => {
  test("dossier renders LIVE data via the adapter", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "bestiary", {
      name: "Auger Wake",
      data: {
        speciesType: "Spirit-beast", threatLevel: "apex", habitat: "Brine caves of Hess",
        behaviour: "Stalks the tideline at dusk.", abilities: ["tide-call", "salt-shroud"],
        weaknesses: ["fresh water"], diet: "carrion",
      },
    }, { status: "active" });
    await openBestiaryPanel(page);
    await page.locator(".loc-tree__row").first().click();
    const detail = page.locator("[data-ui='BestiaryDetail']");
    await expect(detail).toBeVisible({ timeout: 5000 });
    await expect(detail).toContainText("Spirit-beast");        // data.speciesType -> species
    await expect(detail).toContainText("Brine caves of Hess"); // data.habitat
    await expect(detail).toContainText("tide-call");           // data.abilities
    await expect(detail).toContainText("fresh water");         // data.weaknesses
    await expect(detail.locator("[data-ui='ThreatBar']")).toContainText("5/5"); // "apex" -> 5
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/bestiary.png" });
  });

  test("review-queue button opens the review panel", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "bestiary", { name: "Hess Wolfhound", data: { speciesType: "beast" } }, { status: "active" });
    await openBestiaryPanel(page);
    await page.locator("[data-callback='onOpenBestiaryReviewQueue']").click();
    await expect(page.getByText("Nothing waiting on you")).toBeVisible({ timeout: 5000 });
  });
});
