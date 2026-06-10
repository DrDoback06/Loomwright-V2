// Workflow U36: System workspaces go fully live (Day-2 surface gaps).
//
// S1 — Research Library inspector: real linked-entity chips + working
//      "+ Link entity" picker + persisted AI/style/canon toggles.
// S2 — Trash Manager workspace: live TrashService rows, real preview,
//      Restore + Delete forever; docked panel renders real entity types.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

const openWorkspace = (page, workspaceId, panelKind, sourcePanel) =>
  page.evaluate(({ workspaceId, panelKind, sourcePanel }) => {
    window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
      detail: { workspaceId, panelKind, sourcePanel },
    }));
  }, { workspaceId, panelKind, sourcePanel });

test.describe("U36. System workspaces live", () => {
  test("Research Library: link + unlink a real entity from the inspector", async ({ page }) => {
    await openFreshApp(page);
    const hero = await saveEntity(page, "cast", { name: "Anwen Hale" });
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReferencesService.save({
        id: "ref-u36", title: "Coastal forts dossier", kind: "research",
      });
    });
    await openWorkspace(page, "research-library", "references", "p-references");

    // The live reference renders as a tile; select it.
    const tile = page.locator(".fws-tile", { hasText: "Coastal forts dossier" });
    await expect(tile).toBeVisible();
    await tile.click();

    // Fresh reference → designed empty state, never demo chips.
    const linked = page.locator("[data-testid='rlw-linked-entities']");
    await expect(linked).toContainText("None yet");
    await expect(linked).not.toContainText("Aelinor Vey");

    // Open the picker, search, link.
    await page.locator("[data-testid='rlw-link-entity']").click();
    const picker = page.locator("[data-testid='rlw-link-picker']");
    await expect(picker).toBeVisible();
    await picker.locator("input").fill("Anwen");
    await page.locator(`[data-testid='rlw-pick-${hero.id}']`).click();

    // Chip appears, picker row flips to linked, and the service persisted it.
    await expect(linked).toContainText("Anwen Hale");
    await expect(page.locator(`[data-testid='rlw-pick-${hero.id}']`)).toContainText("linked");
    let storedIds = await page.evaluate(() =>
      (window.LoomwrightBackend.ReferencesService.listSync().find((r) => r.id === "ref-u36") || {}).linkedEntities);
    expect(storedIds).toContain(hero.id);

    // Tap the same row again → unlink.
    await page.locator(`[data-testid='rlw-pick-${hero.id}']`).click();
    await expect(linked).toContainText("None yet");
    storedIds = await page.evaluate(() =>
      (window.LoomwrightBackend.ReferencesService.listSync().find((r) => r.id === "ref-u36") || {}).linkedEntities);
    expect(storedIds).not.toContain(hero.id);
  });

  test("Research Library: inspector toggles persist to the reference record", async ({ page }) => {
    await openFreshApp(page);
    await page.evaluate(async () => {
      await window.LoomwrightBackend.ReferencesService.save({
        id: "ref-u36b", title: "Etiquette notes", kind: "research",
      });
    });
    await openWorkspace(page, "research-library", "references", "p-references");
    await page.locator(".fws-tile", { hasText: "Etiquette notes" }).click();

    const canon = page.locator("input[data-callback='onToggleReferenceCanonSource']");
    await expect(canon).not.toBeChecked();
    await canon.click();
    await expect(canon).toBeChecked();
    const stored = await page.evaluate(() =>
      window.LoomwrightBackend.ReferencesService.listSync().find((r) => r.id === "ref-u36b"));
    expect(stored.canonSource).toBe(true);

    // The library tile now carries the canon badge.
    await expect(page.locator(".fws-tile", { hasText: "Etiquette notes" })).toContainText("canon");
  });

  test("Trash Manager: live rows, real preview, restore brings the entity back", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", {
      name: "Doomed Walk-on",
      summary: "A ferryman fated for one scene.",
      data: { role: "minor" },
    });
    await page.evaluate(async (id) => {
      await window.LoomwrightBackend.EntityService.delete("cast", id);
    }, cast.id);
    await openWorkspace(page, "trash-manager", "trash", "p-trash");

    // No demo rows — exactly the one real deletion.
    await expect(page.locator(".fws-trash-row__name", { hasText: "Doomed Walk-on" })).toBeVisible();
    await expect(page.locator(".fws-trash-row__name", { hasText: "The Glass Court" })).toHaveCount(0);

    // Preview shows the record's own words, and the raw record toggles open.
    await page.locator(`[data-testid='tmw-row-${cast.id}']`).click();
    await expect(page.locator("[data-testid='tmw-preview']")).toContainText("ferryman");
    await page.locator("[data-testid='tmw-full-record']").click();
    await expect(page.locator("[data-testid='tmw-record-json']")).toContainText('"role": "minor"');

    // Restore returns it to the live store and empties the workspace list.
    await page.locator("[data-testid='tmw-restore']").click();
    await expect(page.locator(".fws-empty", { hasText: "Trash is empty" })).toBeVisible();
    const live = await page.evaluate(() =>
      window.LoomwrightBackend.EntityService.listSync("cast").map((e) => ({ name: e.name, status: e.status })));
    expect(live).toContainEqual({ name: "Doomed Walk-on", status: "active" });
  });

  test("Trash Manager: delete forever purges after double-confirm", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Gone For Good" });
    await page.evaluate(async (id) => {
      await window.LoomwrightBackend.EntityService.delete("cast", id);
    }, cast.id);
    await openWorkspace(page, "trash-manager", "trash", "p-trash");
    await page.locator(`[data-testid='tmw-row-${cast.id}']`).click();
    await page.locator("button", { hasText: "Delete forever…" }).click();
    await page.locator("[data-testid='tmw-delete-forever']").click();
    await expect(page.locator(".fws-empty", { hasText: "Trash is empty" })).toBeVisible();
    const trash = await page.evaluate(() => window.LoomwrightBackend.TrashService.listSync());
    expect(trash).toHaveLength(0);
  });

  test("docked Trash panel renders real entity types and previews the record", async ({ page }) => {
    await openFreshApp(page);
    const cast = await saveEntity(page, "cast", { name: "Briefly Here", data: { role: "minor" } });
    await page.evaluate(async (id) => {
      await window.LoomwrightBackend.EntityService.delete("cast", id);
    }, cast.id);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "trash" } })));
    const row = page.locator("[data-ui='TrashItemCard']", { hasText: "Briefly Here" });
    await expect(row).toBeVisible(); // would crash before the TRASH_TYPES normalisation
    await expect(row).toContainText("Cast");
    await row.locator("button", { hasText: "Preview" }).click();
    await expect(page.locator("[data-ui='TrashPanelBody'] pre")).toContainText('"role": "minor"');
  });
});
