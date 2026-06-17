// Workflow T65: Quests + Events tabs — live-data adapters. QuestDetail /
// EventDetail were written against flat demo objects; live quest/event
// entities use `title` (top-level) + custom fields under entity.data.*
// (with naming mismatches: relatedQuests/relatedItems/characterStateChanges).
// A real quest/event rendered nearly empty, the quest step "Complete" button
// was an inert no-op, and the event type filter read a flat field. The
// adapters map data.* -> the flat shape (resolving refs + deriving mentions),
// and step completion now persists.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function openPanel(page, kind) {
  await page.evaluate((k) => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: k } })), kind);
  await page.waitForTimeout(300);
}

test.describe("T65. Quests + Events tab upgrades", () => {
  test("quest dossier renders LIVE data + step completion persists", async ({ page }) => {
    await openFreshApp(page);
    const hero = await saveEntity(page, "cast", { name: "Captain Brec" }, { status: "active" });
    const place = await saveEntity(page, "locations", { name: "Brittlewood" }, { status: "active" });
    const q = await saveEntity(page, "quests", {
      title: "Brec's Letter",
      summary: "A sealed letter lost in the scrub.",
      data: {
        questType: "Side quest", goal: "Recover the Letter-key before the thaw.",
        steps: [{ id: "s1", title: "Search the Brittlewood", status: "todo", chapter: "Ch. 5" }],
        participants: [hero.id], locations: [place.id],
        conditions: [{ target: "Daylight", note: "only passable by day" }],
        startChapter: "Ch. 4", completionChapter: "Ch. 6",
      },
    }, { status: "active" });
    await openPanel(page, "quests");
    const detail = page.locator("[data-ui='QuestDetail']");
    await expect(detail).toBeVisible({ timeout: 5000 });
    await expect(detail).toContainText("Recover the Letter-key"); // data.goal
    await expect(detail).toContainText("Search the Brittlewood"); // data.steps[].title
    await expect(detail).toContainText("Captain Brec");           // data.participants resolved
    await expect(detail).toContainText("only passable by day");   // data.conditions rule -> string
    // completing the step persists to entity.data.steps (was inert)
    await detail.getByRole("button", { name: "Complete" }).first().click();
    await page.waitForTimeout(250);
    const status = await page.evaluate((id) => window.LoomwrightBackend.EntityService.getSync(id, "quests").data.steps[0].status, q.id);
    expect(status).toBe("done");
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/quests.png" });
  });

  test("event dossier renders LIVE data via the adapter", async ({ page }) => {
    await openFreshApp(page);
    const hero = await saveEntity(page, "cast", { name: "Saren of Hess" }, { status: "active" });
    const place = await saveEntity(page, "locations", { name: "Glass Court" }, { status: "active" });
    const quest = await saveEntity(page, "quests", { title: "Hess negotiation" }, { status: "active" });
    await saveEntity(page, "events", {
      title: "The Auger Wake",
      summary: "The funeral-rite that opens the manuscript.",
      data: {
        eventType: "Ritual", chapter: "Ch. 1", location: place.id,
        cause: "A death in House Vey.", immediateOutcome: "Aelinor inherits the Auger.",
        participants: [hero.id], relatedQuests: [quest.id],
      },
    }, { status: "active" });
    await openPanel(page, "events");
    const detail = page.locator("[data-ui='EventDetail']");
    await expect(detail).toBeVisible({ timeout: 5000 });
    await expect(detail).toContainText("Ritual");               // data.eventType
    await expect(detail).toContainText("A death in House Vey");  // data.cause
    await expect(detail).toContainText("Aelinor inherits");      // data.immediateOutcome
    await expect(detail).toContainText("Saren of Hess");         // data.participants resolved
    await expect(detail).toContainText("Glass Court");           // data.location resolved
    await expect(detail).toContainText("Hess negotiation");      // data.relatedQuests resolved
    if (process.env.SHOT) await page.screenshot({ path: "/tmp/events.png" });
  });
});
