// Workflow T41: Extraction depth — the four new offline detectors plus
// the ownership ledger, end to end with zero AI tokens.
//
//   • dialogue attribution: known speakers collect the line; unknown
//     recurring speakers become new-cast candidates.
//   • role epithets: "the baker" near a known cast files an occupation;
//     a recurring unnamed epithet becomes a candidate.
//   • event chaining: causal connectors record cause → effect.
//   • faction allegiance: "swore to the banner of X" binds cast → faction.
//   • buildOwnershipLedgerSync flags possession conflicts, which surface
//     through the insight engine.
//
// DoD #6 path: prose → extraction → review queue DOM → accept → the
// entity is updated and visible in its tab and full editor.

const { test, expect } = require("@playwright/test");
const { openFreshApp, saveEntity } = require("./helpers");

async function runExtraction(page, chapterId, text) {
  return await page.evaluate(async ({ chapterId, text }) => {
    const B = window.LoomwrightBackend;
    await B.ManuscriptChapterService.save({
      chapters: [{ id: chapterId, num: 1, title: "One", state: "saved", bodyText: text }],
      activeChapterId: chapterId,
      manuscripts: { [chapterId]: { text } },
      trashedChapters: [],
    });
    const res = await B.ExtractionService.runExtraction({ chapterId, text, deep: false });
    return { added: res?.added?.length ?? res?.reviewItems?.length ?? null };
  }, { chapterId, text });
}

const pending = (page, type) => page.evaluate((t) => {
  return (window.LoomwrightBackend.ReviewService.listSync(t) || [])
    .filter((q) => q.status === "pending")
    .map((q) => ({ name: q.name, action: q.suggestedAction, changes: q.suggestedChanges || q.payload?.suggestedChanges || {}, matchType: q.matchType }));
}, type);

test.describe("T41. Extraction depth — offline detectors", () => {
  test("dialogue attribution: known speaker collects the line; unknown recurring speaker becomes a candidate", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Brec", data: { role: "supporting" } }, { status: "active" });
    const text = [
      `"The pass is closed," said Brec.`,
      `Maron said, "Then we go around."`,
      `"You always say that," Maron said, and spat.`,
    ].join(" ");
    await runExtraction(page, "ch-dlg", text);
    const cast = await pending(page, "cast");
    // Known speaker → update candidate carrying the spoken line.
    const brec = cast.find((c) => c.name === "Brec" && c.action === "update");
    expect(brec, "Brec voice-line candidate").toBeTruthy();
    expect(JSON.stringify(brec.changes)).toContain("The pass is closed");
    // Unknown speaker with 2 lines → create candidate.
    const maron = cast.find((c) => c.name === "Maron");
    expect(maron, "Maron discovery candidate").toBeTruthy();
  });

  test("role epithet near a known cast files an occupation", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Dav", data: {} }, { status: "active" });
    await runExtraction(page, "ch-epi", "Dav wiped his hands; the baker never let the ovens cool.");
    const cast = await pending(page, "cast");
    const dav = cast.find((c) => c.name === "Dav" && c.action === "update");
    expect(dav, "Dav occupation candidate").toBeTruthy();
    expect(dav.changes.occupation).toBe("baker");
  });

  test("event chaining records cause → effect on the later event", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "events", { name: "The Auger Wake", data: { eventType: "Disaster" } }, { status: "active" });
    await saveEntity(page, "events", { name: "The Vraska Break", data: { eventType: "Battle" } }, { status: "active" });
    await runExtraction(page, "ch-chain", "The Vraska Break came because of the Auger Wake, everyone knew it.");
    const events = await pending(page, "events");
    const eff = events.find((e) => e.name === "The Vraska Break" && e.action === "update");
    expect(eff, "effect event update").toBeTruthy();
    expect(String(eff.changes.cause || "")).toContain("The Auger Wake");
  });

  test("faction allegiance binds cast to a known faction", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Saren", data: {} }, { status: "active" });
    await saveEntity(page, "factions", { name: "The Grey Coats", data: {} }, { status: "active" });
    await runExtraction(page, "ch-oath", "At dusk Saren swore fealty to the Grey Coats and did not look back.");
    const cast = await pending(page, "cast");
    const saren = cast.find((c) => c.name === "Saren" && c.action === "update");
    expect(saren, "Saren allegiance candidate").toBeTruthy();
    expect(saren.changes.faction && saren.changes.faction.name).toBe("The Grey Coats");
  });

  test("accepting a detector candidate updates the entity, visible in tab AND full editor", async ({ page }) => {
    await openFreshApp(page);
    await saveEntity(page, "cast", { name: "Dav", data: {} }, { status: "active" });
    await runExtraction(page, "ch-acc", "Dav nodded at the forge; the smith was already working.");
    // Accept through the rendered review panel.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "review" } })));
    const review = page.locator(".pstk__panel[data-panel-id='p-review']");
    await expect(review).toBeVisible({ timeout: 5000 });
    await expect(review).toContainText("Dav", { timeout: 5000 });
    const acceptBtn = review.locator("[data-callback='onAcceptQueueItem']").first();
    await acceptBtn.click();
    // The entity record carries the occupation…
    await expect.poll(async () => await page.evaluate(() => {
      const dav = window.LoomwrightBackend.EntityService.listSync("cast").find((c) => c.name === "Dav");
      return dav?.data?.occupation || null;
    }), { timeout: 5000 }).toBe("smith");
    // …and the cast tab + full dossier render it.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast" } })));
    await page.locator(".cast-row:has-text('Dav')").click();
    await expect(page.locator("[data-ui='CastDetail']")).toBeVisible({ timeout: 5000 });
    const dav = await page.evaluate(() => window.LoomwrightBackend.EntityService.listSync("cast").find((c) => c.name === "Dav"));
    await page.evaluate(({ id }) => {
      window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
        detail: { workspaceId: "cast-dossier", panelKind: "cast", sourcePanel: "p-cast", entityId: id },
      }));
    }, { id: dav.id });
    const host = page.locator("[data-ui='FullWorkspaceHost'][data-workspace-id='cast-dossier']");
    await expect(host).toBeVisible({ timeout: 5000 });
    await expect(host.locator("[data-ui='FullRecordSection']")).toContainText("smith");
  });

  test("ownership ledger flags possession conflicts for the insight engine", async ({ page }) => {
    await openFreshApp(page);
    const a = await saveEntity(page, "cast", { name: "Aldis", data: {} }, { status: "active" });
    const b = await saveEntity(page, "cast", { name: "Berin", data: {} }, { status: "active" });
    await saveEntity(page, "items", {
      name: "The Salt Knife",
      data: {
        currentOwner: { id: b.id, name: "Berin", type: "cast" },
        ownership: [{ chapter: 2, owner: { id: a.id, name: "Aldis", type: "cast" }, what: "Taken at the ford" }],
      },
    }, { status: "active" });
    const ledger = await page.evaluate(() => window.LoomwrightBackend.buildOwnershipLedgerSync());
    const knife = ledger.find((r) => r.itemName === "The Salt Knife");
    expect(knife).toBeTruthy();
    expect(knife.conflict).toContain("Berin");
    expect(knife.conflict).toContain("Aldis");
    // The conflict reaches the insight engine as a contradiction card.
    const insights = await page.evaluate(() => {
      const B = window.LoomwrightBackend;
      B.InsightService.bump();
      return B.InsightService.computeInsights().insights;
    });
    expect(insights.some((i) => i.kind === "contradiction" && /Salt Knife/.test(i.title))).toBe(true);
  });
});
