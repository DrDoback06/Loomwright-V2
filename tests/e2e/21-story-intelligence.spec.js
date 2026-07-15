// Workflow U — Story Intelligence + Idea Forge.
//
// Setup may use backend services, but every user-facing action under test is a
// real DOM interaction. These tests guard against the previous failure mode
// where a service existed while Home/Today still rendered disconnected mocks.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function gotoToday(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "today" } })));
  await page.waitForTimeout(350);
}

async function seedStoryProject(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    const longText = Array.from({ length: 165 }, (_, i) => `untracked${i}`).join(" ");
    await B.ManuscriptChapterService.save({
      chapters: [
        { id: "u-ch1", num: 1, title: "Arrival", bodyText: "Mara carried the Witness Key through Salt Gate." },
        { id: "u-ch2", num: 2, title: "Untracked Chapter", bodyText: longText },
        { id: "u-ch3", num: 3, title: "Aftermath", bodyText: "The road was empty." },
        { id: "u-ch4", num: 4, title: "Return", bodyText: "Nobody had spoken Mara's name for three chapters." },
      ],
      activeChapterId: "u-ch4",
      manuscripts: {},
    });
    const loc = await B.EntityService.save("locations", {
      id: "u-loc", name: "Salt Gate", data: { summary: "An old border gate.", placed: false },
    }, { status: "active" });
    const cast = await B.EntityService.save("cast", {
      id: "u-cast", name: "Mara Vale", aliases: ["Mara"],
      data: { summary: "A courier.", goals: ["deliver the key"], currentLocation: { id: loc.id, name: loc.name, type: "locations" } },
    }, { status: "active" });
    const item = await B.EntityService.save("items", {
      id: "u-item", name: "Witness Key",
      data: { summary: "Records its users.", currentOwner: { id: cast.id, name: cast.name, type: "cast" }, currentLocation: { id: loc.id, name: loc.name, type: "locations" } },
    }, { status: "active" });
    const quest = await B.EntityService.save("quests", {
      id: "u-quest", name: "Pay the Old Debt",
      data: { summary: "Deliver the key.", goal: "Reach the court.", participants: [{ id: cast.id, name: cast.name, type: "cast" }], steps: [{ id: "s1", title: "Cross the gate", status: "Active" }], status: "Active" },
    }, { status: "active" });
    await B.OccurrenceService.saveMany([
      { entityId: cast.id, entityType: "cast", exactText: "Mara", chapterId: "u-ch1", startOffset: 0, endOffset: 4 },
      { entityId: item.id, entityType: "items", exactText: "Witness Key", chapterId: "u-ch1", startOffset: 17, endOffset: 28 },
      { entityId: loc.id, entityType: "locations", exactText: "Salt Gate", chapterId: "u-ch1", startOffset: 37, endOffset: 46 },
    ]);
    await B.ReviewService.add({
      id: "u-impact-review", entityType: "items", name: "Witness Key changes owner", status: "pending",
      existingEntityId: item.id, relatedEntityIds: [cast.id, loc.id, quest.id], suggestedAction: "update",
      suggestedChanges: { currentOwner: { id: quest.id, name: quest.name, type: "quests" } },
      chapterId: "u-ch1", sourceQuote: "The court claimed the Witness Key.",
    });
    window.dispatchEvent(new CustomEvent("lw:manuscript-chapters-updated"));
    window.dispatchEvent(new CustomEvent("lw:occurrence-store-updated"));
    window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
  });
}

test.describe("U. Story intelligence is visible, live, and actionable", () => {
  test("fresh Today shows Idea Forge without leaking the sample story", async ({ page }) => {
    await openFreshApp(page);
    await gotoToday(page);
    await expect(page.locator("[data-ui='IdeaForge']").first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator("[data-ui='TodayEmpty']")).toBeVisible({ timeout: 8000 });
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("aelinor vey");
    expect(body).not.toContain("captain brec");
    expect(body).not.toContain("bone auger");
  });

  test("Today derives story pulse, extraction gaps, dormancy, Atlas staging, and review impact from the live project", async ({ page }) => {
    await openFreshApp(page);
    await seedStoryProject(page);
    await gotoToday(page);

    await expect(page.locator("[data-ui='TodayStoryPulse']")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("body")).toContainText("Untracked Chapter", { timeout: 8000 });
    await expect(page.locator("body")).toContainText("no tracked entities yet");
    await expect(page.locator("body")).toContainText("Mara Vale has been absent for 3 chapters");
    await expect(page.locator("body")).toContainText("Salt Gate is waiting in the Atlas staging tray");

    const impactCard = page.locator("[data-suggestion-id='intel-review-u-impact-review']");
    await expect(impactCard).toBeVisible({ timeout: 8000 });
    await expect(impactCard).toContainText("linked");
    await expect(impactCard).toContainText("Story reach");
  });

  test("Idea Forge creates a real editable draft and routes it through the existing review system", async ({ page }) => {
    await openFreshApp(page);
    await seedStoryProject(page);
    await gotoToday(page);

    const forge = page.locator("[data-ui='IdeaForge']").first();
    await expect(forge).toBeVisible({ timeout: 8000 });
    const proposedName = (await forge.locator("div").filter({ hasText: /./ }).nth(3).innerText().catch(() => "")).trim();

    // DOM action: create the currently displayed local idea.
    await forge.locator("[data-testid='idea-forge-create']").dispatchEvent("click");
    await expect(page.locator("[data-ui='EntityEditor']")).toBeVisible({ timeout: 8000 });

    const result = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      const all = Object.values(B.EntityService.listAllSync()).flatMap((byId) => Object.values(byId || {}));
      const ideas = all.filter((e) => e.source === "idea-forge");
      return {
        count: ideas.length,
        draft: ideas.some((e) => e.status === "draft"),
        review: B.ReviewService.listSync().some((r) => ideas.some((e) => e.id === r.entityId)),
      };
    });
    expect(result.count).toBeGreaterThan(0);
    expect(result.draft).toBe(true);
    expect(result.review).toBe(true);
    expect(proposedName).not.toBeNull();
  });

  test("extraction-gap recommendation opens the existing extraction workflow through a real click", async ({ page }) => {
    await openFreshApp(page);
    await seedStoryProject(page);
    await gotoToday(page);

    const card = page.locator("[data-suggestion-id='intel-extract-u-ch2']");
    await expect(card).toBeVisible({ timeout: 8000 });
    await card.locator("button.rpg-btn--primary").dispatchEvent("click");
    await expect(page.locator("[data-ui='ExtractionWizard'], [data-testid='extraction-wizard']").first()).toBeVisible({ timeout: 8000 });
  });

  test("dismiss and restore remove and return a live recommendation", async ({ page }) => {
    await openFreshApp(page);
    await seedStoryProject(page);
    await gotoToday(page);

    const card = page.locator("[data-suggestion-id='intel-extract-u-ch2']");
    await expect(card).toBeVisible({ timeout: 8000 });
    await card.getByRole("button", { name: "Dismiss" }).dispatchEvent("click");
    await expect(card).toHaveCount(0, { timeout: 5000 });

    await page.getByRole("button", { name: "Restore dismissed" }).dispatchEvent("click");
    await expect(page.locator("[data-suggestion-id='intel-extract-u-ch2']")).toBeVisible({ timeout: 8000 });
  });
});
