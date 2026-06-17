// Workflow T56: Cast tab upgrades — roster search + the dossier "Link…" action.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openCastPanel(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
  await page.waitForTimeout(300);
}

test.describe("T56. Cast tab upgrades", () => {
  test("roster search narrows the list", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Aelinor Vey", data: { role: "protagonist", summary: "Queen of the Pale Reach." } }, { status: "active" });
    await saveEntity(page, "cast", { name: "Saren of Hess", data: { role: "supporting" } }, { status: "active" });
    await saveEntity(page, "cast", { name: "Captain Brec", data: { role: "supporting" } }, { status: "active" });
    await openCastPanel(page);
    const rows = page.locator(".cast-row[data-cast-id]");
    await expect(rows).toHaveCount(3, { timeout: 5000 });
    await page.locator("[data-testid='cast-search']").fill("saren");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Saren");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/cast-search.png" });
    await page.locator("[data-testid='cast-search']").fill("vey");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Aelinor");
    await page.locator("[data-testid='cast-search']").fill("");
    await expect(rows).toHaveCount(3);
  });

  test("dossier 'Link…' opens the relationships editor", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Aelinor Vey", data: { role: "protagonist", summary: "Queen." } }, { status: "active" });
    await openCastPanel(page);
    await page.locator(".cast-row[data-cast-id]").first().click();
    await expect(page.locator("[data-ui='CastDetail']")).toBeVisible({ timeout: 5000 });
    await page.locator("[data-testid='cast-link']").click();
    await expect(page.locator("[data-ui='EntityEditor']")).toBeVisible({ timeout: 5000 });
  });
});
