// Workflow T79: Classes / Races — the "Assign to character" action was a
// dead data-callback (generic onAssign* patched the wrong field). It's now
// an inline picker that links a class/race to a cast member both ways, so
// the reverse "Example characters" lookup resolves it.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openPanel(page, kind) {
  await page.evaluate((k) => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } })), kind);
  await page.waitForTimeout(300);
}

test.describe("T79. Classes / Races — assign to character", () => {
  test("assigning a class to a character links both ways and lists the member", async ({ page }) => {
    await openFreshApp(page);
    const cls = await saveEntity(page, "classes", { name: "Saltsworn Knight", data: { category: "Martial", role: "Defender" } }, { status: "active" });
    const cast = await saveEntity(page, "cast", { name: "Aelinor Vey" }, { status: "active" });
    await openPanel(page, "classes");
    const body = page.locator("[data-ui='ClassesPanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });

    const picker = body.locator("[data-testid='rpg-assign']");
    await expect(picker).toBeVisible({ timeout: 5000 });
    await picker.selectOption({ label: "Aelinor Vey" });
    await page.waitForTimeout(300);

    const links = await page.evaluate(({ clsId, castId }) => {
      const ES = window.LoomwrightBackend.EntityService;
      const c = ES.getSync(castId, "cast"), k = ES.getSync(clsId, "classes");
      return { castClasses: (c.data && c.data.classes) || [], clsAssigned: (k.data && k.data.assignedCharacters) || [] };
    }, { clsId: cls.id, castId: cast.id });
    expect(links.castClasses).toContain(cls.id);
    expect(links.clsAssigned).toContain(cast.id);
    await expect(body).toContainText("Aelinor Vey"); // reverse "Example characters" lookup
  });

  test("assigning a race to a character links it both ways", async ({ page }) => {
    await openFreshApp(page);
    const race = await saveEntity(page, "races", { name: "Tidefolk", data: { category: "Folk" } }, { status: "active" });
    const cast = await saveEntity(page, "cast", { name: "Captain Brec" }, { status: "active" });
    await openPanel(page, "races");
    const body = page.locator("[data-ui='RacesPanelBody']");
    await expect(body).toBeVisible({ timeout: 5000 });

    const picker = body.locator("[data-testid='rpg-assign']");
    await expect(picker).toBeVisible({ timeout: 5000 });
    await picker.selectOption({ label: "Captain Brec" });
    await page.waitForTimeout(300);

    const links = await page.evaluate(({ rId, castId }) => {
      const ES = window.LoomwrightBackend.EntityService;
      const c = ES.getSync(castId, "cast"), r = ES.getSync(rId, "races");
      return { castRace: (c.data && c.data.race) || [], rLinked: (r.data && r.data.linkedCast) || [] };
    }, { rId: race.id, castId: cast.id });
    expect(links.castRace).toContain(race.id);
    expect(links.rLinked).toContain(cast.id);
    await expect(body).toContainText("Captain Brec");
  });
});
