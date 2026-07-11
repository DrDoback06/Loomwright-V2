// Workflow W — Impact Review Centre.
//
// These tests seed project state through the existing backend, then exercise
// every decision through rendered controls: inspect, postpone, scenario,
// accept, receipt, and safe revert.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedImpactProject(page) {
  await page.evaluate(async () => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [
        { id: "w-ch1", num: 1, title: "The Transfer", bodyText: "Mara gave the Witness Key to Soren at Salt Gate." },
        { id: "w-ch2", num: 2, title: "The Debt", bodyText: "The old debt followed them into the city." },
      ],
      activeChapterId: "w-ch1",
      manuscripts: {},
    });
    const mara = await B.EntityService.save("cast", { id: "w-mara", name: "Mara Vale", data: { summary: "A courier." } }, { status: "active" });
    const soren = await B.EntityService.save("cast", { id: "w-soren", name: "Soren Grey", data: { summary: "A reluctant heir." } }, { status: "active" });
    const gate = await B.EntityService.save("locations", { id: "w-gate", name: "Salt Gate", data: { summary: "An old border gate.", placed: true } }, { status: "active" });
    const quest = await B.EntityService.save("quests", {
      id: "w-quest", name: "Pay the Old Debt",
      data: {
        summary: "Settle the inherited debt.",
        participants: [{ id: mara.id, name: mara.name, type: "cast" }, { id: soren.id, name: soren.name, type: "cast" }],
        locations: [{ id: gate.id, name: gate.name, type: "locations" }],
      },
    }, { status: "active" });
    const key = await B.EntityService.save("items", {
      id: "w-key", name: "Witness Key",
      data: {
        summary: "Records every transfer.",
        currentOwner: { id: mara.id, name: mara.name, type: "cast" },
        currentLocation: { id: gate.id, name: gate.name, type: "locations" },
        relatedQuests: [{ id: quest.id, name: quest.name, type: "quests" }],
      },
    }, { status: "active" });
    await B.OccurrenceService.saveMany([
      { occurrenceId: "w-occ-mara", entityId: mara.id, entityType: "cast", exactText: "Mara", chapterId: "w-ch1", startOffset: 0, endOffset: 4 },
      { occurrenceId: "w-occ-key", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "w-ch1", startOffset: 14, endOffset: 25 },
      { occurrenceId: "w-occ-soren", entityId: soren.id, entityType: "cast", exactText: "Soren", chapterId: "w-ch1", startOffset: 29, endOffset: 34 },
      { occurrenceId: "w-occ-candidate", candidateId: "w-candidate", entityId: null, entityType: "items", exactText: "gave", chapterId: "w-ch1", startOffset: 5, endOffset: 9 },
    ]);
    await B.ReviewService.add({
      id: "w-review", candidateId: "w-candidate", entityType: "items", name: "Witness Key changes owner", status: "pending",
      existingEntityId: key.id, relatedEntityIds: [mara.id, soren.id, gate.id, quest.id], suggestedAction: "update",
      suggestedChanges: { currentOwner: { id: soren.id, name: soren.name, type: "cast" } },
      chapterId: "w-ch1", paragraphId: "p1",
      sourceQuote: "Mara gave the Witness Key to Soren at Salt Gate.", matchType: "inferred",
    });
    window.dispatchEvent(new CustomEvent("lw:entity-store-updated"));
    window.dispatchEvent(new CustomEvent("lw:occurrence-store-updated"));
    window.dispatchEvent(new CustomEvent("lw:review-queue-updated"));
  });
}

async function openItemsImpactQueue(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "items" } })));
  await expect(page.locator("[data-panel-id='p-items']")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[data-ui='ImpactReviewCentre']")).toBeVisible({ timeout: 10000 });
  return page.locator("[data-testid='impact-shell-w-review']");
}

test.describe("W. Impact Review Centre", () => {
  test("renders evidence, before/after values, linked spiderweb, chapters, and consequence guidance", async ({ page }) => {
    await openFreshApp(page);
    await seedImpactProject(page);
    const shell = await openItemsImpactQueue(page);

    await expect(shell).toBeVisible();
    await expect(shell.locator("[data-ui='ImpactReviewBar']")).toContainText("linked");
    await shell.locator("[data-testid='impact-toggle']").click();

    const detail = page.locator("[data-testid='impact-detail-w-review']");
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("Mara gave the Witness Key to Soren at Salt Gate");
    await expect(detail).toContainText("Current owner");
    await expect(detail).toContainText("Mara Vale");
    await expect(detail).toContainText("Soren Grey");
    await expect(detail).toContainText("Pay the Old Debt");
    await expect(detail).toContainText("Salt Gate");
    await expect(detail).toContainText("Ch. 1 · The Transfer");
    await expect(detail).toContainText("Ownership");
  });

  test("postpones with a reason and returns the same decision to pending", async ({ page }) => {
    await openFreshApp(page);
    await seedImpactProject(page);
    const shell = await openItemsImpactQueue(page);
    await shell.locator("[data-testid='impact-toggle']").click();

    page.once("dialog", async (dialog) => dialog.accept("Need Soren's point of view"));
    await page.locator("[data-testid='impact-postpone-w-review']").click();
    await expect(shell).toHaveAttribute("data-status", "postponed", { timeout: 6000 });
    const stored = await page.evaluate(() => window.LoomwrightBackend.ImpactReviewService.getItemSync("w-review"));
    expect(stored.decision.reason).toContain("Soren");

    await page.locator("[data-testid='impact-resume-w-review']").click();
    await expect(shell).toHaveAttribute("data-status", "pending", { timeout: 6000 });
  });

  test("creates a non-canon scenario linked to the affected story graph", async ({ page }) => {
    await openFreshApp(page);
    await seedImpactProject(page);
    const shell = await openItemsImpactQueue(page);
    await shell.locator("[data-testid='impact-toggle']").click();

    page.once("dialog", async (dialog) => dialog.accept("Soren refuses the Witness Key"));
    await page.locator("[data-testid='impact-scenario-w-review']").click();
    await expect(shell).toHaveAttribute("data-status", "postponed", { timeout: 6000 });

    const scenario = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      return B.ReferencesService.listSync().find((reference) => reference.kind === "scenario" && reference.reviewScenario?.reviewItemId === "w-review");
    });
    expect(scenario).toBeTruthy();
    expect(scenario.title).toContain("Soren refuses");
    expect(scenario.reviewScenario.committed).toBe(false);
    expect(scenario.linkedEntities.some((entity) => entity.id === "w-key")).toBe(true);
  });

  test("accepts through the existing action, records actual changes, and safely reverts entities plus occurrence links", async ({ page }) => {
    await openFreshApp(page);
    await seedImpactProject(page);
    const shell = await openItemsImpactQueue(page);

    page.once("dialog", async (dialog) => dialog.accept());
    await shell.getByRole("button", { name: "Accept" }).click();
    await expect(shell).toHaveCount(0, { timeout: 10000 });

    const receipt = page.locator("[data-testid='impact-receipt-w-review']");
    await expect(receipt).toBeVisible({ timeout: 10000 });
    await expect(receipt).toContainText("Witness Key changes owner");
    await expect(receipt).toContainText("updated · Witness Key");

    let state = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      const item = B.EntityService.getSync("w-key", "items");
      const occurrence = B.OccurrenceService.listAllSync().find((row) => row.occurrenceId === "w-occ-candidate");
      const review = B.ImpactReviewService.getItemSync("w-review");
      return { ownerId: item.data.currentOwner.id, occurrenceEntityId: occurrence.entityId, status: review.status, occurrenceChanges: review.impactReceipt.changedOccurrences.length };
    });
    expect(state.ownerId).toBe("w-soren");
    expect(state.occurrenceEntityId).toBe("w-key");
    expect(state.status).toBe("done");
    expect(state.occurrenceChanges).toBeGreaterThan(0);

    page.once("dialog", async (dialog) => dialog.accept());
    await page.locator("[data-testid='impact-revert-w-review']").click();
    await expect(page.locator("[data-testid='impact-shell-w-review']")).toBeVisible({ timeout: 10000 });
    await expect(receipt).toHaveAttribute("data-reverted", "true", { timeout: 10000 });

    state = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      const item = B.EntityService.getSync("w-key", "items");
      const occurrence = B.OccurrenceService.listAllSync().find((row) => row.occurrenceId === "w-occ-candidate");
      const review = B.ImpactReviewService.getItemSync("w-review");
      return { ownerId: item.data.currentOwner.id, occurrenceEntityId: occurrence.entityId, candidateId: occurrence.candidateId, status: review.status };
    });
    expect(state.ownerId).toBe("w-mara");
    expect(state.occurrenceEntityId).toBeNull();
    expect(state.candidateId).toBe("w-candidate");
    expect(state.status).toBe("pending");
  });

  test("disables automatic revert when a later edit would be overwritten", async ({ page }) => {
    await openFreshApp(page);
    await seedImpactProject(page);
    const shell = await openItemsImpactQueue(page);
    page.once("dialog", async (dialog) => dialog.accept());
    await shell.getByRole("button", { name: "Accept" }).click();
    await expect(page.locator("[data-testid='impact-receipt-w-review']")).toBeVisible({ timeout: 10000 });

    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const item = B.EntityService.getSync("w-key", "items");
      await B.EntityService.update("items", item.id, { data: { ...item.data, condition: "cracked after acceptance" } });
    });

    const revert = page.locator("[data-testid='impact-revert-w-review']");
    await expect(revert).toBeDisabled({ timeout: 6000 });
    await expect(revert).toContainText("Later edits detected");
    await expect(page.locator("[data-testid='impact-receipt-w-review']")).toContainText("Revert paused");
  });
});
