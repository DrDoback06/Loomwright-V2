// Workflow N (Full Project Import / Export Pass):
//   - ProjectArchiveService end-to-end inside the browser shell.
//   - Build a real export, verify schema + privacy, validate +
//     summarise the payload, run merge and replace imports, and
//     round-trip an entity library.
//
// Scope: nothing UI-shaped — these tests drive the service directly
// via window.LoomwrightBackend.ProjectArchiveService so they remain
// stable while we evolve the Settings panel controls.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState, saveEntity } = require("./helpers");

test.describe("N. Project import/export — backup, merge, replace, library, redaction", () => {

  test("buildExport produces a v1 payload with redacted secrets", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Hess Vaela" });
    await saveEntity(page, "locations", { name: "Ash Hollow" });
    await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      await B.StorageService.set(B.keys.settings, {
        brandName: "Loomwright",
        aiProviderSettings: { provider: "anthropic", apiKey: "sk-ant-leak", model: "claude-opus-4-7" },
      });
      await B.StorageService.set(B.keys.apiKeys, { ciphertext: "must-never-export", iv: "x" });
    });

    const result = await page.evaluate(async () => {
      const payload = await window.LoomwrightBackend.ProjectArchiveService.buildExport();
      const text = JSON.stringify(payload);
      return {
        schemaVersion: payload.schemaVersion,
        apiKeysIncluded: payload.metadata.apiKeysIncluded,
        leaksApiKey: text.indexOf("sk-ant-leak") !== -1,
        leaksEncryptedBlob: text.indexOf("must-never-export") !== -1,
        castCount: (payload.entities.cast || []).length,
      };
    });

    expect(result.schemaVersion).toBe("loomwright-project-v1");
    expect(result.apiKeysIncluded).toBe(false);
    expect(result.leaksApiKey).toBe(false);
    expect(result.leaksEncryptedBlob).toBe(false);
    expect(result.castCount).toBe(1);
  });

  test("merge import preserves existing data and adds new records", async ({ page }) => {
    await openFreshApp(page);
    const hess = await saveEntity(page, "cast", { name: "Hess Vaela" });

    const { added, preservedName } = await page.evaluate(async ({ hessId }) => {
      const B = window.LoomwrightBackend;
      const exp = await B.ProjectArchiveService.buildExport();
      // Add a fresh cast entry to the payload and rename the existing Hess.
      exp.entities.cast.push({
        id: "cast-import-edrun",
        type: "cast",
        name: "Edrun Pell",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      exp.entities.cast[0] = { ...exp.entities.cast[0], name: "Hess CHANGED" };
      await B.ProjectArchiveService.applyImport(exp, { mode: "merge" });
      const list = B.EntityService.listSync("cast");
      return {
        added: list.some((c) => c.id === "cast-import-edrun"),
        preservedName: list.find((c) => c.id === hessId)?.name,
      };
    }, { hessId: hess.id });

    expect(added).toBe(true);
    expect(preservedName).toBe("Hess Vaela");
  });

  test("replace import wipes-and-loads after backup hook is invoked", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Will-be-erased" });

    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      // Synthesise an external payload (different from current store).
      const payload = {
        schemaVersion: "loomwright-project-v1",
        exportedAt: new Date().toISOString(),
        project: { id: "default", name: "External", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        entities: {
          cast: [{ id: "cast-replaced", type: "cast", name: "Imported Hess", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        },
        chapters: { chapters: [], manuscripts: {}, activeChapterId: null, authors: [] },
        metadata: { apiKeysIncluded: false, includesSampleData: false, includesTrash: false, includesReviewQueue: false, countsByType: { cast: 1 } },
      };
      let backupRan = false;
      // Caller is expected to back up before replacing; we exercise both calls.
      try { await B.ProjectArchiveService.createBackupBeforeReplace(); backupRan = true; } catch (_) {}
      await B.ProjectArchiveService.applyImport(payload, { mode: "replace" });
      const list = B.EntityService.listSync("cast");
      return {
        backupRan,
        replacedCount: list.length,
        hasImportedHess: list.some((c) => c.id === "cast-replaced"),
        retainsErased: list.some((c) => c.name === "Will-be-erased"),
      };
    });

    expect(result.backupRan).toBe(true);
    expect(result.replacedCount).toBe(1);
    expect(result.hasImportedHess).toBe(true);
    expect(result.retainsErased).toBe(false);

    // Confirm the replace survives a reload (persisted, not just in-memory).
    await openAppPreserveState(page);
    const afterReload = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("cast").map((c) => c.id),
    );
    expect(afterReload).toContain("cast-replaced");
  });

  test("entity library export/import: selected types only", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Library Hess" });
    await saveEntity(page, "cast", { name: "Library Sara" });
    await saveEntity(page, "locations", { name: "Should not export" });

    const result = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const lib = await B.ProjectArchiveService.buildEntityLibrary({
        types: ["cast"],
        includeReferences: false,
        includeOccurrences: false,
      });
      // Reset and apply.
      await B.StorageService.clear();
      await B.ProjectArchiveService.applyEntityLibrary(lib);
      return {
        schemaVersion: lib.schemaVersion,
        libCastCount: (lib.entities.cast || []).length,
        libIncludedLocations: !!lib.entities.locations,
        afterImportCast: B.EntityService.listSync("cast").length,
        afterImportLocations: B.EntityService.listSync("locations").length,
      };
    });

    expect(result.schemaVersion).toBe("loomwright-library-v1");
    expect(result.libCastCount).toBe(2);
    expect(result.libIncludedLocations).toBe(false);
    expect(result.afterImportCast).toBe(2);
    expect(result.afterImportLocations).toBe(0);
  });

  test("summarizeExportPayload reports counts and privacy posture", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Summary Hess" });
    await saveEntity(page, "items", { name: "Summary Blade" });

    const summary = await page.evaluate(async () => {
      const B = window.LoomwrightBackend;
      const exp = await B.ProjectArchiveService.buildExport();
      return B.ProjectArchiveService.summarizeExportPayload(exp);
    });

    expect(summary.valid).toBe(true);
    expect(summary.schemaVersion).toBe("loomwright-project-v1");
    expect(summary.apiKeysIncluded).toBe(false);
    expect(summary.counts.entities).toBeGreaterThanOrEqual(2);
    expect(summary.includesTrash).toBe(false);
  });
});
