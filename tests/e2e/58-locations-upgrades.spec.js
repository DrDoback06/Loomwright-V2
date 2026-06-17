// Workflow T58: Locations tab upgrades — live-data adapter. The bespoke
// hierarchy/dossier was written against flat demo objects; live locations
// store custom fields under entity.data.*, so without the adapter a real
// location renders empty. Also covers the type/placed filters reading the
// normalised kind off data.*.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openLocationsPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "locations" } })));
  await page.waitForTimeout(300);
}

test.describe("T58. Locations tab upgrades", () => {
  test("dossier renders LIVE data via the adapter", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "locations", {
      name: "Vraska Pass",
      summary: "The only walkable line between the Reach and Hess.",
      data: {
        kind: "Mountain Pass", placed: true,
        description: "Salt-burned switchbacks, often closed by storm.",
        danger: "dangerous", currentStatus: "Closed by snow",
        climate: "Bitter, wind-scoured",
        routes: ["Salt road", "Coastal causeway"],
      },
    }, { status: "active" });
    await openLocationsPanel(page);
    const detail = page.locator("[data-ui='LocationDetail']");
    await expect(detail).toBeVisible({ timeout: 5000 });
    await expect(detail).toContainText("The only walkable line");  // top-level summary
    await expect(detail).toContainText("Salt-burned switchbacks"); // data.description
    await expect(detail).toContainText("dangerous");               // data.danger -> facet
    await expect(detail).toContainText("Closed by snow");          // data.currentStatus -> facet
    await expect(detail).toContainText("Mountain pass");           // "Mountain Pass" -> normalised kind
    await expect(detail).toContainText("Salt road");               // data.routes -> roads
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/locations.png" });
  });

  test("search + type/placed filters narrow the hierarchy", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "locations", { name: "Pale Reach Hold", data: { kind: "Fortress", placed: true } }, { status: "active" });
    await saveEntity(page, "locations", { name: "Brittlewood",     data: { kind: "Forest",   placed: false } }, { status: "active" });
    await saveEntity(page, "locations", { name: "Glass Court",     data: { kind: "Palace",   placed: true } }, { status: "active" });
    await openLocationsPanel(page);
    const rows = page.locator(".loc-tree__row");
    await expect(rows).toHaveCount(3, { timeout: 5000 });

    // free-text search
    await page.locator(".loc-body__search input").fill("glass");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Glass Court");
    await page.locator(".loc-body__search input").fill("");
    await expect(rows).toHaveCount(3);

    // placed filter reads data.placed via the adapter
    await page.locator(".loc-body__filter").nth(1).selectOption("unplaced");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Brittlewood");

    // type filter reads the normalised kind via the adapter
    await page.locator(".loc-body__filter").nth(1).selectOption("all");
    await page.locator(".loc-body__filter").nth(0).selectOption("fortress");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Pale Reach Hold");
  });
});
