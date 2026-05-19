// Workflow O (Speed Reader Completion Pass):
//   - SpeedReaderService persists sessions across reload.
//   - Pasted text + current chapter are real source modes.
//   - WPM / progress / bookmarks / settings round-trip.
//   - Delete + reset progress behave correctly.
//
// Service-shaped — drives backend so it stays stable while the workspace UI iterates.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

test.describe("O. Speed Reader — sessions, sources, persistence", () => {

  test("paste text → create session → progress + bookmark persist across reload", async ({ page }) => {
    await openFreshApp(page);

    const sessionId = await page.evaluate(async () => {
      const SRS = window.LoomwrightBackend.SpeedReaderService;
      const s = await SRS.createSession({
        sourceType: "paste",
        rawText: "Hello brave new world. This is a quick reading test.",
        name: "E2E paste",
      });
      await SRS.setProgress(s.id, 4);
      await SRS.addBookmark(s.id, { wordIndex: 4, label: "halfway" });
      await SRS.setSettings(s.id, { wpm: 540 });
      return s.id;
    });

    await openAppPreserveState(page);

    const restored = await page.evaluate((id) => {
      const SRS = window.LoomwrightBackend.SpeedReaderService;
      const s = SRS.getSessionSync(id);
      return {
        currentWordIndex: s?.currentWordIndex,
        wpm: s?.wpm,
        bookmarks: (s?.bookmarks || []).map((b) => ({ wordIndex: b.wordIndex, label: b.label })),
        active: SRS.loadSync().activeId,
      };
    }, sessionId);

    expect(restored.currentWordIndex).toBe(4);
    expect(restored.wpm).toBe(540);
    expect(restored.bookmarks).toEqual([{ wordIndex: 4, label: "halfway" }]);
    expect(restored.active).toBe(sessionId);
  });

  test("read current Writer's Room chapter pulls bodyText into session", async ({ page }) => {
    await openFreshApp(page);

    const session = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.ManuscriptChapterService.createFromComposition({
        title: "E2E Chapter Title",
        bodyText: "The wind off the salt flats turned each flake into a small cut.",
        bodyHtml: "<p>The wind off the salt flats turned each flake into a small cut.</p>",
      });
      const s = await B.SpeedReaderService.createSession({ sourceType: "chapter" });
      return { title: s.sourceTitle, text: s.rawText, totalWords: s.totalWords };
    });

    expect(session.title).toBe("E2E Chapter Title");
    expect(session.text).toContain("salt flats");
    expect(session.totalWords).toBeGreaterThan(8);
  });

  test("WPM change persists across reload (per-session)", async ({ page }) => {
    await openFreshApp(page);

    const sessionId = await page.evaluate(async () => {
      const SRS = window.LoomwrightBackend.SpeedReaderService;
      const s = await SRS.createSession({ sourceType: "paste", rawText: "One two three four five.", name: "wpm-test" });
      await SRS.setSettings(s.id, { wpm: 720, punctuationPause: false });
      return s.id;
    });

    await openAppPreserveState(page);

    const after = await page.evaluate((id) => {
      const s = window.LoomwrightBackend.SpeedReaderService.getSessionSync(id);
      return { wpm: s?.wpm, punctuationPause: s?.punctuationPause };
    }, sessionId);

    expect(after.wpm).toBe(720);
    expect(after.punctuationPause).toBe(false);
  });

  test("reset progress preserves bookmarks but rewinds idx to 0", async ({ page }) => {
    await openFreshApp(page);

    const result = await page.evaluate(async () => {
      const SRS = window.LoomwrightBackend.SpeedReaderService;
      const s = await SRS.createSession({ sourceType: "paste", rawText: "a b c d e f g h i j", name: "reset-test" });
      await SRS.setProgress(s.id, 6);
      await SRS.addBookmark(s.id, { wordIndex: 3, label: "early" });
      await SRS.resetProgress(s.id);
      const after = SRS.getSessionSync(s.id);
      return {
        currentWordIndex: after.currentWordIndex,
        bookmarkCount: (after.bookmarks || []).length,
        bookmarkLabel: after.bookmarks?.[0]?.label,
      };
    });

    expect(result.currentWordIndex).toBe(0);
    expect(result.bookmarkCount).toBe(1);
    expect(result.bookmarkLabel).toBe("early");
  });

  test("delete session removes it from listSessionsSync and clears active if it was active", async ({ page }) => {
    await openFreshApp(page);

    const result = await page.evaluate(async () => {
      const SRS = window.LoomwrightBackend.SpeedReaderService;
      const a = await SRS.createSession({ sourceType: "paste", rawText: "alpha beta gamma.", name: "A" });
      const b = await SRS.createSession({ sourceType: "paste", rawText: "one two three.", name: "B" });
      // b is now active.
      await SRS.deleteSession(b.id);
      const list = SRS.listSessionsSync().map((s) => s.id);
      return {
        list,
        activeId: SRS.loadSync().activeId,
        deletedPresent: list.includes(b.id),
        keptPresent: list.includes(a.id),
      };
    });

    expect(result.deletedPresent).toBe(false);
    expect(result.keptPresent).toBe(true);
    expect(result.activeId).toBeNull();
  });
});
