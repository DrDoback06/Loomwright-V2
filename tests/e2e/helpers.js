// Shared Playwright helpers for Loomwright e2e tests.

const SHELL_PATH = "/Loomwright%20Shell.html";

async function openFreshApp(page) {
  // Reset the persistent IndexedDB origin before each fresh-project test.
  await page.goto(SHELL_PATH);
  await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 15000 });
  await page.evaluate(async () => {
    try { await window.LoomwrightBackend.StorageService.clear(); } catch (_) {}
    try { window.localStorage.clear(); } catch (_) {}
    try { window.__LW_SAMPLE_LOADED__ = false; } catch (_) {}
  });
  await page.goto(SHELL_PATH);
  await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 15000 });
  // Wait for the backend to finish hydrating.
  await page.waitForFunction(() => window.__LW_BACKEND_DELEGATES__ === true, null, { timeout: 5000 }).catch(() => {});
}

async function openAppPreserveState(page) {
  await page.goto(SHELL_PATH);
  await page.waitForFunction(() => !!window.LoomwrightBackend, null, { timeout: 15000 });
}

async function getEntityCount(page, type) {
  return await page.evaluate((t) => {
    const ES = window.LoomwrightBackend?.EntityService;
    if (!ES) return 0;
    return ES.listSync(t).length;
  }, type);
}

async function saveEntity(page, type, fields, opts = {}) {
  return await page.evaluate(async ({ t, f, o }) => {
    const ES = window.LoomwrightBackend?.EntityService;
    if (!ES) throw new Error("EntityService unavailable");
    return ES.save(t, f, o);
  }, { t: type, f: fields, o: opts });
}

async function listOccurrences(page, chapterId) {
  return await page.evaluate((cid) => {
    const OS = window.LoomwrightBackend?.OccurrenceService;
    if (!OS) return [];
    return cid ? OS.listByChapterSync(cid) : OS.listAllSync();
  }, chapterId);
}

module.exports = {
  SHELL_PATH,
  openFreshApp,
  openAppPreserveState,
  getEntityCount,
  saveEntity,
  listOccurrences,
};
