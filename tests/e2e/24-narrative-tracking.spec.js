// Workflow X — Deep local narrative tracking.
//
// Project setup uses the existing backend; extraction, review and acceptance
// are driven through rendered controls. The assertions verify that prose is
// converted into linked, reviewable story state rather than decorative rows.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

const STORY_TEXT = [
  "Mara gave the Witness Key to Soren at Salt Gate.",
  "Soren entered Lantern Court.",
  "Mara learned that the Grey Coats had lowered their banner.",
  "Mara promised to find the missing witness.",
  "Soren betrayed Mara.",
  "Salt Gate was sealed.",
  "Mara had never met Soren.",
  "Mara stared toward Lantern Court.",
  "She entered Lantern Court.",
  "She suspected that Soren had lied.",
].join("\n");

async function seedTrackingProject(page) {
  await page.evaluate(async ({ text }) => {
    const B = window.LoomwrightBackend;
    await B.SettingsService.setSection("extraction", {
      aggressiveness: "balanced", autoAdd95: true, showAutoAddedInReview: true, threshold: 50, scan: {},
    });
    const mara = await B.EntityService.save("cast", {
      id: "x-mara", name: "Mara Vale", aliases: ["Mara"],
      data: { summary: "A courier.", currentLocation: null, knowledgeClaims: [], beliefs: [], goals: [] },
    }, { status: "active" });
    const soren = await B.EntityService.save("cast", {
      id: "x-soren", name: "Soren Grey", aliases: ["Soren"], data: { summary: "A reluctant heir." },
    }, { status: "active" });
    await B.EntityService.save("locations", {
      id: "x-gate", name: "Salt Gate", data: { summary: "An old border gate.", placed: true, status: "open" },
    }, { status: "active" });
    await B.EntityService.save("locations", {
      id: "x-court", name: "Lantern Court", data: { summary: "A neutral court.", placed: true },
    }, { status: "active" });
    await B.EntityService.save("factions", {
      id: "x-coats", name: "Grey Coats", aliases: ["the Grey Coats"], data: { summary: "A military order." },
    }, { status: "active" });
    await B.EntityService.save("items", {
      id: "x-key", name: "Witness Key",
      data: { summary: "Records every transfer.", currentOwner: { id: mara.id, name: mara.name, type: "cast" }, ownershipHistory: [] },
    }, { status: "active" });
    await B.EntityService.save("relationships", {
      id: "x-rel", name: "Mara Vale ↔ Soren Grey",
      data: { fromId: mara.id, toId: soren.id, relationshipType: "acquaintance", markers: [{ type: "familiarity", polarity: "positive" }] },
    }, { status: "active" });
    await B.ManuscriptChapterService.save({
      chapters: [{ id: "x-ch1", num: 1, title: "The Transfer", bodyText: text }],
      activeChapterId: "x-ch1",
      manuscripts: {},
    });
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    window.dispatchEvent(new CustomEvent("lw:manuscript-chapters-updated"));
  }, { text: STORY_TEXT });
}

async function runDeepLocalExtraction(page) {
  await page.evaluate(() => window.LoomwrightDispatchCallback?.("onOpenExtractionWizard", {
    detail: { scope: "chapter", chapterId: "x-ch1" },
  }));
  const wizard = page.locator("[data-testid='extraction-wizard']");
  await expect(wizard).toBeVisible({ timeout: 10000 });
  await wizard.locator("[data-testid='wizard-scope-chapter']").click();
  await wizard.locator("[data-testid='wizard-mode-deep']").click();
  await wizard.locator("[data-testid='wizard-start']").click();
  await expect(wizard).toHaveAttribute("data-state", "complete", { timeout: 15000 });
  await expect(page.locator("[data-testid='narrative-tracking-ribbon']")).toBeVisible({ timeout: 10000 });
  return wizard;
}

async function closeCompletedWizard(wizard) {
  await wizard.getByRole("button", { name: "Close", exact: true }).last().click();
}

test.describe("X. Deep local narrative tracking", () => {
  test("converts one chapter into state, perspective, thread, contradiction, and enriched occurrence proposals", async ({ page }) => {
    await openFreshApp(page);
    await seedTrackingProject(page);
    await runDeepLocalExtraction(page);

    const ribbon = page.locator("[data-testid='narrative-tracking-ribbon']");
    await expect(ribbon).toContainText("Local deep read complete");
    await expect(ribbon).toContainText("state changes");
    await expect(ribbon).toContainText("knowledge / beliefs");
    await expect(ribbon).toContainText("open threads");
    await expect(ribbon).toContainText("contradictions");

    const state = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      const queue = B.ReviewService.listSync();
      const report = B.ExtractionService.latestTrackingReportSync();
      const occurrences = B.OccurrenceService.listByChapterSync("x-ch1");
      return {
        report,
        ownership: queue.some((row) => row.trackingKind === "ownership" && row.existingEntityId === "x-key" && row.suggestedChanges?.currentOwner?.id === "x-soren"),
        movement: queue.some((row) => row.trackingKind === "movement" && row.existingEntityId === "x-soren" && row.suggestedChanges?.currentLocation?.id === "x-court"),
        knowledge: queue.some((row) => row.trackingKind === "knowledge" && row.existingEntityId === "x-mara"),
        belief: queue.some((row) => row.trackingKind === "belief" && row.existingEntityId === "x-mara"),
        promise: queue.some((row) => row.trackingKind === "promise" && row.entityType === "quests"),
        betrayal: queue.some((row) => row.trackingKind === "relationship" && row.suggestedChanges?.markers?.some((marker) => marker.type === "trust" && marker.polarity === "negative")),
        sealed: queue.some((row) => row.trackingKind === "world-state" && row.existingEntityId === "x-gate" && row.suggestedChanges?.status === "sealed"),
        contradiction: queue.some((row) => row.trackingKind === "contradiction" && row.conflict?.kind === "history-contradiction"),
        pronoun: queue.some((row) => row.trackingKind === "movement" && /previous sentence/i.test(row.summary || "")),
        occurrence: occurrences.find((row) => row.entityId === "x-key"),
      };
    });

    expect(state.report.stateChangeCount).toBeGreaterThanOrEqual(3);
    expect(state.report.knowledgeCount).toBeGreaterThanOrEqual(2);
    expect(state.report.promiseCount).toBeGreaterThanOrEqual(1);
    expect(state.report.contradictionCount).toBeGreaterThanOrEqual(1);
    expect(state.ownership).toBe(true);
    expect(state.movement).toBe(true);
    expect(state.knowledge).toBe(true);
    expect(state.belief).toBe(true);
    expect(state.promise).toBe(true);
    expect(state.betrayal).toBe(true);
    expect(state.sealed).toBe(true);
    expect(state.contradiction).toBe(true);
    expect(state.pronoun).toBe(true);
    expect(state.occurrence.sourceSentence).toContain("Witness Key");
    expect(state.occurrence.coMentionedEntityIds).toEqual(expect.arrayContaining(["x-mara", "x-soren"]));
    expect(state.occurrence.trackingTags).toContain("ownership");
  });

  test("accepts an ownership proposal through Impact Review and records reversible history", async ({ page }) => {
    await openFreshApp(page);
    await seedTrackingProject(page);
    const wizard = await runDeepLocalExtraction(page);
    await closeCompletedWizard(wizard);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } })));
    const panel = page.locator("[data-panel-id='p-items']");
    await expect(panel).toBeVisible({ timeout: 10000 });
    const card = panel.locator("[data-ui='ImpactReviewCardShell']").filter({ hasText: /Witness Key/ }).filter({ hasText: /passes|transferred|ownership/i }).first();
    await expect(card).toBeVisible({ timeout: 10000 });

    await card.locator("[data-testid='impact-toggle']").click();
    await expect(card).toContainText("Current owner");
    await expect(card).toContainText("Mara Vale");
    await expect(card).toContainText("Soren Grey");

    page.once("dialog", async (dialog) => dialog.accept());
    await card.getByRole("button", { name: "Accept" }).click();
    await expect(page.locator("[data-ui='ImpactReceiptHistory']")).toBeVisible({ timeout: 10000 });

    const accepted = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      const item = B.EntityService.getSync("x-key", "items");
      const receipts = B.ImpactReviewService.receiptHistory("items");
      return {
        ownerId: item.data.currentOwner?.id,
        historyCount: item.data.ownershipHistory?.length || 0,
        receipt: receipts.some((row) => row.impactReceipt?.changedEntities?.some((change) => change.id === "x-key")),
      };
    });
    expect(accepted.ownerId).toBe("x-soren");
    expect(accepted.historyCount).toBeGreaterThan(0);
    expect(accepted.receipt).toBe(true);
  });

  test("preserves extraction history across rendered re-runs", async ({ page }) => {
    await openFreshApp(page);
    await seedTrackingProject(page);
    let wizard = await runDeepLocalExtraction(page);
    await closeCompletedWizard(wizard);

    wizard = await runDeepLocalExtraction(page);
    const history = await page.evaluate(() => window.LoomwrightBackend.ExtractionService.loadHistorySync());
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(new Set(history.map((row) => row.sessionId)).size).toBeGreaterThanOrEqual(2);
  });
});
