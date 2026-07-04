// Workflow T40: The code-first insight engine (InsightService) renders
// as actionable cards on Today and Home — zero AI tokens.
//
// Detectors covered at the DOM level: contradiction (eye colour flip),
// stalled thread (open quest gone quiet), orphan (unconnected record),
// broken link (relationship to a deleted cast), incomplete (missing key
// fields). Card actions open the right surface.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function seedInsightProject(page) {
  // Two chapters with a flipping eye colour + a quiet open quest + an orphan.
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [
        { id: "ch-1", num: 1, title: "One", state: "saved", bodyText: "Anwen had blue eyes that night. She swore fealty to Hess." },
        { id: "ch-2", num: 2, title: "Two", state: "saved", bodyText: "Anwen turned, her brown eyes catching the light." },
        { id: "ch-3", num: 3, title: "Three", state: "saved", bodyText: "Rain on the gate." },
      ],
      activeChapterId: "ch-3",
      manuscripts: {
        "ch-1": { text: "Anwen had blue eyes that night. She swore fealty to Hess." },
        "ch-2": { text: "Anwen turned, her brown eyes catching the light." },
        "ch-3": { text: "Rain on the gate." },
      },
      trashedChapters: [],
    });
  });
  const anwen = await saveEntity(page, "cast", { name: "Anwen", data: { role: "protagonist", backstory: "Holds the gate.", goals: ["survive"] } }, { status: "active" });
  await page.evaluate(async ({ id }) => {
    await window.LoomwrightBackend.OccurrenceService.saveMany([
      { entityId: id, entityType: "cast", chapterId: "ch-1", exactText: "Anwen had blue eyes that night." },
      { entityId: id, entityType: "cast", chapterId: "ch-2", exactText: "Anwen turned, her brown eyes catching the light." },
    ]);
  }, { id: anwen.id });
  await saveEntity(page, "quests", { name: "The Silent Errand", data: { status: "active", steps: [{ title: "Begin", status: "open" }] } }, { status: "active" });
  await saveEntity(page, "cast", { name: "Orphan Olya", data: {} }, { status: "active" });
  return anwen;
}

test.describe("T40. Code-first insights on Today + Home", () => {
  test("InsightService returns the expected kinds for the seeded project", async ({ page }) => {
    await openFreshApp(page);
    await seedInsightProject(page);
    const kinds = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      B.InsightService.bump();
      return B.InsightService.computeInsights().insights.map((i) => ({ kind: i.kind, title: i.title, severity: i.severity }));
    });
    expect(kinds.some((k) => k.kind === "contradiction" && /eye colour/.test(k.title))).toBe(true);
    expect(kinds.some((k) => k.kind === "stalled-thread" && /Silent Errand/.test(k.title))).toBe(true);
    expect(kinds.some((k) => k.kind === "orphan" && /Olya/.test(k.title))).toBe(true);
  });

  test("Today panel renders insight cards under the right section filters", async ({ page }) => {
    await openFreshApp(page);
    await seedInsightProject(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "today" } }));
    });
    const today = page.locator("[data-ui='TodayPanelBody']");
    await expect(today).toBeVisible({ timeout: 5000 });
    // Continuity filter → the eye-colour contradiction card.
    await today.locator("button.today__filter:has-text('Continuity')").click();
    await expect(today).toContainText(/eye colour changes between chapters/i, { timeout: 5000 });
    await expect(today).toContainText(/blue|brown/i);
    // Threads filter → the stalled quest.
    await today.locator("button.today__filter:has-text('Dangling')").click();
    await expect(today).toContainText("The Silent Errand");
    await expect(today).toContainText(/gone quiet/i);
    // Untouched filter → the orphan.
    await today.locator("button.today__filter:has-text('Untouched')").click();
    await expect(today).toContainText("Orphan Olya");
  });

  test("broken relationship link surfaces as a high-severity card", async ({ page }) => {
    await openFreshApp(page);
    const a = await saveEntity(page, "cast", { name: "Living Half", data: {} }, { status: "active" });
    await saveEntity(page, "relationships", {
      name: "Severed bond",
      data: { from: { id: a.id, name: "Living Half", type: "cast" }, to: { id: "cast-ghost-id", name: "Deleted Ghost", type: "cast" }, bondType: "friend" },
    }, { status: "active" });
    const insights = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      B.InsightService.bump();
      return B.InsightService.computeInsights().insights;
    });
    const broken = insights.find((i) => i.kind === "broken-link");
    expect(broken).toBeTruthy();
    expect(broken.severity).toBe("high");
  });

  test("Home shows the Needs-attention card and its action opens the editor", async ({ page }) => {
    await openFreshApp(page);
    await seedInsightProject(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "home" } }));
    });
    // Close the default side panels so the grid is fully clickable.
    for (const id of ["p-locations", "p-quests", "p-tangle"]) {
      const btn = page.locator(`.pstk__panel[data-panel-id='${id}'] [data-callback='onClosePanel']`);
      if (await btn.count()) await btn.click();
    }
    const card = page.locator("[data-testid='home-insights']");
    await expect(card).toBeVisible({ timeout: 6000 });
    await expect(card).toContainText("Needs attention");
    // Top items are severity-ordered: the contradiction (warn) is present.
    await expect(card).toContainText(/eye colour|gone quiet|isn't connected/);
    // Clicking a card opens the entity editor on that record.
    await card.locator(".home-warning").first().click();
    await expect(page.locator("[data-ui='EntityEditor']")).toBeVisible({ timeout: 5000 });
  });
});
