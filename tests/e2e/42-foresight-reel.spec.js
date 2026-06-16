// Workflow T42: the Today "Foresight Reel" — the bold co-author hub that
// surfaces InsightService foresight as a rotating, ranked, actionable feed,
// with a "Run on: <character>" scope (computeForEntity-equivalent).
//
// Verifies the reel renders insight-derived items, exposes rotation controls
// when there's more than one, and scopes to a single character on demand.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function seedReelProject(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    const chapters = []; const manuscripts = {};
    for (let n = 1; n <= 6; n++) {
      const body = n === 1 ? "Anwen had blue eyes that night."
        : n === 2 ? "Anwen turned, her brown eyes catching the light."
        : "The rain kept on over the gate.";
      chapters.push({ id: "ch-" + n, num: n, title: "Ch " + n, state: "saved", bodyText: body });
      manuscripts["ch-" + n] = { text: body };
    }
    await B.ManuscriptChapterService.save({ chapters, activeChapterId: "ch-6", manuscripts, trashedChapters: [] });
  });
  const anwen = await saveEntity(page, "cast", { name: "Anwen", data: { role: "protagonist", backstory: "Holds the gate.", goals: ["survive"] } }, { status: "active" });
  const garrent = await saveEntity(page, "cast", { name: "Garrent", data: { role: "supporting", backstory: "A scout.", goals: ["report"] } }, { status: "active" });
  await page.evaluate(async ({ a, g }) => {
    await window.LoomwrightBackend.OccurrenceService.saveMany([
      { entityId: a, entityType: "cast", chapterId: "ch-1", exactText: "Anwen had blue eyes that night." },
      { entityId: a, entityType: "cast", chapterId: "ch-2", exactText: "Anwen turned, her brown eyes catching the light." },
      { entityId: g, entityType: "cast", chapterId: "ch-1", exactText: "Garrent" },
      { entityId: g, entityType: "cast", chapterId: "ch-6", exactText: "Garrent" }, // mid-story absence gap
    ]);
  }, { a: anwen.id, g: garrent.id });
  await saveEntity(page, "quests", { name: "The Silent Errand", data: { status: "active", steps: [{ title: "Begin", status: "open" }] } }, { status: "active" });
  await saveEntity(page, "items", { name: "Crown of Ash", data: { rarity: "Legendary" } }, { status: "active" }); // promise/payoff
  await page.evaluate(() => { try { window.LoomwrightBackend.InsightService.bump(); } catch (_) {} });
  return { anwen, garrent };
}

async function openToday(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "today" } })));
  const reel = page.locator("[data-ui='ForesightReel']");
  await expect(reel).toBeVisible({ timeout: 8000 });
  return reel;
}

test.describe("T42. Today Foresight Reel", () => {
  test("renders insight-derived foresight with rotation controls", async ({ page }) => {
    await openFreshApp(page);
    await seedReelProject(page);
    const reel = await openToday(page);
    await expect(reel).toContainText("Foresight");
    await expect(reel.locator(".foresight-reel__title")).toBeVisible();
    // Several seeded insights → a multi-item reel with a counter.
    const count = await reel.locator(".foresight-reel__count").textContent();
    expect(count).toMatch(/\/\s*[2-9]/);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/foresight-reel.png", fullPage: false });
  });

  test("Run-on-character scopes the reel to one cast member", async ({ page }) => {
    await openFreshApp(page);
    await seedReelProject(page);
    const reel = await openToday(page);
    await reel.locator(".foresight-reel__focus select").selectOption({ label: "Garrent" });
    await expect(reel).toContainText(/Garrent/);
    await expect(reel).toContainText(/disappears|gone quiet|missing/i);
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/foresight-reel-character.png", fullPage: false });
  });

  test("next/prev advance through the feed", async ({ page }) => {
    await openFreshApp(page);
    await seedReelProject(page);
    const reel = await openToday(page);
    await reel.locator(".foresight-reel__play").click(); // pause auto-rotation
    const title = reel.locator(".foresight-reel__title");
    const first = (await title.textContent() || "").trim();
    await reel.locator(".foresight-reel__nav").last().click(); // next
    await expect
      .poll(async () => (await title.textContent() || "").trim(), { timeout: 4000 })
      .not.toBe(first);
  });
});
