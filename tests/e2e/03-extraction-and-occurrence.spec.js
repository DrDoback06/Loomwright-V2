// Workflow D: Writer's Room save / extract / occurrence rendering.
//
// We do not rely on a configured AI provider — the local-pass scanner
// finds known entity names in chapter text and creates occurrences
// without AI. After reload, those occurrences should render as
// highlights via the new ManuscriptCanvas overlay path.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity, listOccurrences } = require("./helpers");

test.describe("D. Extraction creates occurrences and they render after reload", () => {
  test("local-pass scanner records EntityOccurrence for known names", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Aelinor" }, { status: "active" });
    const chapterId = "chapter-test";
    // Run extraction with chapter text that mentions the entity.
    const result = await page.evaluate(async ({ cid }) => {
      return await window.LoomwrightBackend.ExtractionService.runExtraction({
        chapterId: cid,
        text: "Aelinor crossed the bridge and looked back at the harbour.",
        deep: false,
      });
    }, { cid: chapterId });
    expect(result.occurrenceCount).toBeGreaterThanOrEqual(1);
    const occs = await listOccurrences(page, chapterId);
    const match = occs.find((o) => o.entityId === cast.id);
    expect(match).toBeTruthy();
    expect(match.exactText).toBe("Aelinor");
  });

  test("OccurrenceService survives reload", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Aelinor" }, { status: "active" });
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ExtractionService.runExtraction({
        chapterId: "chapter-test",
        text: "Aelinor crossed the bridge.",
        deep: false,
      });
    });
    await openAppPreserveState(page);
    const occs = await listOccurrences(page, "chapter-test");
    expect(occs.some((o) => o.entityId === cast.id)).toBe(true);
  });

  test("isOccurrenceStale flags edited text", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Aelinor" }, { status: "active" });
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ExtractionService.runExtraction({
        chapterId: "chapter-test",
        text: "Aelinor crossed the bridge.",
        deep: false,
      });
    });
    const stale = await page.evaluate(() => {
      const occs = window.LoomwrightBackend.OccurrenceService.listAllSync();
      const target = occs.find((o) => o.exactText === "Aelinor");
      // Pretend the paragraph text changed — same offsets now reference
      // a different exactText. isOccurrenceStale should report true.
      const editedBodyText = "Different different different different.";
      return window.LoomwrightBackend.isOccurrenceStale(target, editedBodyText);
    });
    expect(stale).toBe(true);
  });
});
