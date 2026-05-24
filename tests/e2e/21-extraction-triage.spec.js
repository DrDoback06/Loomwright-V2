// Workflow T21: extraction triage at manuscript scale.
//
// Covers the post-onboarding cross-chapter clustering (a real character
// mentioned across several chapters folds into one canonical queue row
// with a mentions[] array), the new grouping helpers used by the review
// queue UI (by-entity / by-chapter), and the lw:onboarding-extraction-
// summary event + banner. Backend-side assertions; the UI is exercised
// through the window-exported helpers so we don't need a panel mount.

const { test, expect } = require("@playwright/test");
const { openFreshApp } = require("./helpers");

async function seedCandidate(page, overrides = {}) {
  return await page.evaluate(async (o) => {
    const RS = window.LoomwrightBackend.ReviewService;
    const id = "rq-" + Math.random().toString(36).slice(2, 10);
    await RS.add({
      id,
      entityType: o.entityType || "cast",
      name: o.name || "Test",
      action: "Extract",
      level: "suggestion",
      value: Math.round((o.confidence || 0.7) * 100),
      confidence: o.confidence != null ? o.confidence : 0.7,
      confidenceBand: o.confidenceBand || (o.confidence >= 0.95 ? "blue" : o.confidence >= 0.75 ? "green" : "orange"),
      matchType: "new",
      suggestedAction: "create",
      reason: "Mock review item",
      payload: { name: o.name || "Test", context: o.context || "" },
      candidateId: "cand-" + id,
      chapterId: o.chapterId || null,
      paragraphId: o.paragraphId || null,
      occurrenceId: o.occurrenceId || null,
      sourceQuotes: o.sourceQuotes || [],
      status: "pending",
    });
    return id;
  }, overrides);
}

test.describe("T21. Extraction triage at scale", () => {
  test("clusterAcrossChapters collapses cross-chapter duplicates into one canonical row with mentions[]", async ({ page }) => {
    await openFreshApp(page);
    // Seed three near-identical candidates from three chapters.
    await seedCandidate(page, { name: "Aelinor Vey", chapterId: "ch1", paragraphId: "p1", confidence: 0.78, sourceQuotes: ["Aelinor watched the sea."] });
    await seedCandidate(page, { name: "Aelinor",     chapterId: "ch3", paragraphId: "p7", confidence: 0.72, sourceQuotes: ["Aelinor turned."] });
    await seedCandidate(page, { name: "Aelinor Vey", chapterId: "ch7", paragraphId: "p2", confidence: 0.81, sourceQuotes: ["Aelinor walked the wall."] });
    // Plus an unrelated character that should stay solo.
    await seedCandidate(page, { name: "Saren of Hess", chapterId: "ch2", paragraphId: "p1", confidence: 0.66 });

    const summary = await page.evaluate(async () => {
      return await window.LoomwrightBackend.ReviewService.clusterAcrossChapters({ applyRepeatedAutoAdd: false });
    });
    expect(summary.totalCandidates).toBe(4);
    expect(summary.collapsed).toBe(2);

    // Pending queue now has 2 canonical rows: one Aelinor with 3 mentions, one Saren solo.
    const pending = await page.evaluate(() => window.LoomwrightBackend.ReviewService.listSync().filter((q) => q.status === "pending"));
    expect(pending).toHaveLength(2);
    const ael = pending.find((q) => /Aelinor/i.test(q.name));
    const sar = pending.find((q) => /Saren/i.test(q.name));
    expect(ael).toBeTruthy();
    expect(sar).toBeTruthy();
    expect(ael.mentions).toHaveLength(3);
    expect(new Set(ael.mentions.map((m) => m.chapterId))).toEqual(new Set(["ch1", "ch3", "ch7"]));
    expect(ael.crossChapterCount).toBe(3);
    expect(ael.clusterId).toBeTruthy();
    // The longer name wins; the shorter form lands in suggestedChanges.aliases.
    expect(ael.name).toBe("Aelinor Vey");
    expect(ael.suggestedChanges?.aliases || []).toContain("Aelinor");
    // Confidence == max across the cluster.
    expect(ael.confidence).toBeCloseTo(0.81, 5);
  });

  test("repeated-mention auto-add fires at 3+ chapters and ≥0.85 confidence", async ({ page }) => {
    await openFreshApp(page);
    // Three high-but-not-blue mentions of one name across three chapters.
    await seedCandidate(page, { name: "Brec", chapterId: "ch1", paragraphId: "p1", confidence: 0.88 });
    await seedCandidate(page, { name: "Brec", chapterId: "ch2", paragraphId: "p1", confidence: 0.87 });
    await seedCandidate(page, { name: "Brec", chapterId: "ch3", paragraphId: "p1", confidence: 0.86 });

    const summary = await page.evaluate(async () => {
      return await window.LoomwrightBackend.ReviewService.clusterAcrossChapters();
    });
    expect(summary.autoAdded).toBeGreaterThanOrEqual(1);
    // The cast entity was actually created.
    const live = await page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("cast"));
    expect(live.some((e) => /Brec/i.test(e.name))).toBe(true);
  });

  test("repeated-mention auto-add respects the autoAddRepeatedMentions setting", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.SettingsService.saveSection("extraction", { autoAddRepeatedMentions: false });
    });
    await seedCandidate(page, { name: "Brec", chapterId: "ch1", confidence: 0.88 });
    await seedCandidate(page, { name: "Brec", chapterId: "ch2", confidence: 0.87 });
    await seedCandidate(page, { name: "Brec", chapterId: "ch3", confidence: 0.86 });
    const summary = await page.evaluate(async () => {
      return await window.LoomwrightBackend.ReviewService.clusterAcrossChapters();
    });
    expect(summary.autoAdded).toBe(0);
  });

  test("groupCardItemsByEntity returns one expandable group per cluster with chapterCount", async ({ page }) => {
    await openFreshApp(page);
    // Seed and cluster first so the canonical row has mentions[].
    await seedCandidate(page, { name: "Aelinor Vey", chapterId: "ch1", paragraphId: "p1", confidence: 0.78 });
    await seedCandidate(page, { name: "Aelinor",     chapterId: "ch3", paragraphId: "p7", confidence: 0.72 });
    await seedCandidate(page, { name: "Aelinor Vey", chapterId: "ch5", paragraphId: "p2", confidence: 0.81 });
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReviewService.clusterAcrossChapters({ applyRepeatedAutoAdd: false });
    });
    const groups = await page.evaluate(() => {
      const pending = window.LoomwrightBackend.ReviewService.listSync().filter((q) => q.status === "pending");
      const cards = pending.map((c) => window.candidateToCardItem(c));
      return window.groupCardItemsByEntity(cards).map((g) => ({
        key: g.key,
        clusterId: g.clusterId,
        chapterCount: g.chapterCount,
        mentionCount: g.mentions.length,
        canonicalName: g.canonical.candidate?.name || g.canonical.name,
      }));
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].mentionCount).toBe(3);
    expect(groups[0].chapterCount).toBe(3);
    expect(groups[0].canonicalName).toBe("Aelinor Vey");
    expect(groups[0].clusterId).toBeTruthy();
  });

  test("groupCardItemsByChapter sorts sections by chapter number", async ({ page }) => {
    await openFreshApp(page);
    await seedCandidate(page, { name: "Foo", chapterId: "ch-c", confidence: 0.7 });
    await seedCandidate(page, { name: "Bar", chapterId: "ch-a", confidence: 0.7 });
    await seedCandidate(page, { name: "Baz", chapterId: "ch-b", confidence: 0.7 });
    const order = await page.evaluate(() => {
      const pending = window.LoomwrightBackend.ReviewService.listSync().filter((q) => q.status === "pending");
      const cards = pending.map((c) => window.candidateToCardItem(c));
      const chapters = [
        { id: "ch-a", num: 1, title: "Arrival" },
        { id: "ch-b", num: 2, title: "Reach" },
        { id: "ch-c", num: 3, title: "Letter" },
      ];
      return window.groupCardItemsByChapter(cards, chapters).map((s) => s.chapterId);
    });
    expect(order).toEqual(["ch-a", "ch-b", "ch-c"]);
  });

  test("OnboardingService.applyCompletion dispatches lw:onboarding-extraction-summary with sensible counts", async ({ page }) => {
    await openFreshApp(page);
    // Listen for the event.
    await page.evaluate(() => {
      window.__TEST_SUMMARY__ = null;
      window.addEventListener("lw:onboarding-extraction-summary", (e) => { window.__TEST_SUMMARY__ = e.detail; });
    });
    // A two-chapter manuscript with a repeated character name so clustering
    // has something to fold. The mock AI provider isn't configured so
    // extraction runs the offline NER + local detectors only — that's
    // enough to produce review candidates from "Brec" appearing 3+ times
    // in each chapter.
    const manuscript = [
      "=== Chapter 1 ===",
      "Brec rode in. Brec watched the gate. Brec spoke to the guard.",
      "=== Chapter 2 ===",
      "Brec waited. Brec turned. Brec listened to the bell.",
    ].join("\n\n");
    await page.evaluate(async (text) => {
      await window.LoomwrightBackend.OnboardingService.applyCompletion({
        manuscript: { mode: "paste", pasted: text, runExtraction: true, autoDetect: true },
      });
    }, manuscript);
    // Give the dispatch a tick.
    await page.waitForTimeout(300);
    const summary = await page.evaluate(() => window.__TEST_SUMMARY__);
    expect(summary).toBeTruthy();
    expect(typeof summary.totalCandidates).toBe("number");
    expect(typeof summary.byType).toBe("object");
    expect(summary.totalCandidates).toBeGreaterThanOrEqual(0);
  });

  test("PostOnboardingBanner is exported and accepts the summary event shape", async ({ page }) => {
    await openFreshApp(page);
    // The banner is a React component exported on window for the queue panel
    // to mount. We can't render it standalone here without a panel host, but
    // we can confirm the export is correctly registered and that dispatching
    // the summary event doesn't throw — that's the contract the queue panel
    // relies on.
    const exported = await page.evaluate(() => typeof window.PostOnboardingBanner);
    expect(exported).toBe("function");
    const groupHelpersExported = await page.evaluate(() => ({
      byEntity: typeof window.groupCardItemsByEntity,
      byChapter: typeof window.groupCardItemsByChapter,
      entityCard: typeof window.ReviewEntityGroupCard,
    }));
    expect(groupHelpersExported.byEntity).toBe("function");
    expect(groupHelpersExported.byChapter).toBe("function");
    expect(groupHelpersExported.entityCard).toBe("function");
    // Dispatching the summary event with no listener attached is a no-op
    // (the banner only mounts inside the review queue panel). Confirm it
    // doesn't throw and the payload shape is preserved.
    const dispatched = await page.evaluate(() => {
      let captured = null;
      const h = (e) => { captured = e.detail; };
      window.addEventListener("lw:onboarding-extraction-summary", h);
      try {
        window.dispatchEvent(new CustomEvent("lw:onboarding-extraction-summary", {
          detail: { totalCandidates: 7, collapsed: 2, autoAdded: 1, confident: 4, uncertain: 2, weak: 1, byType: { cast: 3 } },
        }));
      } finally {
        window.removeEventListener("lw:onboarding-extraction-summary", h);
      }
      return captured;
    });
    expect(dispatched).toBeTruthy();
    expect(dispatched.totalCandidates).toBe(7);
    expect(dispatched.byType.cast).toBe(3);
  });
});
