// Workflow T20: Area 3 — Cast dossier becomes a fully-populated live hub.
//
// Verifies that the dossier (CastDetail) is driven by the live cast entity
// (data.* fields + occurrences + linked entities), the chapter scrubber works,
// related-member navigation hops between dossiers, jump-to-manuscript fires
// the right event, the live suggestions feed replaces the demo, and the
// CastBrain chat shows a configure-AI notice when no provider is set up.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openCastPanel(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } }));
  });
  await page.waitForTimeout(300);
}

test.describe("T20. Cast dossier — live hub", () => {
  test("dossier renders LIVE entity data (summary, role, identity, traits, relationships)", async ({ page }) => {
    await openFreshApp(page);
    // Seed a rich cast entity (data.* matches the EE_CAST schema).
    await saveEntity(page, "cast", {
      name: "Aelinor Vey",
      data: {
        role: "protagonist",
        summary: "Reigning queen of the Pale Reach.",
        title: "Queen of the Pale Reach",
        aliases: ["the small dark queen"],
        pronouns: "she/her",
        age: "twenty-nine winters",
        personality: "Watchful, patient, dry-witted.",
        strengths: ["watchful", "patient"],
        flaws: ["secret-keeping"],
        goals: ["broker peace with Hess"],
        arcSummary: "Inherits the Auger crisis; opens negotiations, then breaks them.",
      },
    }, { status: "active" });
    await openCastPanel(page);
    // The browse list shows the live character — click its row.
    await page.locator(".cast-row[data-cast-id]").first().click();
    const dossier = page.locator("[data-ui='CastDetail']");
    await expect(dossier).toBeVisible({ timeout: 5000 });
    // Hero + summary text from data.* surface in the dossier.
    await expect(dossier).toContainText("Aelinor Vey");
    await expect(dossier).toContainText("Queen of the Pale Reach");
    await expect(dossier).toContainText("Reigning queen of the Pale Reach.");
    await expect(dossier).toContainText("Inherits the Auger crisis");
    // Identity facts.
    await expect(dossier).toContainText("twenty-nine winters");
    await expect(dossier).toContainText("she/her");
    // Traits — strengths render with the positive tone, flaws with negative.
    await expect(dossier.locator(".cast-trait--positive")).toContainText("watchful");
    await expect(dossier.locator(".cast-trait--negative")).toContainText("secret-keeping");
    // Role chip uses the normalized role class.
    await expect(dossier.locator(".cast-row__role--protagonist")).toBeVisible();
  });

  test("relationship card navigates to the linked character's dossier", async ({ page }) => {
    await openFreshApp(page);
    // Seed two cast entities, link Aelinor via data.allies to Saren.
    const saren = await saveEntity(page, "cast", { name: "Saren of Hess", data: { role: "antagonist", summary: "Heir to House Hess." } }, { status: "active" });
    await saveEntity(page, "cast", {
      name: "Aelinor Vey",
      data: {
        role: "protagonist",
        summary: "Reigning queen of the Pale Reach.",
        allies: [{ id: saren.id, name: saren.name, type: "cast" }],
      },
    }, { status: "active" });
    await openCastPanel(page);
    // Open Aelinor's dossier first.
    await page.locator(".cast-row[data-cast-id]:has-text('Aelinor')").click();
    const dossier = page.locator("[data-ui='CastDetail']");
    await expect(dossier).toBeVisible({ timeout: 5000 });
    // The relationship card for Saren should be present and clickable.
    const relCard = page.locator("[data-testid='cast-rel-" + saren.id + "']");
    await expect(relCard).toBeVisible();
    await relCard.click();
    // The dossier swapped to Saren.
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("Saren of Hess");
    await expect(page.locator("[data-ui='CastDetail']")).toContainText("Heir to House Hess.");
  });

  test("mentions chart + chapter scrubber render when occurrences exist", async ({ page }) => {
    await openFreshApp(page);
    // Seed chapters + a cast entity + occurrences linking the cast across chapters.
    const cast = await saveEntity(page, "cast", { name: "Brec", data: { role: "supporting", summary: "Captain of the watch." } }, { status: "active" });
    await page.evaluate(async ({ castId }) => {
      const B = window.LoomwrightBackend;
      await B.ManuscriptChapterService.save({
        chapters: [
          { id: "ch-a", num: 1, title: "Arrival", state: "saved", bodyText: "Brec rode in." },
          { id: "ch-b", num: 2, title: "Reach", state: "saved", bodyText: "Brec waited." },
          { id: "ch-c", num: 3, title: "Letter", state: "saved", bodyText: "" },
        ],
        activeChapterId: "ch-a",
        manuscripts: { "ch-a": { text: "Brec rode in." }, "ch-b": { text: "Brec waited." }, "ch-c": { text: "" } },
        trashedChapters: [],
      });
      await B.OccurrenceService.saveMany([
        { entityId: castId, entityType: "cast", chapterId: "ch-a", exactText: "Brec rode in." },
        { entityId: castId, entityType: "cast", chapterId: "ch-b", exactText: "Brec waited." },
      ]);
    }, { castId: cast.id });
    await openCastPanel(page);
    await page.locator(".cast-row[data-cast-id]:has-text('Brec')").click();
    const dossier = page.locator("[data-ui='CastDetail']");
    await expect(dossier).toBeVisible({ timeout: 5000 });
    // Mentions strip rendered, with bars for chapters that had occurrences.
    await expect(dossier.locator(".cast-mentions__strip")).toBeVisible();
    // The scrubber is present with min=1 / max=3 (number of chapters).
    const scrubber = page.locator("[data-testid='cast-scrubber']");
    await expect(scrubber).toBeVisible();
    await expect(scrubber).toHaveAttribute("max", "3");
    // Scrub back to Ch.1 — the "As of Ch. 1" state chip appears.
    await scrubber.evaluate((el) => { el.value = "1"; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("input", { bubbles: true })); });
    await expect(page.locator("[data-testid='cast-scrub-state']")).toContainText("As of Ch. 1", { timeout: 3000 });
    // The first quote ("Brec rode in.") shows up (Ch.1).
    await expect(dossier.locator(".cast-quote")).toContainText("Brec rode in.");
  });

  test("'Open in manuscript' jumps to the chapter of the first occurrence", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Brec", data: { role: "supporting" } }, { status: "active" });
    await page.evaluate(async ({ castId }) => {
      const B = window.LoomwrightBackend;
      await B.ManuscriptChapterService.save({
        chapters: [{ id: "ch-x", num: 1, title: "Arrival", state: "saved", bodyText: "Brec rode in." }],
        activeChapterId: "ch-x",
        manuscripts: { "ch-x": { text: "Brec rode in." } },
        trashedChapters: [],
      });
      await B.OccurrenceService.saveMany([
        { entityId: castId, entityType: "cast", chapterId: "ch-x", exactText: "Brec rode in." },
      ]);
      window.__LW_LAST_SET_CHAPTER__ = null;
      window.addEventListener("lw:set-active-chapter", (e) => { window.__LW_LAST_SET_CHAPTER__ = e.detail && e.detail.chapterId; });
    }, { castId: cast.id });
    await openCastPanel(page);
    await page.locator(".cast-row[data-cast-id]:has-text('Brec')").click();
    await expect(page.locator("[data-ui='CastDetail']")).toBeVisible({ timeout: 5000 });
    // Footer "Open in manuscript" dispatches lw:set-active-chapter with the chapter.
    await page.locator("[data-ui='CastDetail'] >> text=Open in manuscript").click();
    const jumped = await page.evaluate(() => window.__LW_LAST_SET_CHAPTER__);
    expect(jumped).toBe("ch-x");
  });

  test("CastBrain chat shows a configure-AI notice when no provider is set", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", {
      name: "Aelinor Vey",
      data: { role: "protagonist", summary: "Queen of the Pale Reach.", personality: "Patient, dry-witted." },
    }, { status: "active" });
    await openCastPanel(page);
    await page.locator(".cast-row[data-cast-id]").first().click();
    await expect(page.locator("[data-ui='CastDetail']")).toBeVisible({ timeout: 5000 });
    // Type into the brain input and send. Without a provider, the brain shows
    // a configure-AI message and a Configure button — never silently fails.
    await page.locator("[data-testid='cast-brain-input']").fill("Why did you come north?");
    await page.locator("[data-testid='cast-brain-send']").click();
    const brain = page.locator("[data-ui='CastBrain']");
    await expect(brain).toContainText(/Configure an AI provider|API key|Local-only|Couldn't reach/i, { timeout: 5000 });
  });

  test("Suggested tab lists live ReviewService cast candidates (not the demo)", async ({ page }) => {
    await openFreshApp(page);
    // Add a pending review candidate of type cast.
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.add({
        id: "rq-cand-1",
        entityType: "cast",
        status: "pending",
        payload: { name: "Mara of Hess", context: "Mara of Hess stood at the dock." },
        confidence: 0.7,
        chapterId: "ch-1",
        reason: "new candidate",
      });
    });
    // Seed at least one cast entity so the browse view (not empty) renders.
    await saveEntity(page, "cast", { name: "Aelinor Vey", data: { role: "protagonist" } }, { status: "active" });
    await openCastPanel(page);
    // Switch to the Suggested sub-tab.
    await page.locator(".cast__subtab:has-text('Suggested')").click();
    await expect(page.locator(".cast-review__name")).toContainText("Mara of Hess", { timeout: 5000 });
    // Confirm the OLD demo name ("Mara, Reach girl" etc) does NOT appear — proves we're live.
    await expect(page.locator(".cast-review")).not.toContainText("Reach girl");
  });
});
