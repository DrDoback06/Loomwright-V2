// Workflow L (Field Parity):
//   - For each priority-8 entity type, save a rich entity, reload the
//     page, and verify every field round-trips.
//   - Verify unknown/deeper fields survive save+reload (extra.future
//     preservation).
//   - Verify JSON round-trip: take a saved entity's serialised form
//     and re-save it through EntityService.save → second entity has
//     the same fields.

const { test, expect } = require("@playwright/test");
const { openFreshApp, openAppPreserveState } = require("./helpers");

const RICH_SAMPLES = {
  cast: { name: "Saren of Hess", aliases: ["Sar"], role: "Co-protagonist",
    voiceProfile: "terse", goals: ["find the Auger"], aiInterview: "Why courier?",
    writingInstructions: "Keep her terse.", dormant: false },
  items: { name: "Auger of Hess", aliases: ["Auger"], itemType: "tool",
    rarity: "Heirloom", currentOwner: "aelinor", slot: "off-hand",
    tradeTransferHistory: "[]", destroyedLocation: "", dormant: false },
  locations: { name: "Vraska Pass", aliases: ["The Pass"], kind: "pass",
    danger: "risky", sourceMentions: "Ch. 1: They crossed Vraska Pass.",
    childLocationIds: [], dormant: false },
  quests: { title: "Find the Auger", questType: "Main quest", status: "Active",
    owner: "aelinor", steps: [{ id: "s1", title: "Leave Hess", status: "complete" }],
    branches: [], dormant: false },
  events: { title: "Auger Wake", eventType: "Death", chapter: "Ch. 4",
    cause: "Long debt.", longTermConsequence: "Auger lost.",
    relationshipChanges: [], characterStateChanges: [], dormant: false },
  stats: { name: "Resolve", valueType: "number", defaultValue: "5",
    min: 0, max: 10, appliesTo: ["Cast"],
    extractionRules: [{ phrase: "resolve hardened", effect: "increase" }],
    assignedEntities: [], changeHistory: "[]", sourceMentions: "Ch. 1.",
    dormant: false },
  bestiary: { name: "Hess Wolfhound", speciesType: "beast", category: "Beast",
    threatLevel: "moderate", habitat: "moors", abilities: ["track"],
    weaknesses: ["fire"], relatedLocations: [], dormant: false },
  references: { title: "Style sample 01", kind: "style sample",
    useFor: "voice", includeInAI: true, isStyleSample: true,
    isCanonSource: false, isResearchNote: false },
};

test.describe("L. Field parity — priority-8 round-trip + unknown-field preservation", () => {
  for (const [type, sample] of Object.entries(RICH_SAMPLES)) {
    test(`${type}: rich entity round-trips through save + reload`, async ({ page }) => {
      await openFreshApp(page);
      const saved = await page.evaluate(async ({ t, s }) => {
        return await window.LoomwrightBackend.EntityService.save(t, s, { status: "active" });
      }, { t: type, s: sample });
      expect(saved?.id).toBeTruthy();

      await openAppPreserveState(page);
      const reloaded = await page.evaluate(({ t, id }) => {
        return window.LoomwrightBackend.EntityService.getSync(id, t);
      }, { t: type, id: saved.id });
      expect(reloaded).toBeTruthy();

      // Every rich-sample key must be present somewhere (top-level or
      // under .data) on the reloaded entity.
      const missing = [];
      for (const k of Object.keys(sample)) {
        const top = reloaded[k];
        const inData = reloaded.data?.[k];
        if (top === undefined && inData === undefined) missing.push(k);
      }
      expect(missing, `${type} missing rich fields after reload: ${missing.join(",")}`).toEqual([]);
    });
  }

  test("unknown/deeper fields survive save+reload", async ({ page }) => {
    await openFreshApp(page);
    const saved = await page.evaluate(async () => {
      return await window.LoomwrightBackend.EntityService.save("cast", {
        name: "Future-friend",
        extra: { future: "this-must-survive", schemaVersion: "v3" },
      }, { status: "active" });
    });
    await openAppPreserveState(page);
    const reloaded = await page.evaluate(({ id }) => {
      return window.LoomwrightBackend.EntityService.getSync(id, "cast");
    }, { id: saved.id });
    const extra = reloaded?.extra || reloaded?.data?.extra;
    expect(extra?.future).toBe("this-must-survive");
    expect(extra?.schemaVersion).toBe("v3");
  });

  test("entity JSON round-trip: re-saving the loaded entity preserves fields", async ({ page }) => {
    await openFreshApp(page);
    const sample = RICH_SAMPLES.items;
    const first = await page.evaluate(async (s) => {
      return await window.LoomwrightBackend.EntityService.save("items", s, { status: "active" });
    }, sample);
    // "Export" — serialise the entity as JSON.
    const exported = await page.evaluate(({ id }) => {
      const e = window.LoomwrightBackend.EntityService.getSync(id, "items");
      return JSON.stringify(e);
    }, { id: first.id });
    // "Import" — parse and re-save as a new entity.
    const reimported = await page.evaluate(async (json) => {
      const parsed = JSON.parse(json);
      delete parsed.id; // force a fresh ID
      return await window.LoomwrightBackend.EntityService.save("items", parsed, { status: "active" });
    }, exported);
    expect(reimported.id).toBeTruthy();
    expect(reimported.id).not.toBe(first.id);
    const back = await page.evaluate(({ id }) => window.LoomwrightBackend.EntityService.getSync(id, "items"), { id: reimported.id });
    for (const k of Object.keys(sample)) {
      const present = back[k] !== undefined || back.data?.[k] !== undefined;
      expect(present, `re-imported items lost field "${k}"`).toBe(true);
    }
  });
});
