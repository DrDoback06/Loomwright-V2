// Workflow P (Search / Indexing Pass):
//   - SearchService indexes the live local store.
//   - Entity / chapter / reference / review / settings / project-intel
//     / onboarding / trash results work.
//   - API secrets never appear in results.
//   - Result objects carry the typed pointers the shell needs to focus
//     the right surface.
//
// Service-shaped — drives backend so it stays stable while the
// CommandPalette UI iterates.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

test.describe("P. Search / Indexing — global index across local stores", () => {

  test("create Cast with alias → search alias → result carries entity pointer", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Hess Vaela", data: { aliases: ["Vaela"], summary: "Bearer of the Auger." } });
    const r = await page.evaluate(() => {
      const S = window.LoomwrightBackend.SearchService;
      S.rebuildIndex();
      return S.search("Vaela");
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].type).toBe("entity");
    expect(r[0].entityType).toBe("cast");
    expect(r[0].entityId).toBe(cast.id);
    expect(r[0].matchReason).toBe("alias exact");
  });

  test("create Location → search exact name → top result is the location", async ({ page }) => {
    await openFreshApp(page);
    const loc = await saveEntity(page, "locations", { name: "Pale Reach" });
    const r = await page.evaluate(() => {
      const S = window.LoomwrightBackend.SearchService;
      S.rebuildIndex();
      return S.search("Pale Reach");
    });
    expect(r[0].entityId).toBe(loc.id);
    expect(r[0].matchReason).toBe("title exact");
  });

  test("write chapter bodyText → search phrase → chapter result with chapterId", async ({ page }) => {
    await openFreshApp(page);
    const chapterId = await page.evaluate(async () => {
      const c = await window.LoomwrightBackend.ManuscriptChapterService.createFromComposition({
        title: "Ch. 7 — Ash & Auger",
        bodyText: "The wind off the salt flats turned each flake into a small, deliberate cut.",
      });
      return c.id;
    });
    const r = await page.evaluate(() => {
      const S = window.LoomwrightBackend.SearchService;
      S.rebuildIndex();
      return S.search("salt flats");
    });
    const hit = r.find((x) => x.type === "chapter");
    expect(hit).toBeTruthy();
    expect(hit.chapterId).toBe(chapterId);
  });

  test("add Reference → search tag → reference result with referenceId", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.StorageService.set(B.keys.references, [
        { id: "ref-1", title: "Style guide", content: "POV: third limited.", tags: ["pov", "style"], kind: "style" },
      ]);
    });
    const r = await page.evaluate(() => {
      const S = window.LoomwrightBackend.SearchService;
      S.rebuildIndex();
      return S.search("pov");
    });
    const hit = r.find((x) => x.type === "reference");
    expect(hit).toBeTruthy();
    expect(hit.referenceId).toBe("ref-1");
  });

  test("search 'provider' → safe settings result with settingsSectionId", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.StorageService.set(B.keys.settings, {
        aiProviders: { provider: "anthropic", apiKey: "sk-DO-NOT-INDEX", model: "claude-opus-4-7" },
      });
    });
    const r = await page.evaluate(() => {
      const S = window.LoomwrightBackend.SearchService;
      S.rebuildIndex();
      return S.search("provider");
    });
    const hit = r.find((x) => x.type === "setting");
    expect(hit).toBeTruthy();
    expect(hit.settingsSectionId).toBe("aiProviders");
  });

  test("delete entity → not in results by default; appears as trash when includeTrash:true", async ({ page }) => {
    await openFreshApp(page);
    const c = await saveEntity(page, "cast", { name: "Will-be-deleted" });
    const result = await page.evaluate((id) => {
      const B = window.LoomwrightBackend;
      const S = B.SearchService;
      // Send to trash via EntityService.delete (soft delete).
      return B.EntityService.delete("cast", id).then(() => {
        S.rebuildIndex({ includeTrash: false });
        const without = S.search("Will-be-deleted", { includeTrash: false });
        S.rebuildIndex({ includeTrash: true });
        const withTrash = S.search("Will-be-deleted", { includeTrash: true });
        return { withoutCount: without.length, withTrashHasTrash: withTrash.some((x) => x.type === "trash") };
      });
    }, c.id);
    expect(result.withoutCount).toBe(0);
    expect(result.withTrashHasTrash).toBe(true);
  });

  test("API key set in settings is NEVER searchable (privacy guarantee)", async ({ page }) => {
    await openFreshApp(page);
    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.StorageService.set(B.keys.settings, {
        aiProviders: { provider: "anthropic", apiKey: "sk-ant-DO-NOT-LEAK", model: "claude-opus-4-7" },
      });
      await B.StorageService.set(B.keys.apiKeys, { ciphertext: "do-not-index-blob", iv: "x" });
      const S = B.SearchService;
      S.rebuildIndex();
      const search = S.search("sk-ant-DO-NOT-LEAK");
      const indexJson = JSON.stringify(S.loadSync());
      return {
        searchCount: search.length,
        indexContainsKey: indexJson.includes("sk-ant-DO-NOT-LEAK"),
        indexContainsBlob: indexJson.includes("do-not-index-blob"),
      };
    });
    expect(result.searchCount).toBe(0);
    expect(result.indexContainsKey).toBe(false);
    expect(result.indexContainsBlob).toBe(false);
  });
});
