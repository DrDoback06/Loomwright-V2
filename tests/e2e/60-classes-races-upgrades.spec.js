// Workflow T60: Classes + Races tab upgrades — live-data adapters. The
// bespoke ClassDetail / RaceDetail were written against flat demo objects;
// live class/race entities store custom fields under entity.data.*, so a
// real one rendered default facets with every section empty. The adapters
// map data.* -> the flat shape, resolve related-entity refs, stringify
// rule-lists, and derive "members" from cast that reference the class/race.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openPanel(page, kind) {
  await page.evaluate((k) => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } })), kind);
  await page.waitForTimeout(300);
}

test.describe("T60. Classes + Races tab upgrades", () => {
  test("class dossier renders LIVE data + derived members", async ({ page }) => {
    await openFreshApp(page);
    const cls = await saveEntity(page, "classes", {
      name: "Salt-bearer",
      summary: "Keepers of the tide-rites.",
      data: {
        category: "Spiritual", role: "Healer",
        restrictions: [{ target: "May not", note: "carry iron" }],
        firstChapter: "Ch. 2",
      },
    }, { status: "active" });
    // a cast member of this class -> should appear as a derived member
    await saveEntity(page, "cast", { name: "Aelinor Vey", data: { class: cls.id } }, { status: "active" });
    await openPanel(page, "classes");
    await expect(page.locator("[data-ui='ClassesPanelBody']")).toBeVisible({ timeout: 5000 });
    const detail = page.locator("[data-ui='ClassDetail']");
    await expect(detail).toBeVisible({ timeout: 5000 });
    await expect(detail).toContainText("Spiritual");   // data.category facet
    await expect(detail).toContainText("Healer");      // data.role facet
    await expect(detail).toContainText("carry iron");  // data.restrictions rule -> string
    await expect(detail).toContainText("Aelinor Vey"); // derived member from cast.data.class
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/classes.png" });
  });

  test("race dossier renders LIVE data via the adapter", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "races", {
      name: "Reach-folk",
      summary: "Salt-cured coastal people.",
      data: {
        category: "Spirit", traits: ["Cold-acclimated", "Saltsense"],
        culture: "Tide-bound, plain-spoken.", habitat: "The Pale Reach",
      },
    }, { status: "active" });
    await openPanel(page, "races");
    await expect(page.locator("[data-ui='RacesPanelBody']")).toBeVisible({ timeout: 5000 });
    const detail = page.locator("[data-ui='RaceDetail']");
    await expect(detail).toBeVisible({ timeout: 5000 });
    await expect(detail).toContainText("Spirit");          // data.category facet (non-default)
    await expect(detail).toContainText("Cold-acclimated"); // data.traits
    await expect(detail).toContainText("Saltsense");
    await expect(detail).toContainText("Tide-bound");      // data.culture -> culture notes
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/races.png" });
  });
});
