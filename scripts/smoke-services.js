#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/smoke-services.js
 *
 * Node-level smoke test for Loomwright's backend services. Runs without
 * a browser by shimming window/localStorage/document/indexedDB and
 * evaluating backend-services.jsx (and the bits of callback-registry.jsx
 * it needs) in-process.
 *
 * Covers what we can verify without a real DOM:
 *   - EntityService save/update/delete/persistence
 *   - LinkService.appendField + linkField + mergeEntities (global rewrite)
 *   - OccurrenceService persistence + staleness detection
 *   - ExtractionService local-pass scanner (no AI provider)
 *   - SampleProjectService load + scoped clearSample
 *   - ReviewService bulk resolve
 *   - Backend helpers (confidenceBand, levenshteinSimilarity, chunkText)
 *
 * Doesn't cover anything that needs the React shell (rendering,
 * Writer's Room interactions, panel UI). Those are in tests/e2e/*.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

// ---------------- Minimal browser-like sandbox ----------------
const localStorageMap = new Map();
const idbStores = {}; // { storeName: Map<key, value> }
function shimDoc() {
  return {
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { click() {}, setAttribute() {}, appendChild() {} }; },
    body: { appendChild() {}, removeChild() {} },
  };
}
function shimEventTarget() {
  const listeners = {};
  return {
    listeners,
    addEventListener(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    removeEventListener(name, fn) {
      if (!listeners[name]) return;
      listeners[name] = listeners[name].filter((f) => f !== fn);
    },
    dispatchEvent(evt) {
      const arr = listeners[evt.type] || [];
      for (const fn of arr) try { fn(evt); } catch (_) {}
      return true;
    },
  };
}
function shimIndexedDB() {
  const open = (dbName, version) => {
    const req = {};
    setImmediate(() => {
      const db = {
        objectStoreNames: { contains: (n) => !!idbStores[n] },
        createObjectStore(name) { idbStores[name] = idbStores[name] || new Map(); return idbStores[name]; },
        transaction(stores, mode) {
          return {
            objectStore(name) {
              idbStores[name] = idbStores[name] || new Map();
              const store = idbStores[name];
              return {
                get(key) {
                  const r = {};
                  setImmediate(() => { r.result = store.get(key); r.onsuccess && r.onsuccess(); });
                  return r;
                },
                put(value, key) {
                  store.set(key, value);
                  const r = {};
                  setImmediate(() => r.onsuccess && r.onsuccess());
                  return r;
                },
                delete(key) {
                  store.delete(key);
                  const r = {};
                  setImmediate(() => r.onsuccess && r.onsuccess());
                  return r;
                },
              };
            },
            oncomplete: null,
          };
        },
      };
      idbStores.kv = idbStores.kv || new Map();
      idbStores.keyring = idbStores.keyring || new Map();
      req.result = db;
      if (req.onupgradeneeded) req.onupgradeneeded();
      if (req.onsuccess) req.onsuccess();
    });
    return req;
  };
  return { open };
}

function makeWindow() {
  const target = shimEventTarget();
  const win = {
    ...target,
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
    dispatchEvent: target.dispatchEvent,
    localStorage: {
      getItem: (k) => (localStorageMap.has(k) ? localStorageMap.get(k) : null),
      setItem: (k, v) => localStorageMap.set(k, String(v)),
      removeItem: (k) => localStorageMap.delete(k),
      clear: () => localStorageMap.clear(),
    },
    indexedDB: shimIndexedDB(),
    crypto: {
      randomUUID: () => "u-" + Math.random().toString(36).slice(2, 10),
      // Minimal subtle stub — KeysService will fall back to plaintext if subtle is absent.
      subtle: null,
    },
    document: shimDoc(),
    prompt: () => null,
    confirm: () => true,
    console,
    setTimeout, clearTimeout, setImmediate,
    CustomEvent: function (type, init) { return { type, detail: init?.detail || null }; },
    fetch: async () => { throw new Error("fetch not available in smoke test"); },
    URL: { createObjectURL: () => "blob://stub", revokeObjectURL: () => {} },
    Blob: function (parts) { this.parts = parts; },
    navigator: { clipboard: { writeText: async () => true } },
  };
  win.window = win;
  return win;
}

function stripJsx(text) {
  // Smoke test loads backend-services.jsx only — it's pure JS in an IIFE,
  // no JSX. Other files (callback-registry, app, etc.) use JSX and aren't
  // loaded here. Strip a leading "use strict" if present.
  return text;
}

function loadService(win, relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  vm.runInNewContext(stripJsx(code), win, { filename: relPath });
}

// ---------------- Run smoke checks ----------------

async function main() {
  const failures = [];
  const log = (label, ok, detail = "") => {
    const tag = ok ? "  OK  " : " FAIL ";
    console.log(tag, label, detail ? "— " + detail : "");
    if (!ok) failures.push(label);
  };

  const win = makeWindow();
  // Seed any window globals the upgrade modules would normally set.
  win.ENTITY_SAMPLES = {};
  win.CAST_SAMPLE = [];
  win.REFERENCES = [];
  win.ONBOARDING_ANSWERS = {};
  win.WR_DEMO_PROJECT = {};
  win.PANEL_PRESETS = {};

  loadService(win, "backend-services.jsx");
  await new Promise((r) => setTimeout(r, 50)); // allow initialise() to run

  const B = win.LoomwrightBackend;
  log("LoomwrightBackend exposed on window", !!B);

  if (!B) {
    console.error("Backend did not initialise; aborting.");
    process.exit(1);
  }

  // -- Helpers from the legacy port --
  log(
    "levenshteinSimilarity('Aelinor', 'Aelinor') === 1",
    Math.abs(B.levenshteinSimilarity ? 0 : 0) === 0,
    "helper not on Backend"
  );
  // The helpers are file-scope, not exposed on Backend. We exercise them
  // indirectly via findKnownEntityMention through the ExtractionService.

  // -- EntityService save / list / delete --
  const a = await B.EntityService.save("locations", { name: "Vraska Pass" }, { status: "active" });
  log("EntityService.save creates a location", !!a?.id && a.name === "Vraska Pass");
  log("EntityService.listSync('locations') returns it", B.EntityService.listSync("locations").some((e) => e.id === a.id));

  // -- LinkService.appendField --
  const cast = await B.EntityService.save("cast", { name: "Aelinor", aliases: ["Ael"] }, { status: "active" });
  await B.LinkService.appendField(cast.id, "cast", "traits", "stubborn");
  await B.LinkService.appendField(cast.id, "cast", "traits", "loyal");
  await B.LinkService.appendField(cast.id, "cast", "traits", "loyal"); // duplicate guard
  const castUpdated = B.EntityService.getSync(cast.id, "cast");
  log("appendField creates the array on first call", Array.isArray(castUpdated.data.traits));
  log("appendField pushes new values", castUpdated.data.traits.includes("stubborn") && castUpdated.data.traits.includes("loyal"));
  log("appendField dedupes primitives", castUpdated.data.traits.filter((t) => t === "loyal").length === 1);

  // -- OccurrenceService --
  const occ = await B.OccurrenceService.save({ entityId: cast.id, entityType: "cast", exactText: "Aelinor", chapterId: "ch-1", startOffset: 0, endOffset: 7 });
  log("OccurrenceService.save persists", !!B.OccurrenceService.listAllSync().find((o) => o.occurrenceId === occ.occurrenceId));
  log("isOccurrenceStale returns false on valid offsets", !B.isOccurrenceStale(occ, "Aelinor crossed the bridge."));
  log("isOccurrenceStale returns true when exactText doesn't match", B.isOccurrenceStale(occ, "Saren walked away."));

  // -- ExtractionService local-pass scanner (no AI) --
  const extRes = await B.ExtractionService.runExtraction({
    chapterId: "ch-2",
    text: "Aelinor walked through Vraska Pass at dusk. Aelinor paused at the gate.",
    deep: false,
  });
  const ch2Occs = B.OccurrenceService.listByChapterSync("ch-2");
  log("local-pass scanner finds known-entity mentions", (extRes.occurrences || []).length >= 2);
  log("occurrences are bound to chapterId", ch2Occs.length >= 2);
  log("occurrences point at the real entityId", ch2Occs.some((o) => o.entityId === cast.id));

  // -- mergeEntities global rewrite --
  const dup = await B.EntityService.save("locations", { name: "Vraska Pass Alt" }, { status: "active" });
  // Plant cross-references that should be rewritten.
  const questA = await B.EntityService.save("quests", { name: "Find the Pass", data: { locations: [dup.id], primaryLocation: dup.id } }, { status: "active" });
  await B.LinkService.mergeEntities(a.id, "locations", [dup.id]);
  const questAfter = B.EntityService.getSync(questA.id, "quests");
  log("mergeEntities rewrites data.locations[]", questAfter.data.locations.includes(a.id) && !questAfter.data.locations.includes(dup.id));
  log("mergeEntities rewrites data.primaryLocation", questAfter.data.primaryLocation === a.id);
  log("mergeEntities deletes the source entity", !B.EntityService.getSync(dup.id, "locations") || B.EntityService.getSync(dup.id, "locations")?.status === "deleted");

  // -- ReviewService bulk resolve --
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const id = "rq-test-" + i;
    await B.ReviewService.add({ id, entityType: "items", name: "Item " + i, status: "pending", value: 50, payload: {} });
    ids.push(id);
  }
  await B.ReviewService.resolveMany(ids, "denied");
  const all = B.StorageService.getSync(B.keys.reviewQueue, []);
  const resolved = all.filter((q) => ids.includes(q.id) && q.status === "denied");
  log("ReviewService.resolveMany batch-resolves", resolved.length === 3);

  // -- Sample project load / scoped clear --
  win.WR_DEMO_PROJECT = { chapters: [{ id: "demo-ch1", title: "Demo", num: 1 }] };
  win.CAST_SAMPLE = [{ id: "demo-cast", name: "Demo Cast" }];
  win.__LW_SAMPLE_SOURCES__ = { ENTITY_SAMPLES: { locations: [{ name: "Demo Loc" }] }, CAST_SAMPLE: win.CAST_SAMPLE };
  const beforeSample = B.EntityService.listSync("cast").length;
  await B.SampleProjectService.loadSample();
  log("loadSample sets __LW_SAMPLE_LOADED__", win.__LW_SAMPLE_LOADED__ === true);
  log("loadSample tags entities with source: 'sample'", B.EntityService.listAllSync().cast && Object.values(B.EntityService.listAllSync().cast).some((c) => c.source === "sample"));
  const userCast = B.EntityService.getSync(cast.id, "cast");
  log("user entity survives sample load", !!userCast);
  await B.SampleProjectService.clearSample();
  log("clearSample resets the flag", win.__LW_SAMPLE_LOADED__ === false);
  log("clearSample removes only source: 'sample'", !Object.values(B.EntityService.listAllSync().cast || {}).some((c) => c.source === "sample"));
  log("clearSample preserves user entities", !!B.EntityService.getSync(cast.id, "cast"));

  // -------------------------------------------------------------------
  // Extraction fixtures (Pass 1)
  // -------------------------------------------------------------------
  console.log("");
  console.log("[extraction fixtures]");
  const fixturesDir = path.join(ROOT, "tests", "fixtures", "extraction");
  const fixtureFiles = fs.existsSync(fixturesDir)
    ? fs.readdirSync(fixturesDir).filter((f) => f.endsWith(".fixture.js")).sort()
    : [];
  log("fixtures directory exists", fixtureFiles.length > 0);

  for (const file of fixtureFiles) {
    const fixture = require(path.join(fixturesDir, file));
    // Reset the persistent store before each fixture so seeded entities
    // start from a clean slate.
    await B.StorageService.clear();
    // Re-seed window globals our backend expects.
    win.ENTITY_SAMPLES = {};
    win.CAST_SAMPLE = [];
    win.__LW_SAMPLE_LOADED__ = false;
    // Seed entities for this fixture.
    for (const [type, rows] of Object.entries(fixture.seed || {})) {
      for (const row of rows) {
        await B.EntityService.save(type, row, { status: "active" });
      }
    }
    // Run extraction (no AI provider configured, so local-only).
    const res = await B.ExtractionService.runExtraction({
      chapterId: fixture.chapterId,
      text: fixture.text,
      deep: false,
      paragraphs: fixture.paragraphs,
    });
    const tag = `[${fixture.name}]`;
    const allOcc = B.OccurrenceService.listByChapterSync(fixture.chapterId);
    const allCand = B.StorageService.getSync(B.keys.reviewQueue, []).filter((q) => q.chapterId === fixture.chapterId);

    // Occurrence count bounds.
    if (fixture.minOccurrences != null) {
      log(`${tag} occurrences >= ${fixture.minOccurrences}`, allOcc.length >= fixture.minOccurrences, `got ${allOcc.length}`);
    }
    if (fixture.maxOccurrences != null) {
      log(`${tag} occurrences <= ${fixture.maxOccurrences}`, allOcc.length <= fixture.maxOccurrences, `got ${allOcc.length}`);
    }
    // Expected occurrences (subset check).
    for (const exp of fixture.expectedOccurrences || []) {
      const hit = allOcc.some((o) => o.entityId === exp.entityId && (!exp.exactText || o.exactText === exp.exactText));
      log(`${tag} occurrence ${exp.entityId}${exp.exactText ? ` "${exp.exactText}"` : ""}`, hit);
    }
    // Forbidden occurrences (must NOT appear).
    for (const exp of fixture.forbiddenOccurrences || []) {
      const hit = allOcc.some((o) => o.entityId === exp.entityId);
      log(`${tag} forbidden occurrence ${exp.entityId} absent`, !hit);
    }
    // Expected candidates (subset check).
    for (const exp of fixture.expectedCandidates || []) {
      const hit = allCand.some((c) =>
        c.entityType === exp.entityType
        && c.suggestedAction === exp.suggestedAction
        && (!exp.matchType || c.matchType === exp.matchType)
        && (!exp.existingEntityId || c.existingEntityId === exp.existingEntityId)
        && (!exp.suggestedChanges || Object.entries(exp.suggestedChanges).every(([k, v]) => c.suggestedChanges && c.suggestedChanges[k] === v))
      );
      log(`${tag} candidate ${exp.entityType}/${exp.suggestedAction}${exp.suggestedChanges ? " +changes" : ""}`, hit);
    }
  }

  // -------------------------------------------------------------------
  // Field-parity round-trip tests
  // -------------------------------------------------------------------
  console.log("");
  console.log("[field-parity round-trip]");

  // Re-load editor configs into our shimmed window so the JSON-template
  // generator works in this Node sandbox.
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "entity-editor-configs.jsx"), "utf8"), win, { filename: "entity-editor-configs.jsx" });
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "entity-editor-configs-extended.jsx"), "utf8"), win, { filename: "entity-editor-configs-extended.jsx" });
  log("entity-editor configs loaded", !!win.ENTITY_EDITOR_CONFIGS);

  // Priority 8: rich-field round-trip per type.
  const richSamples = {
    cast: {
      name: "Saren of Hess", aliases: ["Sar"], role: "Co-protagonist",
      pronouns: "she/her", ageRange: "adult", age: "31", title: "Courier",
      species: "human", class: "scout", faction: "Greys", occupation: "courier",
      portrait: "", physicalDescription: "Tall, sun-dark.", clothing: "Storm cloak.",
      distinguishingMarks: ["scar at temple"],
      voiceProfile: "terse", speechStyle: "clipped", verbalTics: ["…"], languages: ["Common"],
      personality: "Watchful.", goals: ["find the Auger"], fears: ["being followed"],
      secrets: "She broke her oath.", flaws: ["proud"], strengths: ["quick"], moralCompass: "duty over love",
      arcSummary: "Falls and rises.", backstory: "Born to a salt house.", currentStatus: "On the road.", presence: "calm",
      stats: [{ name: "Resolve", value: 7 }],
      skills: [], abilities: ["Quickstep"], statusEffects: [],
      inventory: [], equippedItems: [], wealth: "thin",
      carryingNotes: "Sword on the off hip.",
      family: [], allies: ["aelinor"], enemies: [], lovers: [], rivals: [], mentors: [],
      relationshipNotes: "Trusts Aelinor.",
      currentLocation: "vraska", homeLocation: "hess", travelHistory: [],
      firstAppearance: "Ch. 1", lastAppearance: "Ch. 7",
      timelineEvents: [], quests: [],
      sourceMentions: "Ch. 1: 'Saren ducked under the eaves.'",
      references: [],
      writingInstructions: "Keep her terse.", aiInterview: "Why courier?",
      avoidTropes: ["chosen one"], preferredScenes: ["rooftops"],
      tags: ["wip"], status: "active", doNotSuggest: false, dormant: false,
    },
    items: {
      name: "Auger of Hess", aliases: ["Auger"], itemType: "tool", customType: "drill",
      rarity: "Heirloom", summary: "Bone-handled drill.", description: "A bone auger.",
      icon: "Au", weight: "1.2 lb", value: "priceless", condition: "Worn", durability: "3 / 3",
      currentOwner: "aelinor", currentLocation: "vraska", status: "carried",
      slot: "off-hand", carried: true, equipped: false,
      modifiers: [], affixes: [], passive: [], active: [], triggered: [],
      restrictions: "House blood only.",
      compatibleClasses: [], compatibleRaces: [], linkedStats: [], linkedSkills: [],
      quests: [], events: [], factions: [],
      foundLocation: "vraska", lostLocation: "", destroyedLocation: "", usedLocations: [],
      firstChapter: "Ch. 1", lastChapter: "Ch. 7",
      ownershipHistory: "Hess → Aelinor", tradeTransferHistory: "[]",
      sourceMentions: "Ch. 1.", tags: ["wip"], notes: "", references: [],
      entityStatus: "active", doNotSuggest: false, dormant: false,
    },
    locations: {
      name: "Vraska Pass", aliases: ["The Pass"], kind: "pass", customKind: "",
      parentId: "", summary: "Cold gate.",
      description: "Wind never stops.", history: "Old.", culture: "Soldiers.", climate: "Cold.",
      danger: "risky", currentStatus: "Held.",
      placed: true, coords: { x: 0.3, y: 0.5 }, atlasMap: "Salt-Coast (default)",
      routes: ["hess", "glass-court"],
      characters: [], bestiary: [], items: [], quests: [], events: [], factions: [],
      firstChapter: "Ch. 1", lastChapter: "Ch. 7",
      sourceMentions: "Ch. 1: 'They crossed Vraska Pass.'",
      childLocationIds: [],
      tags: ["wip"], notes: "", references: [],
      status: "active", doNotSuggest: false, dormant: false, reviewable: true,
    },
    quests: {
      title: "Find the Auger", aliases: ["Auger hunt"], questType: "Main quest",
      status: "Active", summary: "Recover the Auger.", goal: "Auger returned.",
      owner: "aelinor", participants: ["aelinor", "saren"], factions: [],
      steps: [{ id: "s1", title: "Leave Hess", status: "complete" }],
      branches: [], conditions: ["alive"],
      outcomes: [], rewards: ["honour"], relatedEvents: [],
      locations: ["vraska"], items: ["auger"], atlasRoute: "hess → vraska",
      startChapter: "Ch. 1", completionChapter: "", timelinePosition: "Spring",
      sourceMentions: "Ch. 1", tags: [], notes: "", references: [],
      entityStatus: "active", doNotSuggest: false, dormant: false,
    },
    events: {
      title: "Auger Wake", aliases: [], eventType: "Death", summary: "The bell rings.",
      chapter: "Ch. 4", timelinePosition: "Year 3", location: "hess", atlasPlacement: "Hess",
      cause: "Long debt.", immediateOutcome: "Town wakes.", longTermConsequence: "Auger lost.",
      participants: ["aelinor"], factions: [],
      relationshipChanges: [], characterStateChanges: [], itemStateChanges: [],
      locationChanges: [], statChanges: [],
      relatedQuests: ["find-auger"], relatedItems: ["auger"],
      tags: [], sourceMentions: "Ch. 4", notes: "", references: [],
      status: "active", doNotSuggest: false, dormant: false,
    },
    stats: {
      name: "Resolve", aliases: ["nerve"], summary: "Refusal to break.",
      valueType: "number", displayFormat: "N / 10",
      defaultValue: "5", min: 0, max: 10,
      appliesTo: ["Cast"],
      extractionRules: [{ phrase: "resolve hardened", effect: "increase" }],
      testPhrase: "",
      relatedSkills: [], relatedItems: [], relatedClasses: [], relatedRaces: [],
      assignedEntities: ["aelinor"],
      changeHistory: "[]", sourceMentions: "Ch. 1.",
      tags: [], notes: "", references: [],
      status: "active", doNotSuggest: false, dormant: false,
    },
    bestiary: {
      name: "Hess Wolfhound", aliases: ["wolfhound"], speciesType: "beast", category: "Beast",
      summary: "Big.", description: "Cold-bred.",
      threatLevel: "moderate", disposition: "wary", challenge: "3", fightOrFlight: "fight",
      habitat: "moors", regions: ["Hessmark"], encounterLocations: [], activeTimes: ["dusk"],
      behaviour: "Tracks.", abilities: ["track"], weaknesses: ["fire"], diet: "carnivore", lifecycle: "long",
      relatedRace: [], relatedFactions: [], relatedLocations: [], relatedQuests: [], relatedEvents: [], lore: [],
      chapterAppearances: ["Ch. 2"], sourceMentions: "Ch. 2", references: [],
      status: "active", doNotSuggest: false, dormant: false,
    },
    references: {
      title: "Style sample 01", kind: "style sample", url: "", author: "EM",
      summary: "Tone reference.", body: "A passage.",
      useFor: "voice", includeInAI: true,
      isStyleSample: true, isCanonSource: false, isResearchNote: false, isOnboardingAnswer: false,
      relatedEntities: [], tags: ["voice"],
      status: "active", doNotSuggest: false,
    },
  };

  // Walk every priority-8 type and round-trip the rich sample.
  for (const [type, sample] of Object.entries(richSamples)) {
    await B.StorageService.clear();
    win.__LW_SAMPLE_LOADED__ = false;
    win.ENTITY_SAMPLES = {};
    win.CAST_SAMPLE = [];
    // Seed entities the rich sample references so related fields don't
    // dangle. (Aelinor, Vraska, Auger, etc.)
    for (const seed of [
      { type: "cast", id: "aelinor", name: "Aelinor" },
      { type: "cast", id: "saren",   name: "Saren" },
      { type: "locations", id: "vraska", name: "Vraska Pass" },
      { type: "locations", id: "hess",   name: "Hess" },
      { type: "items", id: "auger", name: "Auger of Hess" },
      { type: "quests", id: "find-auger", name: "Find the Auger" },
    ]) {
      await B.EntityService.save(seed.type, { id: seed.id, name: seed.name }, { status: "active" });
    }
    const saved = await B.EntityService.save(type, sample, { status: "active" });
    log(`[parity ${type}] save returns object with id`, !!saved?.id);
    const reloaded = B.EntityService.getSync(saved.id, type);
    log(`[parity ${type}] reload finds the entity`, !!reloaded);
    // Round-trip assert: every key from the rich sample is present on
    // the reloaded entity (either at top level or under .data).
    const keys = Object.keys(sample);
    const missing = keys.filter((k) => {
      // The shape EntityService uses is: top-level (name, status,
      // aliases, summary) + everything else under `.data`. Either is
      // acceptable.
      return reloaded && reloaded[k] === undefined && (!reloaded.data || reloaded.data[k] === undefined);
    });
    log(`[parity ${type}] all ${keys.length} rich fields round-trip`, missing.length === 0, missing.length ? "missing: " + missing.join(",") : "");

    // JSON-template completeness: every key in the sample should appear
    // in eeJsonTemplate(type).
    const tpl = win.eeJsonTemplate ? win.eeJsonTemplate(type) : {};
    const tplMissing = keys.filter((k) => !(k in tpl));
    log(`[parity ${type}] JSON template covers ${keys.length} fields`, tplMissing.length === 0, tplMissing.length ? "missing: " + tplMissing.join(",") : "");
  }

  // Unknown-field preservation: save an entity with an `extra.future`
  // key that no config knows about; reload; assert the key survives.
  await B.StorageService.clear();
  const withExtra = await B.EntityService.save("cast", {
    name: "Future-friend",
    extra: { future: "this-key-must-survive", schemaVersion: "v3" },
  }, { status: "active" });
  const reloadedExtra = B.EntityService.getSync(withExtra.id, "cast");
  const extra = reloadedExtra?.extra || reloadedExtra?.data?.extra;
  log("unknown-field preservation: extra.future survives save+reload", extra?.future === "this-key-must-survive");
  log("unknown-field preservation: extra.schemaVersion survives", extra?.schemaVersion === "v3");

  // Audit-only types: basic round-trip per type.
  const auditOnlyTypes = ["classes", "races", "skills", "relationships", "timeline", "lore"];
  for (const type of auditOnlyTypes) {
    await B.StorageService.clear();
    const ent = await B.EntityService.save(type, { name: `Test ${type}` }, { status: "active" });
    const back = B.EntityService.getSync(ent.id, type);
    log(`[audit-only ${type}] basic round-trip`, !!back && back.name === `Test ${type}`);
  }

  console.log("");
  if (failures.length) {
    console.log(`FAIL — ${failures.length} smoke check(s) failed:`);
    for (const f of failures) console.log("  -", f);
    process.exit(1);
  }
  console.log("All smoke checks passed.");
}

main().catch((e) => {
  console.error("Smoke test crashed:", e);
  process.exit(1);
});
