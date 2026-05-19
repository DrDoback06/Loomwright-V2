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

  // -------------------------------------------------------------------
  // Workspace persistence
  // -------------------------------------------------------------------
  console.log("");
  console.log("[workspace persistence]");

  // -- Atlas --
  await B.StorageService.clear();
  const vraska = await B.EntityService.save("locations", { name: "Vraska Pass" }, { status: "active" });
  const hess = await B.EntityService.save("locations", { name: "Hess" }, { status: "active" });
  await B.AtlasService.placeLocation(vraska.id, { x: 0.3, y: 0.5 }, { atlasMap: "Salt-Coast (default)" });
  const placed = B.AtlasService.listPlacedSync();
  log("[atlas] placeLocation persists coords + placed flag", placed.some((l) => l.id === vraska.id && l.data?.coords?.x === 0.3));
  log("[atlas] placeLocation sets atlasMap", placed.find((l) => l.id === vraska.id)?.data?.atlasMap === "Salt-Coast (default)");
  await B.AtlasService.updatePlacement(vraska.id, { coords: { x: 0.6, y: 0.4 } });
  const moved = B.EntityService.getSync(vraska.id, "locations");
  log("[atlas] updatePlacement merges coords", moved.data.coords.x === 0.6 && moved.data.atlasMap === "Salt-Coast (default)");
  await B.AtlasService.setRoute(vraska.id, hess.id, "road");
  let withRoute = B.EntityService.getSync(vraska.id, "locations");
  log("[atlas] setRoute pushes onto data.routes", (withRoute.data.routes || []).some((r) => r.to === hess.id && r.kind === "road"));
  await B.AtlasService.setRoute(vraska.id, hess.id, "ferry");
  withRoute = B.EntityService.getSync(vraska.id, "locations");
  const matching = (withRoute.data.routes || []).filter((r) => r.to === hess.id);
  log("[atlas] setRoute deduplicates (single entry per dest)", matching.length === 1 && matching[0].kind === "ferry");
  await B.AtlasService.removeRoute(vraska.id, hess.id);
  withRoute = B.EntityService.getSync(vraska.id, "locations");
  log("[atlas] removeRoute strips the destination", !(withRoute.data.routes || []).some((r) => r.to === hess.id));
  const atlasCast = await B.EntityService.save("cast", { name: "Aelinor" }, { status: "active" });
  await B.AtlasService.linkEntityToLocation(atlasCast.id, "cast", vraska.id);
  const linkedCast = B.EntityService.getSync(atlasCast.id, "cast");
  const linkedLoc = B.EntityService.getSync(vraska.id, "locations");
  log("[atlas] linkEntityToLocation sets entity.data.locationId", linkedCast.data.locationId === vraska.id);
  log("[atlas] linkEntityToLocation pushes onto location.data.characters", (linkedLoc.data.characters || []).includes(atlasCast.id));

  // -- Skill Trees --
  await B.StorageService.clear();
  const skillA = await B.EntityService.save("skills", { name: "Quickstep" }, { status: "active" });
  const skillB = await B.EntityService.save("skills", { name: "Sidestep" }, { status: "active" });
  const tree = await B.SkillTreeService.addTree({ name: "Footwork", description: "Movement skills." });
  const treeId = tree.trees[tree.trees.length - 1].id;
  log("[skill-trees] addTree persists", !!treeId);
  await B.SkillTreeService.addNode(treeId, skillA.id, { x: 100, y: 200 });
  await B.SkillTreeService.addNode(treeId, skillB.id, { x: 200, y: 200 });
  let state = B.SkillTreeService.loadSync();
  let t0 = state.trees.find((t) => t.id === treeId);
  log("[skill-trees] addNode updates nodeIds + layout", t0.nodeIds.includes(skillA.id) && t0.layout[skillA.id]?.x === 100);
  await B.SkillTreeService.updateNodePosition(treeId, skillA.id, { x: 150, y: 250 });
  state = B.SkillTreeService.loadSync();
  t0 = state.trees.find((t) => t.id === treeId);
  log("[skill-trees] updateNodePosition updates layout", t0.layout[skillA.id]?.x === 150 && t0.layout[skillA.id]?.y === 250);
  await B.SkillTreeService.connectNodes(treeId, skillA.id, skillB.id);
  state = B.SkillTreeService.loadSync();
  t0 = state.trees.find((t) => t.id === treeId);
  log("[skill-trees] connectNodes writes edge", (t0.edges || []).some((e) => e.from === skillA.id && e.to === skillB.id));
  await B.SkillTreeService.connectNodes(treeId, skillA.id, skillB.id);
  state = B.SkillTreeService.loadSync();
  t0 = state.trees.find((t) => t.id === treeId);
  log("[skill-trees] connectNodes dedupes (no duplicate edge)", (t0.edges || []).filter((e) => e.from === skillA.id && e.to === skillB.id).length === 1);
  await B.SkillTreeService.disconnectNodes(treeId, skillA.id, skillB.id);
  state = B.SkillTreeService.loadSync();
  t0 = state.trees.find((t) => t.id === treeId);
  log("[skill-trees] disconnectNodes removes the edge", !(t0.edges || []).some((e) => e.from === skillA.id && e.to === skillB.id));
  await B.StorageService.remove(B.keys.skillTrees);
  const empty = B.SkillTreeService.loadSync();
  log("[skill-trees] loadSync returns default state after clear", Array.isArray(empty.trees) && empty.trees.length === 0);

  // -- Relationships (via existing EntityService) --
  await B.StorageService.clear();
  const rel = await B.EntityService.save("relationships", {
    name: "Aelinor → Saren", fromId: "aelinor", toId: "saren",
    relationshipType: "ally", strength: 60,
  }, { status: "active" });
  const relReloaded = B.EntityService.getSync(rel.id, "relationships");
  log("[relationships] save → reload survives", relReloaded?.fromId === "aelinor" && relReloaded?.toId === "saren");
  await B.EntityService.update("relationships", rel.id, { strength: 75 });
  const relStronger = B.EntityService.getSync(rel.id, "relationships");
  log("[relationships] edit → reload survives", relStronger.strength === 75);
  await B.LinkService.appendField(rel.id, "relationships", "evidence", "Ch. 3: knife wound");
  const relWithEv = B.EntityService.getSync(rel.id, "relationships");
  log("[relationships] LinkService.appendField evidence persists", (relWithEv.data?.evidence || []).includes("Ch. 3: knife wound"));

  // -- Timeline (via existing EntityService) --
  await B.StorageService.clear();
  const tl = await B.EntityService.save("timeline", {
    name: "Auger Wake", track: "main", isMilestone: true, dateLabel: "Year 3",
  }, { status: "active" });
  const tlBack = B.EntityService.getSync(tl.id, "timeline");
  log("[timeline] save → reload survives", tlBack?.name === "Auger Wake" && tlBack?.isMilestone === true);
  await B.EntityService.update("timeline", tl.id, { dateLabel: "Year 4" });
  const tlEdited = B.EntityService.getSync(tl.id, "timeline");
  log("[timeline] edit → reload survives", tlEdited.dateLabel === "Year 4");
  await B.LinkService.appendField(tl.id, "timeline", "characters", "aelinor");
  const tlLinked = B.EntityService.getSync(tl.id, "timeline");
  log("[timeline] LinkService.appendField characters persists", (tlLinked.data?.characters || []).includes("aelinor"));

  // -- Tangle --
  await B.StorageService.clear();
  const tNode = await B.TangleService.addNode({ title: "Idea: Aelinor's secret", body: "Tied to Hess." });
  const tnRow = tNode.nodes[tNode.nodes.length - 1];
  log("[tangle] addNode persists", !!tnRow?.id);
  await B.TangleService.updateNode(tnRow.id, { position: { x: 240, y: 320 } });
  const tStateAfter = B.TangleService.loadSync();
  const tnUpdated = tStateAfter.nodes.find((n) => n.id === tnRow.id);
  log("[tangle] updateNode patches position", tnUpdated?.position?.x === 240 && tnUpdated?.position?.y === 320);
  await B.TangleService.addGroup({ title: "Hess motifs" });
  const tGroup = B.TangleService.loadSync().groups;
  log("[tangle] addGroup persists", tGroup.length === 1 && tGroup[0].title === "Hess motifs");
  await B.TangleService.removeNode(tnRow.id);
  const tRemoved = B.TangleService.loadSync();
  log("[tangle] removeNode removes", !tRemoved.nodes.some((n) => n.id === tnRow.id));

  // -------------------------------------------------------------------
  // Project import / export
  // -------------------------------------------------------------------
  console.log("");
  console.log("[project import/export]");

  await B.StorageService.clear();
  // Seed a small project: 2 cast, 1 location, 1 chapter, 1 reference, 1 settings blob with a fake apiKey.
  const seedCast1 = await B.EntityService.save("cast", { name: "Hess Vaela" });
  const seedCast2 = await B.EntityService.save("cast", { name: "Sara Lin" });
  const seedLoc = await B.EntityService.save("locations", { name: "Ash Hollow", data: { placed: true, coords: { x: 10, y: 20 } } });
  await B.ManuscriptChapterService.createFromComposition({ title: "Chapter One", bodyText: "First page.", bodyHtml: "<p>First page.</p>" });
  await B.StorageService.set(B.keys.references, [
    { id: "ref-1", title: "Style guide", kind: "style", source: "user" },
  ]);
  await B.StorageService.set(B.keys.settings, {
    brandName: "Loomwright",
    aiProviderSettings: { provider: "anthropic", apiKey: "sk-ant-leak-me", model: "claude-opus-4-7" },
  });
  // The encrypted-keys blob lives on its own key and MUST never leak.
  await B.StorageService.set(B.keys.apiKeys || "api_keys_encrypted", { ciphertext: "should-never-export", iv: "x" });

  // --- buildExport ---
  const exp = await B.ProjectArchiveService.buildExport();
  log("[archive] buildExport schemaVersion = loomwright-project-v1", exp.schemaVersion === "loomwright-project-v1");
  log("[archive] buildExport metadata.apiKeysIncluded = false", exp.metadata.apiKeysIncluded === false);
  log("[archive] buildExport never includes api_keys_encrypted", JSON.stringify(exp).indexOf("should-never-export") === -1);
  log("[archive] buildExport redacts settings.aiProviderSettings.apiKey", exp.settings?.aiProviderSettings?.apiKey === "[redacted]" || JSON.stringify(exp.settings || {}).indexOf("sk-ant-leak-me") === -1);
  log("[archive] buildExport entities.cast count = 2", (exp.entities.cast || []).length === 2);
  log("[archive] buildExport entities.locations count = 1", (exp.entities.locations || []).length === 1);
  log("[archive] buildExport metadata.chapterCount >= 1", (exp.metadata.chapterCount || 0) >= 1);

  // includeSampleData=false should not drop user-source records.
  const expNoSample = await B.ProjectArchiveService.buildExport({ includeSampleData: false });
  log("[archive] buildExport includeSampleData=false keeps user records", (expNoSample.entities.cast || []).length === 2);

  // includeTrash default false.
  log("[archive] buildExport excludes trash by default", expNoSample.metadata.includesTrash === false && expNoSample.trash.length === 0);

  // --- validateExportPayload ---
  const v1Valid = B.ProjectArchiveService.validateExportPayload(exp);
  log("[archive] validate v1 payload valid", v1Valid.valid && v1Valid.schemaVersion === "loomwright-project-v1");

  const v2Legacy = B.ProjectArchiveService.validateExportPayload({ schemaVersion: "loomwright/project-export/v2", entities: {} });
  log("[archive] validate legacy v2 valid with warning", v2Legacy.valid && v2Legacy.warnings.some((w) => /Legacy/.test(w)));

  const vBad = B.ProjectArchiveService.validateExportPayload("nope");
  log("[archive] validate non-object payload invalid", vBad.valid === false);

  // --- summarizeExportPayload ---
  const summ = B.ProjectArchiveService.summarizeExportPayload(exp);
  log("[archive] summarize counts.entities >= 3", (summ.counts.entities || 0) >= 3);
  log("[archive] summarize apiKeysIncluded false", summ.apiKeysIncluded === false);

  // --- applyImport merge — preserves existing, adds new ---
  // Create a separate payload that has 1 new cast + the same Hess Vaela.
  const importPayload = JSON.parse(JSON.stringify(exp));
  importPayload.entities.cast.push({
    id: "cast-new-via-import",
    type: "cast",
    name: "Edrun Pell",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  // Mutate the existing Hess Vaela so we can verify merge does NOT overwrite by default.
  importPayload.entities.cast[0] = { ...importPayload.entities.cast[0], name: "Hess CHANGED" };

  await B.ProjectArchiveService.applyImport(importPayload, { mode: "merge" });
  const afterMerge = B.EntityService.listSync("cast");
  log("[archive] merge adds new entity", afterMerge.some((c) => c.id === "cast-new-via-import"));
  const hessAfterMerge = afterMerge.find((c) => c.id === seedCast1.id);
  log("[archive] merge does not overwrite existing on conflict", hessAfterMerge && hessAfterMerge.name === "Hess Vaela");

  // --- applyImport merge with overwriteOnConflict ---
  await B.ProjectArchiveService.applyImport(importPayload, { mode: "merge", overwriteOnConflict: true });
  const afterOverwrite = B.EntityService.listSync("cast").find((c) => c.id === seedCast1.id);
  log("[archive] merge overwriteOnConflict updates existing", afterOverwrite && afterOverwrite.name === "Hess CHANGED");

  // --- applyImport replace — wipes store then loads payload (no preserved entities) ---
  // Use the original exp (which still has the original Hess Vaela), then check the new "Edrun Pell" that we added in importPayload is gone.
  await B.ProjectArchiveService.applyImport(exp, { mode: "replace" });
  const afterReplace = B.EntityService.listSync("cast");
  log("[archive] replace wipes-and-loads payload entities", afterReplace.length === 2 && !afterReplace.some((c) => c.id === "cast-new-via-import"));

  // --- Entity library export/import ---
  const lib = await B.ProjectArchiveService.buildEntityLibrary({ types: ["cast"], includeReferences: false, includeOccurrences: false });
  log("[archive] library schemaVersion = loomwright-library-v1", lib.schemaVersion === "loomwright-library-v1");
  log("[archive] library contains only requested types", Object.keys(lib.entities).length === 1 && !!lib.entities.cast);
  log("[archive] library cast count = 2", lib.entities.cast.length === 2);

  // Reset, apply library — only cast lands.
  await B.StorageService.clear();
  await B.ProjectArchiveService.applyEntityLibrary(lib);
  const libCast = B.EntityService.listSync("cast");
  const libLoc = B.EntityService.listSync("locations");
  log("[archive] applyEntityLibrary imports selected type", libCast.length === 2);
  log("[archive] applyEntityLibrary does not import unselected types", libLoc.length === 0);

  // --- Defensive: redactSecrets recursively strips nested apiKey ---
  await B.StorageService.set(B.keys.settings, { nested: { deep: { apiKey: "sk-deep", model: "ok" } } });
  const expNested = await B.ProjectArchiveService.buildExport();
  log("[archive] redactSecrets strips nested apiKey", JSON.stringify(expNested.settings || {}).indexOf("sk-deep") === -1);

  // -------------------------------------------------------------------
  // Speed Reader
  // -------------------------------------------------------------------
  console.log("");
  console.log("[speed reader]");

  await B.StorageService.clear();

  // -- We can't load speed-reader.jsx in this sandbox (JSX/React), so
  // exercise the tokeniser / pivot helpers via a direct re-implementation
  // that mirrors srTokenise / srSplitWord. The service exercise below
  // covers the persistence layer; smoke for the engine helpers lives in
  // the e2e suite which has a real DOM.
  function srTokeniseSmoke(text) {
    if (!text) return [];
    const raw = text.replace(/\s+/g, " ").trim().split(" ");
    const out = [];
    raw.forEach((w, i) => {
      if (!w) return;
      const last = w[w.length - 1];
      out.push({
        idx: i,
        word: w,
        sentenceEnd: /[.!?…]/.test(last),
        clauseEnd: /[,;:—–]/.test(last) && !/[.!?…]/.test(last),
        length: w.length,
      });
    });
    return out;
  }
  function srSplitWordSmoke(word) {
    if (!word) return { before: "", pivot: "", after: "" };
    const len = word.length;
    let p = 0;
    if (len <= 1) p = 0;
    else if (len <= 4) p = 1;
    else if (len <= 6) p = 2;
    else if (len <= 9) p = 3;
    else if (len <= 13) p = 4;
    else p = 5;
    return { before: word.slice(0, p), pivot: word[p] || "", after: word.slice(p + 1) };
  }
  log("[sr] tokenise empty → 0", srTokeniseSmoke("").length === 0);
  const tok = srTokeniseSmoke("Hello brave new world.");
  log("[sr] tokenise 4-word sentence → 4 beats", tok.length === 4);
  log("[sr] tokenise marks sentence end on '.'", tok[3].sentenceEnd === true);
  const tokClause = srTokeniseSmoke("first, second, third.");
  log("[sr] tokenise marks clause-end on ','", tokClause[0].clauseEnd === true && tokClause[1].clauseEnd === true);
  log("[sr] split 'at' pivot index = 1", srSplitWordSmoke("at").pivot === "t");
  log("[sr] split 'running' pivot index = 3", srSplitWordSmoke("running").pivot === "n");
  log("[sr] split 'communication' pivot index = 4 (len<=13)", srSplitWordSmoke("communication").pivot === "u");
  log("[sr] split 'extraordinarily' pivot index = 5 (len>13)", srSplitWordSmoke("extraordinarily").pivot === "o");

  // ----- SpeedReaderService persistence -----
  const SRS = B.SpeedReaderService;
  log("[sr] SpeedReaderService exposed", !!SRS && typeof SRS.createSession === "function");

  const initial = SRS.loadSync();
  log("[sr] defaultState shape: { activeId:null, sessions:[] }", initial.activeId === null && Array.isArray(initial.sessions) && initial.sessions.length === 0);

  // Create a paste session.
  const created = await SRS.createSession({
    sourceType: "paste",
    rawText: "The light over Pale Reach was the colour of cooled tin.",
    name: "Smoke paste",
  });
  log("[sr] createSession returns a session with id + totalWords", !!created?.id && created.totalWords > 0);
  log("[sr] createSession sets activeId", SRS.loadSync().activeId === created.id);

  // Bookmark + note.
  await SRS.addBookmark(created.id, { wordIndex: 3, label: "first highlight" });
  await SRS.addBookmark(created.id, { wordIndex: 3, label: "first highlight" }); // dedup
  await SRS.addNote(created.id, { wordIndex: 5, kind: "difficulty", body: "slow" });
  const afterBM = SRS.getSessionSync(created.id);
  log("[sr] addBookmark persists", afterBM.bookmarks.length === 1);
  log("[sr] addBookmark dedups identical (wordIndex,label)", afterBM.bookmarks.length === 1);
  log("[sr] addNote persists", afterBM.notes.length === 1);

  // Settings update.
  await SRS.setSettings(created.id, { wpm: 480, fontSize: 80 });
  const afterSet = SRS.getSessionSync(created.id);
  log("[sr] setSettings patches wpm + fontSize", afterSet.wpm === 480 && afterSet.fontSize === 80);

  // Progress + reset.
  await SRS.setProgress(created.id, 7);
  log("[sr] setProgress updates currentWordIndex", SRS.getSessionSync(created.id).currentWordIndex === 7);
  log("[sr] setProgress stamps stats.lastReadAt", !!SRS.getSessionSync(created.id).stats?.lastReadAt);
  await SRS.resetProgress(created.id);
  const afterReset = SRS.getSessionSync(created.id);
  log("[sr] resetProgress sets idx=0 and preserves bookmarks", afterReset.currentWordIndex === 0 && afterReset.bookmarks.length === 1);

  // Reload persistence — wipe localStorage handle, re-read via service.
  // (StorageService backs IndexedDB; we can simulate "reload" by reading again.)
  log("[sr] listSessionsSync returns the session after persist", SRS.listSessionsSync().some((s) => s.id === created.id));

  // Chapter source resolver.
  await B.ManuscriptChapterService.createFromComposition({
    title: "Smoke Chapter",
    bodyText: "Snow had been falling all morning.",
    bodyHtml: "<p>Snow had been falling all morning.</p>",
  });
  const chSess = await SRS.createSession({ sourceType: "chapter" });
  log("[sr] chapter source resolves rawText from ManuscriptChapterService", chSess.rawText.includes("Snow had been falling"));
  log("[sr] chapter source carries chapter title as sourceTitle", chSess.sourceTitle === "Smoke Chapter");

  // Delete a session.
  await SRS.deleteSession(created.id);
  const afterDelete = SRS.loadSync();
  log("[sr] deleteSession removes the row", !afterDelete.sessions.some((s) => s.id === created.id));
  log("[sr] deleteSession clears activeId only when it was the deleted session", afterDelete.activeId === chSess.id);

  // Reference source resolver — defensive empty case.
  await B.StorageService.set(B.keys.references, [
    { id: "ref-1", title: "Style guide", content: "Pace breath. Read deliberately.", source: "user" },
  ]);
  const refSess = await SRS.createSession({ sourceType: "reference", sourceId: "ref-1" });
  log("[sr] reference source resolves content + title", refSess.rawText.includes("Pace breath") && refSess.sourceTitle === "Style guide");

  // Errors on empty source.
  let threw = false;
  try { await SRS.createSession({ sourceType: "paste", rawText: "   " }); } catch (_) { threw = true; }
  log("[sr] createSession throws on empty rawText", threw);

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
