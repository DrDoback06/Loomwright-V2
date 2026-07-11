// Workflow Z — Historical world state, branches, and retcon impact.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedWorldStateProject(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [
        { id: "z-ch1", num: 1, title: "The Gate", bodyText: "Mara carried the Witness Key through Salt Gate." },
        { id: "z-ch2", num: 2, title: "The Court", bodyText: "Mara gave the Witness Key to Soren in Lantern Court." },
        { id: "z-ch3", num: 3, title: "The Fracture", bodyText: "Soren broke the Witness Key and betrayed Mara." },
      ],
      activeChapterId: "z-ch3", manuscripts: {},
    });
    const mara = await B.EntityService.save("cast", {
      id: "z-mara", name: "Mara Vale", aliases: ["Mara"],
      data: {
        summary: "A courier.", currentLocation: { id: "z-court", name: "Lantern Court", type: "locations" },
        locationHistory: [
          { id: "zm1", from: null, to: { id: "z-gate", name: "Salt Gate", type: "locations" }, chapterId: "z-ch1", sourceQuote: "Mara entered Salt Gate." },
          { id: "zm2", from: { id: "z-gate", name: "Salt Gate", type: "locations" }, to: { id: "z-court", name: "Lantern Court", type: "locations" }, chapterId: "z-ch2", sourceQuote: "Mara entered Lantern Court." },
        ],
        knowledgeClaims: [{ id: "zk1", statement: "The court altered the record", state: "known", chapterId: "z-ch3", sourceQuote: "Mara learned the truth." }],
      },
    }, { status: "active" });
    const soren = await B.EntityService.save("cast", {
      id: "z-soren", name: "Soren Grey", aliases: ["Soren"], data: { summary: "A reluctant heir.", currentLocation: { id: "z-court", name: "Lantern Court", type: "locations" } },
    }, { status: "active" });
    const gate = await B.EntityService.save("locations", {
      id: "z-gate", name: "Salt Gate", data: { summary: "An old border gate.", placed: true, currentStatus: "sealed", statusHistory: [{ id: "zg1", previousStatus: "open", status: "sealed", chapterId: "z-ch3", sourceQuote: "Salt Gate was sealed." }] },
    }, { status: "active" });
    const court = await B.EntityService.save("locations", { id: "z-court", name: "Lantern Court", data: { summary: "Neutral ground.", placed: true, status: "open" } }, { status: "active" });
    const key = await B.EntityService.save("items", {
      id: "z-key", name: "Witness Key",
      data: {
        summary: "Records every transfer.", condition: "broken",
        currentOwner: { id: soren.id, name: soren.name, type: "cast" },
        currentLocation: { id: court.id, name: court.name, type: "locations" },
        relatedCharacters: [{ id: mara.id, name: mara.name, type: "cast" }, { id: soren.id, name: soren.name, type: "cast" }],
        ownershipHistory: [
          { id: "zo1", from: null, to: { id: mara.id, name: mara.name, type: "cast" }, chapterId: "z-ch1", sourceQuote: "Mara carried the Witness Key." },
          { id: "zo2", from: { id: mara.id, name: mara.name, type: "cast" }, to: { id: soren.id, name: soren.name, type: "cast" }, chapterId: "z-ch2", sourceQuote: "Mara gave the Witness Key to Soren." },
        ],
        statusHistory: [{ id: "zc1", previousCondition: "whole", condition: "broken", status: "broken", chapterId: "z-ch3", sourceQuote: "Soren broke the Witness Key." }],
      },
    }, { status: "active" });
    await B.EntityService.save("relationships", {
      id: "z-rel", name: "Mara Vale → Soren Grey",
      data: {
        fromId: mara.id, toId: soren.id, relationshipType: "trust",
        markers: [
          { id: "zr1", type: "trust", polarity: "positive", value: 70, chapterId: "z-ch2", sourceQuote: "Mara trusted Soren with the key." },
          { id: "zr2", type: "trust", polarity: "negative", value: 10, chapterId: "z-ch3", sourceQuote: "Soren betrayed Mara." },
        ],
      },
    }, { status: "active" });
    await B.OccurrenceService.saveMany([
      { occurrenceId: "ze1", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "z-ch1", sourceSentence: "Mara carried the Witness Key through Salt Gate.", startOffset: 18, endOffset: 29, coMentionedEntityIds: [mara.id, gate.id] },
      { occurrenceId: "ze2", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "z-ch2", sourceSentence: "Mara gave the Witness Key to Soren in Lantern Court.", startOffset: 14, endOffset: 25, coMentionedEntityIds: [mara.id, soren.id, court.id] },
      { occurrenceId: "ze3", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "z-ch3", sourceSentence: "Soren broke the Witness Key and betrayed Mara.", startOffset: 16, endOffset: 27, coMentionedEntityIds: [mara.id, soren.id] },
    ]);
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    window.dispatchEvent(new CustomEvent("lw:occurrence-store-updated"));
    window.dispatchEvent(new CustomEvent("lw:manuscript-chapters-updated"));
  });
}

async function openWorldState(page) {
  await page.locator("[data-testid='world-state-launcher']").click();
  const workspace = page.locator("[data-testid='historical-world-state']");
  await expect(workspace).toBeVisible({ timeout: 10000 });
  return workspace;
}

test.describe("Z. Historical world state", () => {
  test("reconstructs chapter truth and relationship trajectory without current-state leakage", async ({ page }) => {
    await openFreshApp(page);
    await seedWorldStateProject(page);
    const workspace = await openWorldState(page);

    await workspace.locator("[data-testid='world-anchor']").selectOption("z-ch1");
    const keyCard = workspace.locator("[data-testid='world-state-entity-z-key']");
    await expect(keyCard).toContainText("Mara Vale");
    await expect(keyCard).toContainText("whole");
    const maraCard = workspace.locator("[data-testid='world-state-entity-z-mara']");
    await expect(maraCard).toContainText("Salt Gate");
    await expect(maraCard).not.toContainText("1 claims");

    await workspace.locator("[data-testid='world-anchor']").selectOption("z-ch3");
    await expect(keyCard).toContainText("Soren Grey");
    await expect(keyCard).toContainText("broken");
    await expect(maraCard).toContainText("Lantern Court");
    await expect(maraCard).toContainText("1 claims");

    await workspace.locator("[data-testid='world-tab-timeline']").click();
    await expect(workspace.locator("[data-testid='world-timeline-z-ch2']")).toContainText("ownership");
    await expect(workspace.locator("[data-testid='world-timeline-z-ch3']")).toContainText("condition");
    await workspace.getByLabel("Relationship trajectory").selectOption("z-rel");
    await expect(workspace).toContainText("Mara trusted Soren with the key");
    await expect(workspace).toContainText("Soren betrayed Mara");
  });

  test("creates an alternative branch, compares it with canon, and sends proposals to Impact Review", async ({ page }) => {
    await openFreshApp(page);
    await seedWorldStateProject(page);
    const workspace = await openWorldState(page);
    await workspace.locator("[data-testid='world-anchor']").selectOption("z-ch2");
    await workspace.locator("[data-testid='world-tab-branches']").click();

    await workspace.locator("[data-testid='branch-create-name']").fill("Mara Keeps the Key");
    await workspace.locator("[data-testid='branch-create']").click();
    const branchOption = workspace.locator("[data-testid^='world-branch-']").filter({ hasText: "Mara Keeps the Key" });
    await expect(branchOption).toBeVisible({ timeout: 10000 });

    await workspace.locator("[data-testid='branch-change-entity']").selectOption("z-key");
    await workspace.locator("[data-testid='branch-change-path']").selectOption("data.currentOwner");
    await workspace.locator("[data-testid='branch-change-value']").selectOption("z-mara");
    await workspace.locator("[data-testid='branch-add-change']").click();
    await expect(workspace).toContainText("Soren Grey → Mara Vale");

    await workspace.locator("[data-testid='world-anchor']").selectOption("z-ch3");
    await workspace.locator("[data-testid='branch-change-path']").selectOption("data.condition");
    await workspace.locator("[data-testid='branch-change-value']").fill("whole");
    await workspace.locator("[data-testid='branch-add-change']").click();
    await expect(workspace).toContainText("broken → whole");
    await expect(workspace).toContainText(/2 fields/i);

    await workspace.locator("[data-testid='world-tab-snapshot']").click();
    const keyCard = workspace.locator("[data-testid='world-state-entity-z-key']");
    await expect(keyCard).toContainText("Mara Vale");
    await expect(keyCard).toContainText("whole");

    await workspace.locator("[data-testid='world-tab-branches']").click();
    await workspace.locator("[data-testid='branch-commit']").click();
    const state = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      return {
        ownerId: B.EntityService.getSync("z-key", "items")?.data?.currentOwner?.id,
        reviews: B.ReviewService.listSync().filter((row) => row.trackingKind === "branch-commit"),
      };
    });
    expect(state.ownerId).toBe("z-soren");
    expect(state.reviews.length).toBeGreaterThan(0);
    expect(state.reviews.some((row) => row.worldStateBranchId)).toBe(true);
  });

  test("previews retcon blast radius and proposes it without changing canon", async ({ page }) => {
    await openFreshApp(page);
    await seedWorldStateProject(page);
    const workspace = await openWorldState(page);
    await workspace.locator("[data-testid='world-anchor']").selectOption("z-ch1");
    await workspace.locator("[data-testid='world-tab-retcon']").click();

    await workspace.locator("[data-testid='retcon-entity']").selectOption("z-key");
    await workspace.locator("[data-testid='retcon-path']").selectOption("data.currentOwner");
    await workspace.locator("[data-testid='retcon-value']").selectOption("z-soren");
    await workspace.locator("[data-testid='retcon-analyse']").click();
    await expect(workspace).toContainText("Retcon impact");
    await expect(workspace).toContainText("Later chapters");
    await expect(workspace).toContainText("Dependent state changes");
    await expect(workspace).toContainText("Mara Vale");
    await expect(workspace).toContainText("Chapter 3 · The Fracture");

    await workspace.locator("[data-testid='retcon-propose']").click();
    const state = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      return {
        ownerId: B.EntityService.getSync("z-key", "items")?.data?.currentOwner?.id,
        retcons: B.ReviewService.listSync().filter((row) => row.trackingKind === "retcon"),
      };
    });
    expect(state.ownerId).toBe("z-soren");
    expect(state.retcons.length).toBe(1);
    expect(state.retcons[0].payload.retconImpact.chapterIds).toEqual(expect.arrayContaining(["z-ch2", "z-ch3"]));
  });

  test("opens historical state from a live dossier", async ({ page }) => {
    await openFreshApp(page);
    await seedWorldStateProject(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } })));
    const panel = page.locator("[data-panel-id='p-items']");
    await expect(panel).toBeVisible({ timeout: 10000 });
    await panel.locator("[data-testid='ent-row-z-key'], [data-testid='ent-card-z-key']").first().click();
    const dossier = panel.locator("[data-testid='entity-dossier-z-key']");
    await expect(dossier).toBeVisible({ timeout: 10000 });
    await panel.locator("[data-testid='dossier-world-state']").click();
    const workspace = page.locator("[data-testid='historical-world-state']");
    await expect(workspace).toBeVisible({ timeout: 10000 });
    await expect(workspace.locator("[data-testid='world-state-entity-z-key']")).toBeVisible();
  });
});
