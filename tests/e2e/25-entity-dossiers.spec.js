// Workflow Y — Live entity dossiers and cross-entity comparison.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedDossierProject(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [
        { id: "y-ch1", num: 1, title: "The Gate", bodyText: "Mara carried the Witness Key through Salt Gate." },
        { id: "y-ch2", num: 2, title: "The Court", bodyText: "Mara gave the Witness Key to Soren in Lantern Court." },
        { id: "y-ch3", num: 3, title: "The Fracture", bodyText: "Soren broke the Witness Key after Mara learned the truth." },
      ],
      activeChapterId: "y-ch3",
      manuscripts: {},
    });
    const mara = await B.EntityService.save("cast", {
      id: "y-mara", name: "Mara Vale", aliases: ["Mara"],
      data: {
        summary: "A courier carrying an inherited debt.", personality: "Precise and guarded", goals: ["Find the missing witness"],
        currentLocation: { id: "y-court", name: "Lantern Court", type: "locations" },
        knowledgeClaims: [{ id: "yk1", statement: "The court altered the old record", state: "known", certainty: "confirmed-to-character", chapterId: "y-ch3", sourceQuote: "Mara learned the truth." }],
        beliefs: [{ id: "yb1", statement: "Soren intends to betray her", state: "suspicion", certainty: "uncertain", chapterId: "y-ch2", sourceQuote: "Mara suspected Soren." }],
        locationHistory: [
          { id: "ym1", from: null, to: { id: "y-gate", name: "Salt Gate", type: "locations" }, chapterId: "y-ch1", sourceQuote: "Mara entered Salt Gate." },
          { id: "ym2", from: { id: "y-gate", name: "Salt Gate", type: "locations" }, to: { id: "y-court", name: "Lantern Court", type: "locations" }, chapterId: "y-ch2", sourceQuote: "Mara entered Lantern Court." },
        ],
      },
    }, { status: "active" });
    const soren = await B.EntityService.save("cast", {
      id: "y-soren", name: "Soren Grey", aliases: ["Soren"],
      data: { summary: "A reluctant heir.", personality: "Patient and calculating", goals: ["Control the court"], currentLocation: { id: "y-court", name: "Lantern Court", type: "locations" } },
    }, { status: "active" });
    const gate = await B.EntityService.save("locations", { id: "y-gate", name: "Salt Gate", data: { summary: "An old border gate.", placed: true, status: "sealed" } }, { status: "active" });
    const court = await B.EntityService.save("locations", { id: "y-court", name: "Lantern Court", data: { summary: "Neutral ground maintained by ritual.", placed: true, status: "open" } }, { status: "active" });
    const key = await B.EntityService.save("items", {
      id: "y-key", name: "Witness Key",
      data: {
        summary: "Records every transfer.", itemType: "story object", condition: "broken",
        currentOwner: { id: soren.id, name: soren.name, type: "cast" },
        currentLocation: { id: court.id, name: court.name, type: "locations" },
        ownershipHistory: [
          { id: "yo1", from: null, to: { id: mara.id, name: mara.name, type: "cast" }, chapterId: "y-ch1", sourceQuote: "Mara carried the Witness Key." },
          { id: "yo2", from: { id: mara.id, name: mara.name, type: "cast" }, to: { id: soren.id, name: soren.name, type: "cast" }, chapterId: "y-ch2", sourceQuote: "Mara gave the Witness Key to Soren." },
        ],
        statusHistory: [{ id: "ys1", previousCondition: "whole", condition: "broken", status: "broken", chapterId: "y-ch3", sourceQuote: "Soren broke the Witness Key." }],
        relatedCharacters: [{ id: mara.id, name: mara.name, type: "cast" }, { id: soren.id, name: soren.name, type: "cast" }],
      },
    }, { status: "active" });
    await B.EntityService.save("items", {
      id: "y-ledger", name: "Court Ledger",
      data: { summary: "Records public transfers.", itemType: "document", condition: "whole", currentOwner: { id: mara.id, name: mara.name, type: "cast" }, currentLocation: { id: court.id, name: court.name, type: "locations" } },
    }, { status: "active" });
    await B.EntityService.save("relationships", {
      id: "y-rel", name: "Mara Vale → Soren Grey",
      data: { fromId: mara.id, toId: soren.id, relationshipType: "trust", markers: [{ id: "yrm1", type: "trust", polarity: "negative", chapterId: "y-ch3", sourceQuote: "Soren betrayed Mara." }] },
    }, { status: "active" });
    await B.OccurrenceService.saveMany([
      { occurrenceId: "ye1", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "y-ch1", startOffset: 18, endOffset: 29, sourceSentence: "Mara carried the Witness Key through Salt Gate.", sceneIndex: 0, sentenceIndex: 0, sentiment: "neutral", trackingTags: ["ownership"], coMentionedEntityIds: [mara.id, gate.id] },
      { occurrenceId: "ye2", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "y-ch2", startOffset: 14, endOffset: 25, sourceSentence: "Mara gave the Witness Key to Soren in Lantern Court.", sceneIndex: 0, sentenceIndex: 0, sentiment: "neutral", trackingTags: ["ownership", "relationship"], coMentionedEntityIds: [mara.id, soren.id, court.id] },
      { occurrenceId: "ye3", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "y-ch3", startOffset: 16, endOffset: 27, sourceSentence: "Soren broke the Witness Key after Mara learned the truth.", sceneIndex: 0, sentenceIndex: 0, sentiment: "negative", trackingTags: ["world-state", "knowledge"], coMentionedEntityIds: [soren.id, mara.id] },
      { occurrenceId: "ye4", entityId: mara.id, entityType: "cast", exactText: "Mara", chapterId: "y-ch2", startOffset: 0, endOffset: 4, sourceSentence: "Mara gave the Witness Key to Soren in Lantern Court.", sceneIndex: 0, sentenceIndex: 0, sentiment: "neutral", trackingTags: ["ownership"], coMentionedEntityIds: [key.id, soren.id, court.id] },
      { occurrenceId: "ye5", entityId: soren.id, entityType: "cast", exactText: "Soren", chapterId: "y-ch3", startOffset: 0, endOffset: 5, sourceSentence: "Soren broke the Witness Key after Mara learned the truth.", sceneIndex: 0, sentenceIndex: 0, sentiment: "negative", trackingTags: ["world-state"], coMentionedEntityIds: [key.id, mara.id] },
    ]);
    await B.ReferencesService.save({
      id: "y-ref", kind: "research", title: "Court succession notes", content: "The Witness Key validates transfers at Lantern Court.",
      linkedEntities: [{ id: key.id, name: key.name, type: "items" }, { id: court.id, name: court.name, type: "locations" }], includedInAIContext: true,
    });
    await B.ReviewService.add({
      id: "y-review", entityType: "items", name: "Witness Key is secretly copied", status: "pending", existingEntityId: key.id,
      relatedEntityIds: [mara.id, soren.id, court.id], suggestedAction: "update", suggestedChanges: { secrets: ["A copy exists"] },
      chapterId: "y-ch3", sourceQuote: "A second key lay beneath the ledger.", confidence: 0.81, confidenceBand: "green",
    });
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    window.dispatchEvent(new CustomEvent("lw:occurrence-store-updated"));
    window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
    window.dispatchEvent(new CustomEvent("lw:manuscript-chapters-updated"));
  });
}

async function openItemDossier(page, id = "y-key") {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } })));
  const panel = page.locator("[data-panel-id='p-items']");
  await expect(panel).toBeVisible({ timeout: 10000 });
  await panel.locator(`[data-testid='ent-row-${id}'], [data-testid='ent-card-${id}']`).first().click();
  const dossier = panel.locator(`[data-testid='entity-dossier-${id}']`);
  await expect(dossier).toBeVisible({ timeout: 10000 });
  return { panel, dossier };
}

test.describe("Y. Live entity dossiers and comparison", () => {
  test("renders live overview, evidence, evolution, connections and review history from canonical stores", async ({ page }) => {
    await openFreshApp(page);
    await seedDossierProject(page);
    const { dossier } = await openItemDossier(page);

    await expect(dossier).toContainText("Witness Key");
    await expect(dossier).toContainText("3");
    await expect(dossier).toContainText("Current accepted state");
    await expect(dossier).toContainText("Soren Grey");

    await dossier.locator("[data-testid='dossier-tab-evidence']").click();
    await expect(dossier).toContainText("The Gate");
    await expect(dossier).toContainText("Mara gave the Witness Key to Soren");
    await expect(dossier).toContainText("ownership");

    await dossier.locator("[data-testid='dossier-tab-evolution']").click();
    await expect(dossier.locator("[data-testid='dossier-chapter-y-ch1']")).toContainText("Mara carried the Witness Key");
    await expect(dossier.locator("[data-testid='dossier-chapter-y-ch2']")).toContainText("Mara gave the Witness Key to Soren");
    await expect(dossier.locator("[data-testid='dossier-chapter-y-ch3']")).toContainText(/broken/i);

    await dossier.locator("[data-testid='dossier-as-of']").selectOption("y-ch1");
    await expect(dossier).toContainText("Mara Vale");
    await expect(dossier.locator("[data-testid='dossier-chapter-y-ch3']")).toHaveClass(/is-future/);

    await dossier.locator("[data-testid='dossier-tab-connections']").click();
    await expect(dossier.locator("[data-testid='dossier-connection-y-mara']")).toBeVisible();
    await expect(dossier.locator("[data-testid='dossier-connection-y-soren']")).toBeVisible();
    await expect(dossier).toContainText("Court succession notes");

    await dossier.locator("[data-testid='dossier-tab-history']").click();
    await expect(dossier.locator("[data-testid='dossier-review-y-review']")).toContainText("Witness Key is secretly copied");
    await expect(dossier).toContainText("pending");
  });

  test("compares cross-type entities, highlights differences and persists pins across panels", async ({ page }) => {
    await openFreshApp(page);
    await seedDossierProject(page);
    const { dossier } = await openItemDossier(page);

    await dossier.locator("[data-testid='dossier-pin']").click();
    await dossier.locator("[data-testid='dossier-compare']").click();
    const overlay = page.locator("[data-testid='entity-comparison-overlay']");
    await expect(overlay).toBeVisible({ timeout: 10000 });
    await overlay.getByLabel("Add entity to comparison").selectOption("y-mara");
    await overlay.getByRole("button", { name: "Add", exact: true }).click();
    await expect(overlay).toContainText("Witness Key");
    await expect(overlay).toContainText("Mara Vale");
    await expect(overlay).toContainText("Personality");
    await expect(overlay.locator(".led-compare__cell.is-different").first()).toBeVisible();
    await expect(overlay).toContainText(/differing fields/i);
    await overlay.getByRole("button", { name: /Pin selection across tabs/i }).click();
    await overlay.getByRole("button", { name: "Close", exact: true }).click();

    const pins = await page.evaluate(() => window.LoomwrightBackend.EntityDossierService.readPins());
    expect(pins.map((row) => row.id)).toEqual(expect.arrayContaining(["y-key", "y-mara"]));

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "locations" } })));
    const locationPanel = page.locator("[data-panel-id='p-locations']");
    await expect(locationPanel).toBeVisible({ timeout: 10000 });
    await locationPanel.locator("[data-testid='ent-row-y-court'], [data-testid='ent-card-y-court']").first().click();
    const locationDossier = locationPanel.locator("[data-testid='entity-dossier-y-court']");
    await expect(locationDossier).toBeVisible({ timeout: 10000 });
    await locationDossier.locator("[data-testid='dossier-compare']").click();
    const secondOverlay = page.locator("[data-testid='entity-comparison-overlay']");
    await expect(secondOverlay).toContainText("Lantern Court");
    await expect(secondOverlay).toContainText("Witness Key");
    await expect(secondOverlay).toContainText("Mara Vale");
  });

  test("extends the bespoke Cast detail instead of replacing it", async ({ page }) => {
    await openFreshApp(page);
    await seedDossierProject(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
    const panel = page.locator("[data-panel-id='p-cast']");
    await expect(panel).toBeVisible({ timeout: 10000 });
    await panel.getByText("Mara Vale", { exact: true }).first().click();
    await expect(panel.locator("[data-ui='CastLivingDossierExtension']")).toBeVisible({ timeout: 10000 });
    await expect(panel.locator("[data-testid='entity-dossier-y-mara']")).toContainText("Knowledge & intent");
    await expect(panel).toContainText("A courier carrying an inherited debt");
  });
});
