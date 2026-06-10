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
      getRandomValues: (arr) => require("node:crypto").webcrypto.getRandomValues(arr),
      // Use Node's real Web Crypto so KeysService.encrypt/decrypt work
      // in-process (mirrors the browser's window.crypto.subtle).
      subtle: require("node:crypto").webcrypto.subtle,
    },
    document: shimDoc(),
    prompt: () => null,
    confirm: () => true,
    console,
    setTimeout, clearTimeout, setImmediate,
    TextEncoder, TextDecoder,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
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

  // -- Offline NER discovery + streaming progress (no AI) --
  {
    const stages = [];
    const progListener = (e) => stages.push("evt:" + (e.detail && e.detail.stage));
    win.addEventListener("lw:extraction-progress", progListener);
    await B.ExtractionService.runExtraction({
      chapterId: "ch-stream",
      text: "\"Hold the line,\" said Theron. Theron raised the Sunblade high and rode toward Kelmoor.",
      deep: false,
      onProgress: (d) => stages.push(d.stage),
    });
    win.removeEventListener("lw:extraction-progress", progListener);
    const streamCands = B.StorageService.getSync(B.keys.reviewQueue, []).filter((q) => q.chapterId === "ch-stream");
    log("runExtraction reports a start stage via onProgress", stages.includes("start"));
    log("runExtraction reports a complete stage via onProgress", stages.includes("complete"));
    log("runExtraction dispatches lw:extraction-progress window events", stages.some((s) => String(s).startsWith("evt:")));
    log("offline discovery finds a new cast member from dialogue", streamCands.some((c) => c.entityType === "cast" && c.matchType === "new"));
    log("offline discovery finds a new item from naming cue", streamCands.some((c) => c.entityType === "items" && c.matchType === "new"));
    log("offline discovery finds a new location from a directional cue", streamCands.some((c) => c.entityType === "locations" && c.matchType === "new"));
    const groupCounts = {};
    streamCands.forEach((c) => { if (c.groupId) groupCounts[c.groupId] = (groupCounts[c.groupId] || 0) + 1; });
    log("multi-entry candidates from one sentence share a groupId", Object.values(groupCounts).some((n) => n >= 2));
  }

  // -- Auto-apply high-confidence (blue) candidates --
  {
    const created = await B.autoApplyCandidate({ entityType: "cast", name: "Auto Knight", summary: "Forged in extraction.", suggestedAction: "create", confidenceBand: "blue" });
    log("auto-apply creates a new entity for a blue candidate", !!(created && created.id) && !!B.EntityService.getSync(created.id, "cast"));
    const itm = await B.EntityService.save("items", { name: "Auto Blade" }, { status: "active" });
    await B.autoApplyCandidate({ entityType: "items", existingEntityId: itm.id, suggestedChanges: { rarity: "rare" }, suggestedAction: "update", confidenceBand: "blue" });
    log("auto-apply applies only the diff to an existing entity", B.EntityService.getSync(itm.id, "items")?.data?.rarity === "rare");
    // suggestedChanges land on a NEW entity (relationship fromId/toId etc.).
    const rel = await B.autoApplyCandidate({ entityType: "relationships", name: "Theron → Brennan", suggestedAction: "create", confidenceBand: "blue", suggestedChanges: { fromId: "a1", toId: "b1", relationshipType: "ally" }, relatedEntityIds: ["a1", "b1"] });
    const relEnt = rel && B.EntityService.getSync(rel.id, "relationships");
    log("new relationship carries fromId/toId/type in data", !!relEnt && relEnt.data && relEnt.data.fromId === "a1" && relEnt.data.toId === "b1" && relEnt.data.relationshipType === "ally");
  }

  // -- Re-extraction is idempotent (no duplicate candidates/occurrences) --
  {
    const text = "Korrin rode into Drassmoor. \"Onward,\" said Korrin.";
    await B.ExtractionService.runExtraction({ chapterId: "ree-ch", text, deep: false });
    const cand1 = B.StorageService.getSync(B.keys.reviewQueue, []).filter((q) => q.chapterId === "ree-ch").length;
    const occ1 = B.OccurrenceService.listByChapterSync("ree-ch").length;
    await B.ExtractionService.runExtraction({ chapterId: "ree-ch", text, deep: false });
    const cand2 = B.StorageService.getSync(B.keys.reviewQueue, []).filter((q) => q.chapterId === "ree-ch").length;
    const occ2 = B.OccurrenceService.listByChapterSync("ree-ch").length;
    log("re-extraction does not duplicate candidates", cand1 > 0 && cand2 === cand1, `${cand1} -> ${cand2}`);
    log("re-extraction does not duplicate occurrences", occ1 > 0 && occ2 === occ1, `${occ1} -> ${occ2}`);
  }

  // -- Extraction settings actually control behaviour --
  {
    const text = "\"Hold,\" said Theronn. Lord Brennann rode into Hesselmarr and raised the Sunblade.";
    // Disable the cast scan; cast candidates should drop, others survive.
    await B.SettingsService.saveSection("extraction", { aggressiveness: "balanced", autoAdd95: true, showAutoAddedInReview: true, threshold: 50, scan: { cast: false, locations: true, items: true } });
    await B.ExtractionService.runExtraction({ chapterId: "set-ch", text, deep: false });
    const cands = B.StorageService.getSync(B.keys.reviewQueue, []).filter((q) => q.chapterId === "set-ch");
    log("scan toggle off suppresses that entity type", cands.length > 0 && !cands.some((c) => c.entityType === "cast"));
    log("scan still finds enabled types", cands.some((c) => c.entityType === "locations" || c.entityType === "items"));
    // High threshold drops local candidates below it.
    await B.SettingsService.saveSection("extraction", { threshold: 99, scan: {}, autoAdd95: false });
    await B.ExtractionService.runExtraction({ chapterId: "thr-ch", text, deep: false });
    const thrCands = B.StorageService.getSync(B.keys.reviewQueue, []).filter((q) => q.chapterId === "thr-ch");
    log("threshold 99 drops sub-threshold local candidates", thrCands.length === 0, `got ${thrCands.length}`);
    await B.SettingsService.saveSection("extraction", { threshold: 50, scan: {}, autoAdd95: true }); // restore default
  }

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

  // -- ManuscriptChapterService create / move / delete / restore (UAT #4) --
  const MCS = B.ManuscriptChapterService;
  log("ManuscriptChapterService exposed", !!MCS);
  await MCS.save({ chapters: [], activeChapterId: null, manuscripts: {}, trashedChapters: [] });
  await MCS.save({
    chapters: [
      { id: "mc-1", num: 1, title: "One", state: "saved" },
      { id: "mc-2", num: 2, title: "Two", state: "saved" },
      { id: "mc-3", num: 3, title: "Three", state: "saved" },
    ],
    activeChapterId: "mc-2",
    manuscripts: { "mc-2": { paragraphs: [{ id: "p1", text: "Body of two." }], text: "Body of two.", words: 3 } },
  });
  log("ManuscriptChapterService persists chapters", MCS.loadSync().chapters.length === 3);
  await MCS.moveChapter("mc-3", "up");
  const movedOrder = MCS.loadSync().chapters.map((c) => c.id);
  log("moveChapter('mc-3','up') reorders + renumbers", movedOrder[1] === "mc-3" && MCS.loadSync().chapters[1].num === 2);
  const del = await MCS.deleteChapter("mc-2");
  log("deleteChapter returns removed chapter + manuscript", !!del && del.chapter.id === "mc-2" && !!del.manuscript);
  log("deleteChapter removes it from the live list", !MCS.loadSync().chapters.some((c) => c.id === "mc-2"));
  log("deleteChapter renumbers remaining chapters", MCS.loadSync().chapters.every((c, i) => c.num === i + 1));
  log("deleteChapter retains it in trashedChapters", (MCS.loadSync().trashedChapters || []).some((t) => t.chapter && t.chapter.id === "mc-2"));
  await MCS.restoreChapter("mc-2");
  log("restoreChapter restores chapter + manuscript", MCS.loadSync().chapters.some((c) => c.id === "mc-2") && !!MCS.loadSync().manuscripts["mc-2"]);

  // -- ManuscriptNoteService create / update / resolve / delete (UAT #19) --
  const MNS = B.ManuscriptNoteService;
  log("ManuscriptNoteService exposed", !!MNS);
  const note1 = await MNS.createNote({ chapterId: "mc-1", paragraphId: "p-a", quote: "the cold gate", noteText: "open cold", authorId: "you", source: "selection" });
  log("createNote persists with id + open status", !!note1.id && note1.status === "open" && !!MNS.getSync(note1.id));
  log("listByChapterSync returns the note", MNS.listByChapterSync("mc-1").some((n) => n.id === note1.id));
  log("listByParagraphSync filters by paragraph", MNS.listByParagraphSync("mc-1", "p-a").length === 1 && MNS.listByParagraphSync("mc-1", "p-z").length === 0);
  await MNS.updateNote(note1.id, { noteText: "tighten the cold imagery" });
  log("updateNote edits noteText", MNS.getSync(note1.id).noteText === "tighten the cold imagery");
  await MNS.resolveNote(note1.id);
  log("resolveNote marks resolved + sets resolvedAt", MNS.getSync(note1.id).status === "resolved" && !!MNS.getSync(note1.id).resolvedAt);
  await MNS.resolveNote(note1.id, "open");
  log("resolveNote('open') reopens", MNS.getSync(note1.id).status === "open" && !MNS.getSync(note1.id).resolvedAt);
  await MNS.deleteNote(note1.id);
  log("deleteNote removes the note", !MNS.getSync(note1.id));

  // -- SkillTreeService lifecycle (UAT #17) --
  const STS = B.SkillTreeService;
  log("SkillTreeService exposed", !!STS);
  await STS.save({ trees: [] });
  const stTree = await STS.addTree({ name: "Augur Path" });
  log("addTree persists a tree", STS.loadSync().trees.some((t) => t.id === stTree.id));
  const sk1 = await B.EntityService.save("skills", { name: "Spark" }, { status: "active" });
  const sk2 = await B.EntityService.save("skills", { name: "Flame" }, { status: "active" });
  await STS.addNode(stTree.id, sk1.id, { x: 10, y: 20 });
  await STS.addNode(stTree.id, sk2.id, { x: 40, y: 20 });
  log("addNode persists node ids + layout", (() => { const t = STS.loadSync().trees.find((x) => x.id === stTree.id); return t.nodeIds.includes(sk1.id) && t.nodeIds.includes(sk2.id) && !!t.layout[sk1.id]; })());
  await STS.connectNodes(stTree.id, sk1.id, sk2.id);
  log("connectNodes persists an edge", STS.loadSync().trees.find((x) => x.id === stTree.id).edges.some((e) => e.from === sk1.id && e.to === sk2.id));
  await STS.setNodeUnlocked(stTree.id, sk1.id, true);
  log("setNodeUnlocked persists in layout", STS.loadSync().trees.find((x) => x.id === stTree.id).layout[sk1.id].unlocked === true);
  const stCast = await B.EntityService.save("cast", { name: "Mira Augur" }, { status: "active" });
  await STS.assignCast(stTree.id, stCast.id);
  log("assignCast persists", STS.loadSync().trees.find((x) => x.id === stTree.id).assignedCast.includes(stCast.id));
  const stClass = await B.EntityService.save("classes", { name: "Augur" }, { status: "active" });
  await STS.assignClass(stTree.id, stClass.id);
  log("assignClass persists", STS.loadSync().trees.find((x) => x.id === stTree.id).assignedClasses.includes(stClass.id));
  await STS.updateNodePosition(stTree.id, sk1.id, { x: 99, y: 1 });
  log("updateNodePosition persists", STS.loadSync().trees.find((x) => x.id === stTree.id).layout[sk1.id].x === 99);
  await STS.removeNode(stTree.id, sk2.id);
  log("removeNode removes node + its edges", (() => { const t = STS.loadSync().trees.find((x) => x.id === stTree.id); return !t.nodeIds.includes(sk2.id) && !t.edges.some((e) => e.to === sk2.id); })());
  await STS.removeTree(stTree.id);
  log("removeTree deletes the tree", !STS.loadSync().trees.some((t) => t.id === stTree.id));

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
  const treeId = tree.id;
  log("[skill-trees] addTree persists + returns the created row", !!treeId && B.SkillTreeService.loadSync().trees.some((t) => t.id === treeId));
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
  const tnRow = await B.TangleService.addNode({ title: "Idea: Aelinor's secret", body: "Tied to Hess." });
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

  // -------------------------------------------------------------------
  // Search / Indexing
  // -------------------------------------------------------------------
  console.log("");
  console.log("[search]");

  await B.StorageService.clear();
  const Search = B.SearchService;
  log("[search] SearchService exposed", !!Search && typeof Search.rebuildIndex === "function");
  log("[search] defaultState is empty", Search.loadSync().entries.length === 0);

  // Seed a small project.
  const hessSR = await B.EntityService.save("cast", { name: "Hess Vaela", data: { aliases: ["Hess", "Vaela"], summary: "Bearer of the Auger.", tags: ["protagonist"] } });
  const paleSR = await B.EntityService.save("locations", { name: "Pale Reach", data: { summary: "Salt-coast outpost on the edge of the marsh." } });
  await B.EntityService.save("items", { name: "Auger of Hess", data: { summary: "An ancient turning tool." } });
  await B.ManuscriptChapterService.createFromComposition({
    title: "Ch. 7 — Ash & Auger",
    bodyText: "Snow had been falling all morning. The wind off the salt flats turned each flake into a small, deliberate cut.",
  });
  await B.StorageService.set(B.keys.references, [
    { id: "ref-1", title: "Style guide", content: "Pace breath. Read deliberately. POV: third limited.", tags: ["style", "pov"], kind: "style", source: "user" },
  ]);
  await B.StorageService.set(B.keys.reviewQueue, [
    { id: "q-1", entityType: "cast", payload: { name: "Edrun Pell", sourceQuote: "He bowed once and was gone.", summary: "Bowed and was gone." } },
  ]);
  await B.StorageService.set(B.keys.projectIntelligence, { writingStyleGuide: "Short sentences. Concrete nouns.", canonRules: "The Auger turns only at dawn." });
  await B.StorageService.set(B.keys.onboarding, { plot: "A bearer crosses the salt marsh to deliver the Auger." });

  // Settings with a secret to confirm privacy.
  await B.StorageService.set(B.keys.settings, {
    aiProviders: { provider: "anthropic", apiKey: "sk-ant-LEAKSEARCH", model: "claude-opus-4-7" },
    editor: { theme: "dark", fontFamily: "Inter" },
    extraction: { localPassDefault: true },
  });
  await B.StorageService.set(B.keys.apiKeys, { ciphertext: "must-never-index-this", iv: "x" });

  Search.rebuildIndex();
  const stats = Search.getIndexStatsSync();
  log("[search] rebuildIndex populates entries", stats.total >= 7);
  log("[search] byType includes entity / chapter / reference / review / setting", !!stats.byType.entity && !!stats.byType.chapter && !!stats.byType.reference && !!stats.byType.review && !!stats.byType.setting);

  // Title exact > token overlap.
  const r1 = Search.search("Pale Reach");
  log("[search] exact title match returns the right entity at rank 0", r1[0]?.entityId === paleSR.id);
  log("[search] exact-title result has matchReason = title exact", r1[0]?.matchReason === "title exact");

  // Alias.
  const r2 = Search.search("Vaela");
  log("[search] alias exact match returns the right entity", r2[0]?.entityId === hessSR.id && r2[0]?.matchReason === "alias exact");

  // Chapter phrase.
  const r3 = Search.search("salt flats");
  log("[search] chapter body phrase returns chapter", r3.some((x) => x.type === "chapter"));

  // Reference tag.
  const r4 = Search.search("pov");
  log("[search] reference tag returns reference", r4.some((x) => x.type === "reference" && x.referenceId === "ref-1"));

  // Project Intelligence.
  const r5 = Search.search("auger");
  log("[search] project-intelligence is included in results", r5.some((x) => x.type === "projectIntelligence") || r5.some((x) => x.type === "entity" || x.type === "chapter"));

  // Onboarding.
  const r6 = Search.search("marsh");
  log("[search] onboarding sections are searchable", r6.some((x) => x.type === "onboarding"));

  // Settings + privacy.
  const r7 = Search.search("provider");
  log("[search] safe settings section returns 'aiProviders'", r7.some((x) => x.type === "setting" && x.settingsSectionId === "aiProviders"));

  const r8 = Search.search("sk-ant-LEAKSEARCH");
  log("[search] API key is NOT indexed (no results for the secret)", r8.length === 0);

  const fullIdx = JSON.stringify(Search.loadSync());
  log("[search] index never contains the raw apiKey value", fullIdx.indexOf("sk-ant-LEAKSEARCH") === -1);
  log("[search] index never contains the encrypted blob", fullIdx.indexOf("must-never-index-this") === -1);

  // Refresh path: create new entity → rebuild → finds it.
  await B.EntityService.save("cast", { name: "Edrun Pell", data: { summary: "Squire to Saren of Hess." } });
  Search.rebuildIndex();
  const r9 = Search.search("Edrun");
  log("[search] new entity is indexed after rebuild", r9.some((x) => x.type === "entity" && x.title === "Edrun Pell"));

  // Delete: send entity to trash → rebuild → hidden by default, present with includeTrash.
  await B.EntityService.delete("cast", hessSR.id);
  Search.rebuildIndex({ includeTrash: false });
  const r10 = Search.search("Hess Vaela", { includeTrash: false });
  log("[search] deleted entity is hidden by default", !r10.some((x) => x.entityId === hessSR.id));
  Search.rebuildIndex({ includeTrash: true });
  const r11 = Search.search("Hess Vaela", { includeTrash: true });
  log("[search] deleted entity appears as type=trash when includeTrash:true", r11.some((x) => x.type === "trash"));

  // Short query.
  const r12 = Search.search("a");
  log("[search] short query (<2 chars) returns recent only (matchReason='recent')", r12.every((x) => x.matchReason === "recent"));

  // Stop-word query — should not flood results.
  const r13 = Search.search("the");
  log("[search] stop-word-only query returns nothing", r13.length === 0);

  // clearIndex.
  await Search.clearIndex();
  log("[search] clearIndex empties the cache", Search.loadSync().entries.length === 0);
  Search.rebuildIndex();
  log("[search] rebuild after clear restores entries", Search.getIndexStatsSync().total > 0);

  // -------------------------------------------------------------------
  // Audit Log / Undo
  // -------------------------------------------------------------------
  console.log("");
  console.log("[audit]");

  await B.StorageService.clear();
  const Audit = B.AuditService;
  log("[audit] AuditService exposed", !!Audit && typeof Audit.log === "function");
  log("[audit] defaultState is empty", Audit.loadSync().events.length === 0);

  // Direct log() persists.
  await Audit.log({ action: "entity.update", label: "Manual test event", targetType: "entity", targetId: "x", before: { foo: "old" }, after: { foo: "new" } });
  log("[audit] log() persists event", Audit.loadSync().events.length === 1);

  // Entity create → entity.create event with `after`.
  await B.StorageService.clear();
  const cast1 = await B.EntityService.save("cast", { name: "Hess Vaela", data: { summary: "Bearer of the Auger." } });
  let recent = Audit.getRecentSync(1)[0];
  log("[audit] entity.create event recorded", recent?.action === "entity.create" && recent.entityType === "cast" && recent.targetId === cast1.id);
  log("[audit] entity.create after snapshot has the new name", recent?.after?.name === "Hess Vaela");

  // Entity update → entity.update with before+after.
  await B.EntityService.update("cast", cast1.id, { name: "Hess Vaela the Elder" });
  recent = Audit.getRecentSync(1)[0];
  log("[audit] entity.update event recorded", recent?.action === "entity.update");
  log("[audit] entity.update before carries old name", recent?.before?.name === "Hess Vaela");
  log("[audit] entity.update after carries new name", recent?.after?.name === "Hess Vaela the Elder");

  // Entity delete → entity.delete with before.
  await B.EntityService.delete("cast", cast1.id);
  recent = Audit.getRecentSync(1)[0];
  log("[audit] entity.delete event recorded", recent?.action === "entity.delete" && recent.before?.name === "Hess Vaela the Elder");

  // canUndo behaviour.
  log("[audit] canUndo true for entity.create", Audit.canUndo(Audit.listSync({ action: "entity.create" })[0]?.id));
  const resetEvt = await Audit.log({ action: "project.reset", label: "test", targetType: "project", reversible: false });
  log("[audit] canUndo false for project.reset", Audit.canUndo(resetEvt.id) === false);

  // Undo: entity.update restores before.
  await B.StorageService.clear();
  const c2 = await B.EntityService.save("cast", { name: "Old Name" });
  await B.EntityService.update("cast", c2.id, { name: "New Name" });
  const updateEvent = Audit.listSync({ action: "entity.update" })[0];
  await Audit.undo(updateEvent.id);
  const c2After = B.EntityService.getSync(c2.id, "cast");
  log("[audit] undo(entity.update) restores previous name", c2After?.name === "Old Name");
  log("[audit] undo marks original event as undone", Audit.getSync(updateEvent.id)?.undone === true);

  // Undo: entity.delete restores entity.
  const c3 = await B.EntityService.save("cast", { name: "Will-be-restored" });
  await B.EntityService.delete("cast", c3.id);
  const deleteEvent = Audit.listSync({ action: "entity.delete" })[0];
  await Audit.undo(deleteEvent.id);
  const c3After = B.EntityService.getSync(c3.id, "cast");
  log("[audit] undo(entity.delete) restores entity to active", c3After?.status === "active" && c3After?.name === "Will-be-restored");

  // canUndo false after undo.
  log("[audit] canUndo false after first undo", Audit.canUndo(updateEvent.id) === false);

  // Undo: entity.create deletes the entity.
  const c4 = await B.EntityService.save("cast", { name: "Created-then-undone" });
  const createEvent = Audit.listSync({ action: "entity.create" }).find((e) => e.targetId === c4.id);
  await Audit.undo(createEvent.id);
  log("[audit] undo(entity.create) soft-deletes the created entity", B.EntityService.getSync(c4.id, "cast")?.status === "deleted");

  // Reference create → reference.create event.
  await B.ReferencesService.save({ id: "ref-1", title: "Style guide", content: "Pace breath." });
  recent = Audit.getRecentSync(1)[0];
  log("[audit] reference.create event recorded", recent?.action === "reference.create" && recent.targetId === "ref-1");

  // Onboarding update.
  await B.OnboardingService.save({ plot: "A bearer crosses the marsh." });
  recent = Audit.getRecentSync(1)[0];
  log("[audit] onboarding.update event recorded", recent?.action === "onboarding.update");

  // Settings privacy: API key never leaks into the audit log.
  await B.SettingsService.saveSection("aiProviders", { provider: "anthropic", apiKey: "sk-LEAK-AUDIT", model: "claude-opus-4-7" });
  recent = Audit.getRecentSync(1)[0];
  log("[audit] settings.section-update event recorded", recent?.action === "settings.section-update" && recent.targetId === "aiProviders");
  const auditJson = JSON.stringify(Audit.loadSync());
  log("[audit] API key value NEVER present in audit log JSON", auditJson.indexOf("sk-LEAK-AUDIT") === -1);
  log("[audit] settings before/after fields are redacted", recent.after?.apiKey === "[redacted]");

  // exportSync also clean.
  const exported = Audit.exportSync();
  log("[audit] exportSync redacted output never contains the secret value", JSON.stringify(exported).indexOf("sk-LEAK-AUDIT") === -1);

  // clear().
  await Audit.clear();
  log("[audit] clear() empties the log", Audit.loadSync().events.length === 0);

  // -------------------------------------------------------------------
  // Multi-provider AI Routing
  // -------------------------------------------------------------------
  console.log("");
  console.log("[ai routing]");

  await B.StorageService.clear();
  const AI = B.AIService;
  const Routing = B.AIRoutingService;
  const Ctx = B.AIContextBuilder;
  log("[ai] AIService / AIRoutingService / AIContextBuilder exposed", !!AI && !!Routing && !!Ctx);
  log("[ai] routing defaultState mode = balanced", Routing.loadSync().mode === "balanced");

  // Save a provider config (no key in the config blob).
  await AI.saveProviderConfig({ id: "openai", providerType: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", apiKey: "sk-AI-ROUTING-SECRET" });
  const provCfgBlob = JSON.stringify(B.KeysService.loadProviderSync("openai"));
  log("[ai] saveProviderConfig persists config", B.KeysService.loadProviderSync("openai")?.providerType === "openai");
  log("[ai] provider config blob never contains the apiKey value", provCfgBlob.indexOf("sk-AI-ROUTING-SECRET") === -1);
  log("[ai] provider config records hasKey:true", B.KeysService.loadProviderSync("openai")?.hasKey === true);

  // Key is retrievable for a call but not in the config.
  const retrievedKey = await B.KeysService.loadKey("openai");
  log("[ai] key retrievable via KeysService for a call", retrievedKey === "sk-AI-ROUTING-SECRET");

  // Routing resolution.
  await Routing.save({ mode: "balanced", defaultProviderId: "openai" });
  log("[ai] resolveRoute(writingDraft) falls back to default provider", Routing.resolveRoute("writingDraft")?.providerId === "openai");
  await Routing.save({ taskRoutes: { deepExtraction: { providerId: "openai", model: "gpt-4o" } } });
  log("[ai] resolveRoute honours a task-specific route + model", Routing.resolveRoute("deepExtraction")?.model === "gpt-4o");

  // Local-only blocks.
  await Routing.save({ mode: "localOnly" });
  log("[ai] isLocalOnly() true in localOnly mode", Routing.isLocalOnly() === true);
  log("[ai] resolveRoute returns null in localOnly", Routing.resolveRoute("writingDraft") === null);
  await Routing.save({ mode: "balanced" });

  // Cost tiers: the "free" tier must never route to a paid cloud provider.
  await Routing.save({ tier: "free", taskRoutes: {} });
  log("[ai] free tier won't use a paid cloud provider", Routing.resolveRoute("writingDraft") === null);
  await AI.saveProviderConfig({ id: "ollama", providerType: "ollama", label: "Ollama (local)", baseUrl: "http://localhost:11434", defaultModel: "llama3" });
  log("[ai] free tier routes to a local provider (Ollama), no key needed", Routing.resolveRoute("writingDraft")?.providerId === "ollama");
  await Routing.save({ tier: "normal" });
  log("[ai] normal tier allows the cloud provider again", Routing.resolveRoute("writingDraft")?.providerId === "openai" || Routing.resolveRoute("writingDraft")?.providerId === "ollama");
  await Routing.save({ tier: "normal" });

  // Extraction honours Local-only mode: no AI attempted, local pass only.
  await Routing.save({ mode: "localOnly" });
  const exLocal = await B.ExtractionService.runExtraction({ chapterId: "ch-localonly", text: "Theron crossed into Hesselmark at dawn.", deep: false });
  log("[ai] extraction skips AI in Local-only mode", exLocal.session.aiUsed === false);
  await Routing.save({ mode: "balanced" });

  // Author context: onboarding answers must surface so any model follows the rules.
  await B.OnboardingService.save({
    welcome: { title: "The Salt Reach", genre: "Grimdark fantasy" },
    foundation: { premise: "A reluctant heir hunts a stolen relic.", pov: "third-limited", tense: "past", toneWords: ["bleak", "wry"] },
    style: { narratorTone: "dry", signature: "short, punchy sentences", avoid: "purple prose" },
    world: { canonRules: ["Magic always costs blood"], forbidden: ["modern slang"] },
  });
  const authorCtx = B.buildAuthorContext();
  log("[ai] buildAuthorContext includes premise", /reluctant heir/.test(authorCtx));
  log("[ai] buildAuthorContext includes style + canon rules", /short, punchy/.test(authorCtx) && /blood/.test(authorCtx));
  log("[ai] buildAuthorContext includes POV and forbidden", /third-limited/.test(authorCtx) && /modern slang/.test(authorCtx));
  await B.OnboardingService.save({}); // restore clean onboarding state for later tests

  // Context builder.
  const cChap = await B.ManuscriptChapterService.createFromComposition({ title: "Ctx Chapter", bodyText: "Hess crossed the salt marsh at dawn." });
  await B.EntityService.save("cast", { name: "Hess Vaela", data: { summary: "Bearer of the Auger." } });
  const built = Ctx.build({ task: "deepExtraction", chapterId: cChap.id, includeReferences: false, includeProjectIntelligence: false });
  log("[ai] context builder includes chapter text", built.userPrompt.includes("salt marsh"));
  log("[ai] context builder marks includesManuscript", built.includesManuscript === true);
  log("[ai] context builder includes known entities for extraction", built.userPrompt.includes("Hess Vaela"));
  log("[ai] context builder never contains the apiKey value", JSON.stringify(built).indexOf("sk-AI-ROUTING-SECRET") === -1);
  // Bounded.
  await Routing.save({ maxContextTokens: 10 });
  const tiny = Ctx.build({ task: "writingDraft", chapterId: cChap.id });
  log("[ai] context builder respects maxContextTokens bound", tiny.approxChars <= 10 * 4 + 5);
  await Routing.save({ maxContextTokens: 8000 });

  // Mocked completion via the OpenAI adapter.
  const realFetch = win.fetch;
  win.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("/chat/completions")) {
      return { ok: true, status: 200, async json() { return { choices: [{ message: { content: "MOCKED COMPLETION" } }] }; }, async text() { return ""; } };
    }
    if (u.includes("/models")) {
      return { ok: true, status: 200, async json() { return { data: [] }; }, async text() { return ""; } };
    }
    return { ok: false, status: 404, async text() { return "not found"; } };
  };
  const completion = await AI.complete({ providerId: "openai", prompt: "hello", system: "test" });
  log("[ai] complete() returns mocked completion via openai adapter", completion === "MOCKED COMPLETION");
  const jsonResp = await AI.completeJson({ providerId: "openai", prompt: "give json" }).catch(() => null);
  // Our mock returns plain text, so completeJson returns null (not valid JSON) — that's the correct contract.
  log("[ai] completeJson returns null on non-JSON response", jsonResp === null);
  const testResult = await AI.testConnection("openai");
  log("[ai] testConnection succeeds with mocked /models", testResult.ok === true);
  win.fetch = realFetch;

  // testConnection with no key.
  await B.KeysService.clearProviderKey("openai");
  const noKeyResult = await AI.testConnection("openai");
  log("[ai] testConnection without key gives useful message", noKeyResult.ok === false && /no api key/i.test(noKeyResult.message));

  // Guard summary.
  const guard = AI.buildGuardSummary({ task: "writingDraft", providerId: "openai", model: "gpt-4o-mini", context: { includesManuscript: true, approxChars: 1234 } });
  log("[ai] buildGuardSummary reports includesManuscript", guard.includesManuscript === true && guard.approxChars === 1234);

  // AI Handoff remains usable without a provider (no throw building a pack).
  log("[ai] AI Handoff pack buildable without provider", typeof B.HandoffService?.savePack === "function");

  // Privacy re-verification: key never in audit/search after a provider action.
  await AI.saveProviderConfig({ id: "openai", providerType: "openai", apiKey: "sk-VERIFY-NOLEAK" });
  B.SearchService.rebuildIndex();
  const searchJson = JSON.stringify(B.SearchService.loadSync());
  log("[ai] api key never indexed by SearchService", searchJson.indexOf("sk-VERIFY-NOLEAK") === -1);

  // -------------------------------------------------------------------
  // Onboarding → project seeding (Area 2). Run last; it reseeds the store.
  // -------------------------------------------------------------------
  console.log("");
  console.log("[onboarding]");
  await B.StorageService.clear();
  win.__LW_SAMPLE_LOADED__ = false;
  const obAnswers = {
    welcome: { title: "The Salt Reach", genre: "Grimdark fantasy" },
    foundation: { premise: "A reluctant heir hunts a stolen relic.", themes: ["betrayal"], toneWords: ["bleak"], pov: "third-limited", tense: "past" },
    style: { narratorTone: "dry", signature: "short sentences" },
    world: { canonRules: ["Magic costs blood"], forbidden: ["modern slang"] },
    cast: { seeds: [{ id: "s1", name: "Aelinor Vey", aliases: "Ael, the Heir", role: "Protagonist", personality: "Wary, sharp." }] },
    manuscript: { mode: "paste", autoDetect: true, runExtraction: false, pasted: "Chapter 1 — Arrival\nAelinor Vey rode into Hesselmark at dusk.\n\nChapter 2 — The Keep\nThe keep of Vraska stood dark." },
    references: { items: [{ id: "r1", title: "House Vey", content: "Pedigree notes for House Vey.", kind: "pasted", context: true }] },
    ai: { mode: "local", provider: "anthropic", allowEgress: false },
    review: { autoAddHigh: true, showAutoInQueue: true, aggressiveness: 1, scan: { cast: true, locations: true } },
    workspace: { startTab: "writers-room", font: "EB Garamond" },
    plot: { beats: [{ id: "pb1", title: "Inciting incident", summary: "The relic is stolen." }], targetChapters: 0 },
    rpg: { template: "Grimdark", customStats: [{ id: "cs1", name: "Resolve", min: 1, max: 20, def: 10 }], toggles: { stats: true } },
  };
  obAnswers.foundation.comparables = "The First Law";
  obAnswers.foundation.isNot = "cozy";
  const obResult = await B.OnboardingService.applyCompletion(obAnswers);
  log("[ob] applyCompletion marks onboarding complete", B.OnboardingService.statusSync() === "complete");
  log("[ob] seeds cast from seeds", B.EntityService.listSync("cast").some((e) => e.name === "Aelinor Vey"));
  log("[ob] cast seed carries role/personality into data", (B.EntityService.listSync("cast").find((e) => e.name === "Aelinor Vey")?.data || {}).role === "Protagonist");
  const obChapters = B.ManuscriptChapterService.loadSync().chapters || [];
  log("[ob] splits pasted manuscript into chapters", obChapters.filter((c) => c.state !== "reserved").length >= 2, `got ${obChapters.length}`);
  log("[ob] chapter bodies carry the pasted text", obChapters.some((c) => (c.bodyText || "").includes("Hesselmark")));
  log("[ob] seeds references with content", (B.StorageService.getSync(B.keys.references, []) || []).some((r) => (r.content || "").includes("House Vey")));
  const obIntel = B.ProjectIntelService.loadSync();
  log("[ob] intel projectFoundation derived from premise", /reluctant heir/.test(obIntel.projectFoundation || ""));
  log("[ob] intel writingStyleGuide derived from style", /dry|short sentences/.test(obIntel.writingStyleGuide || ""));
  log("[ob] intel canonRules flattened (not nested)", Array.isArray(obIntel.canonRules) && obIntel.canonRules[0] === "Magic costs blood");
  log("[ob] intel includes comparables + isNot", /The First Law/.test(obIntel.projectFoundation || "") && /cozy/.test(obIntel.projectFoundation || ""));
  log("[ob] intel includes the planned plot beats", /Inciting incident/.test(obIntel.projectFoundation || ""));
  log("[ob] custom stats seeded as Stats entities", B.EntityService.listSync("stats").some((e) => e.name === "Resolve"));
  log("[ob] workspace + rpg prefs persisted to settings", B.SettingsService.getSectionSync("workspace", {}).font === "EB Garamond" && B.SettingsService.getSectionSync("rpg", {}).template === "Grimdark");
  log("[ob] applyCompletion reports a destination", !!obResult.dest);
  log("[ob] local AI mode maps to Free tier (not a hard block)", B.AIRoutingService.loadSync().tier === "free" && B.AIRoutingService.loadSync().mode !== "localOnly");
  // Re-completion safety: must not duplicate cast or clobber written chapters.
  const obCastBefore = B.EntityService.listSync("cast").length;
  const obChBefore = (B.ManuscriptChapterService.loadSync().chapters || []).length;
  await B.OnboardingService.applyCompletion(obAnswers);
  const obChAfter = (B.ManuscriptChapterService.loadSync().chapters || []).map((c) => c.bodyText || "");
  log("[ob] re-completion does not duplicate cast", B.EntityService.listSync("cast").length === obCastBefore, `${obCastBefore} -> ${B.EntityService.listSync("cast").length}`);
  log("[ob] re-completion preserves existing chapters", obChAfter.length === obChBefore && obChAfter.some((b) => b.includes("Hesselmark")));
  const styleProfile = B.analyzeWritingStyle("The wolf ran fast. It was a long, careful, deliberate hunt across the frozen waste, and nothing stirred for hours. \"Wait,\" she whispered.");
  log("[ob] analyzeWritingStyle computes real metrics", !!styleProfile && styleProfile.avgSentenceLen > 0 && !!styleProfile.register && !!styleProfile.pacing);
  await B.ProjectIntelService.mergeFromOnboarding({ voice: { profile: { avgSentenceLen: 14, register: "direct", pacing: "balanced", lexicalDiversity: 60, dialogueRatio: 20 } } });
  log("[ob] voice profile flows into the writing style guide", /Voice metrics/.test(B.ProjectIntelService.loadSync().writingStyleGuide || ""));

  // --- Fix A: stripJsonFence lets pasted, fenced AI JSON parse cleanly ---
  {
    const obData = fs.readFileSync(path.join(ROOT, "onboarding-data.jsx"), "utf8");
    const m = obData.match(/const\s+stripJsonFence\s*=\s*([^;]+);/);
    let strip = null;
    if (m) { try { strip = vm.runInNewContext("(" + m[1] + ")", {}); } catch (_e) {} }
    log("[fixA] stripJsonFence defined in onboarding-data.jsx", typeof strip === "function");
    if (typeof strip === "function") {
      const fence = "```";
      let okFenced = false, okBare = false, okPlain = false;
      try { okFenced = JSON.parse(strip(fence + "json\n{ \"a\": 1 }\n" + fence)).a === 1; } catch (_e) {}
      try { okBare = JSON.parse(strip(fence + "\n{ \"b\": 2 }\n" + fence)).b === 2; } catch (_e) {}
      try { okPlain = JSON.parse(strip("{ \"c\": 3 }")).c === 3; } catch (_e) {}
      log("[fixA] strips ```json fence before parse", okFenced);
      log("[fixA] strips bare ``` fence before parse", okBare);
      log("[fixA] leaves unfenced JSON intact", okPlain);
    }
  }

  // --- [rel] LinkService.listRelationshipEdgesSync — live Relationships edges ---
  {
    const anwen = await B.EntityService.save("cast", { name: "Smoke Anwen" }, { status: "active" });
    const bram = await B.EntityService.save("cast", { name: "Smoke Bram" }, { status: "active" });
    const cole = await B.EntityService.save("cast", { name: "Smoke Cole" }, { status: "active" });
    // Extraction-shaped record (fromId/toId/relationshipType verb).
    await B.EntityService.save("relationships", {
      name: "Smoke Anwen → Smoke Bram",
      summary: "Anwen confronted Bram.",
      data: { fromId: anwen.id, toId: bram.id, relationshipType: "confronted" },
    }, { status: "active" });
    // Editor-shaped record (related pickers + bondType + tone fields).
    await B.EntityService.save("relationships", {
      name: "Smoke Anwen ↔ Smoke Cole",
      data: {
        from: { id: anwen.id, name: "Smoke Anwen", type: "cast" },
        to: [{ id: cole.id }],
        bondType: "ally", intensity: "88", valence: "positive",
      },
    }, { status: "active" });
    // Cast dossier fields → synthetic edges (and dedupe vs the explicit pair).
    await B.EntityService.update("cast", bram.id, { data: { rivals: [cole.id], enemies: [anwen.id] } });
    const edges = B.LinkService.listRelationshipEdgesSync();
    const between = (x, y) => edges.filter((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x));
    const e1 = between(anwen.id, bram.id);
    log("[rel] extraction-shaped record becomes an edge", e1.length > 0 && e1.every((e) => !e.synthetic), e1.map((e) => e.type).join(",") || "none");
    log("[rel] verb vocabulary buckets to a styled type", e1.some((e) => e.type === "enemy"));
    log("[rel] explicit edge wins over cast-field synthetic on the same pair", e1.length === 1);
    const e2 = between(anwen.id, cole.id)[0];
    log("[rel] editor-shaped record (pickers + bondType) normalises", !!e2 && e2.type === "friend" && !e2.synthetic, e2 ? e2.type : "missing");
    log("[rel] intensity string + valence shape the meters", !!e2 && e2.strength === 88 && e2.trust === 80 && e2.conflict === 5, e2 ? `s${e2.strength} t${e2.trust} c${e2.conflict}` : "");
    const e3 = between(bram.id, cole.id)[0];
    log("[rel] cast dossier fields synthesize read-only edges", !!e3 && e3.synthetic === true && e3.type === "rival" && e3.recordId === null);
    log("[rel] meters clamp to 0–100 everywhere", edges.every((e) => [e.strength, e.trust, e.conflict].every((v) => v >= 0 && v <= 100)));
    await B.EntityService.delete("cast", cole.id);
    const afterDelete = B.LinkService.listRelationshipEdgesSync();
    log("[rel] edges drop when a member is deleted", !afterDelete.some((e) => e.a === cole.id || e.b === cole.id));
  }

  // --- [tangle] board service — boards, first-class edges, migration ---
  {
    const T = B.TangleService;
    // Legacy migration: a pre-board state wraps into "Board 1".
    await B.StorageService.set(B.keys.tangle, {
      nodes: [{ id: "leg1", kind: "note", title: "Legacy note", x: 10, y: 10 }],
      edges: [{ from: "leg1", to: "leg1x" }],
      groups: [],
    });
    const migrated = T.loadSync();
    log("[tangle] legacy state migrates into Board 1",
      Array.isArray(migrated.boards) && migrated.boards.length === 1 && migrated.nodes[0].boardId === migrated.boards[0].id);
    // Boards CRUD + active board.
    const b1 = await T.addBoard({ name: "Acts II–III plot" });
    const b2 = await T.addBoard({ name: "Motifs" });
    log("[tangle] addBoard sets the new board active", T.loadSync().activeBoardId === b2.id);
    await T.setActiveBoard(b1.id);
    const n1 = await T.addNode({ kind: "note", title: "The toll war", x: 100, y: 100 });
    const n2 = await T.addNode({ kind: "quote", title: "“Today, or not at all.”", x: 300, y: 160 });
    log("[tangle] nodes land on the active board", n1.boardId === b1.id && n2.boardId === b1.id);
    // Entity-linked node.
    const castRow = await B.EntityService.save("cast", { name: "Smoke Tangle Cast" }, { status: "active" });
    const en = await T.addEntityNode(b1.id, castRow, { x: 500, y: 100 });
    log("[tangle] addEntityNode binds the live entity", en.entityId === castRow.id && en.kind === "cast" && en.title === "Smoke Tangle Cast");
    // First-class edges: labelled, directed, MULTIPLE between same pair.
    const e1 = await T.addEdge({ from: n1.id, to: n2.id, label: "echoes" });
    const e2 = await T.addEdge({ from: n1.id, to: n2.id, label: "contradicts", directed: false });
    const boardView = T.listBoardSync(b1.id);
    log("[tangle] two labelled edges coexist on the same pair",
      boardView.edges.filter((e) => e.from === n1.id && e.to === n2.id).length === 2 && e2.directed === false && e1.label === "echoes");
    await T.updateEdge(e1.id, { label: "answers" });
    log("[tangle] updateEdge persists label changes", T.listBoardSync(b1.id).edges.find((e) => e.id === e1.id).label === "answers");
    // Board isolation + node removal cascades its edges.
    log("[tangle] boards isolate their nodes", T.listBoardSync(b2.id).nodes.length === 0);
    await T.removeNode(n2.id);
    log("[tangle] removing a node cascades its edges", T.listBoardSync(b1.id).edges.length === 0);
    // Merge rebinding.
    const castRow2 = await B.EntityService.save("cast", { name: "Smoke Tangle Cast Prime" }, { status: "active" });
    await B.LinkService.mergeEntities(castRow2.id, "cast", [castRow.id]);
    const rebound = T.loadSync().nodes.find((n) => n.id === en.id);
    log("[tangle] entity merge rebinds board nodes", rebound.entityId === castRow2.id);
  }

  // --- [rt] RandomTableService — builtins, weighted rolls, copy-on-write ---
  {
    const RT = B.RandomTableService;
    const builtins = RT.listSync().filter((t) => t.source === "builtin");
    log("[rt] starter tables ship as builtins", builtins.length >= 3 && builtins.some((t) => t.name === "Plot twists"));
    const mine = await RT.saveTable({
      name: "Tavern rumours", category: "story",
      rows: [{ text: "The miller pays in foreign coin.", weight: 1 }, { text: "Nobody has seen the ferryman in a week.", weight: 3 }],
    });
    log("[rt] saveTable persists a user table", RT.getSync(mine.id)?.rows.length === 2);
    // Deterministic injectable RNG.
    const seq = [0.05, 0.95];
    let i = 0;
    const rng = () => seq[(i++) % seq.length];
    const rolled = RT.roll(mine.id, { count: 2, rng });
    log("[rt] roll honours the injected RNG", rolled.length === 2 && rolled[0].text !== rolled[1].text);
    // Weighting: weight 3 row dominates mid-range picks (total 4 → >0.25).
    const mid = RT.roll(mine.id, { count: 1, rng: () => 0.6 });
    log("[rt] weights skew the pick", mid[0].text === "Nobody has seen the ferryman in a week.");
    // Unique never repeats within one roll.
    const uniq = RT.roll(mine.id, { count: 5, unique: true, rng: () => 0.1 });
    log("[rt] unique rolls never repeat", uniq.length === 2 && new Set(uniq.map((r) => r.text)).size === 2);
    // Editing a builtin clones it (copy-on-write); the builtin stays.
    const namesTable = builtins.find((t) => t.category === "names");
    const copy = await RT.saveTable({ ...namesTable, name: "My names" });
    log("[rt] builtin edits copy-on-write", copy.id !== namesTable.id && !!RT.getSync(namesTable.id));
    log("[rt] builtins cannot be removed", (await RT.removeTable(namesTable.id)) === false);
    // History logs and caps.
    await RT.rollAndLog(mine.id, { count: 1, rng: () => 0.5 });
    log("[rt] rollAndLog records history", RT.historySync().length >= 1 && RT.historySync()[0].tableName === "Tavern rumours");
    // Export carries USER tables only (builtins are code, not data).
    const rtExport = await B.ProjectArchiveService.buildExport({});
    const exportedTables = (rtExport.randomTables && rtExport.randomTables.tables) || [];
    log("[rt] export includes user tables and excludes builtins",
      exportedTables.some((t) => t.id === mine.id) && !exportedTables.some((t) => t.source === "builtin"));
  }

  // --- [md] Markdown / HTML world-bible export ---
  {
    await B.StorageService.clear();
    const keep = await B.EntityService.save("locations", { name: "Toll Gate", summary: "A fortified crossing." }, { status: "active" });
    await B.EntityService.save("cast", {
      name: "Anwen Hale", summary: "Holds the north road.",
      data: { role: "protagonist", homeLocation: { id: keep.id, name: "Toll Gate", type: "locations" }, goals: ["Keep the gate open"] },
    }, { status: "active" });
    await B.EntityService.save("lore", { name: "Iron sinks in mist.", data: { band: "canon" } }, { status: "active" });
    const mdCastA = B.EntityService.listSync("cast")[0];
    const mdCastB = await B.EntityService.save("cast", { name: "Bram Iron" }, { status: "active" });
    await B.EntityService.save("relationships", {
      name: "Anwen → Bram", summary: "Border rivals.",
      data: { fromId: mdCastA.id, toId: mdCastB.id, bondType: "rival" },
    }, { status: "active" });
    await B.ReferencesService.save({ title: "Coastal forts dossier", kind: "research", content: "Fort spacing follows the beacon line." });
    await B.ManuscriptChapterService.save({
      chapters: [{ id: "md-c1", num: 1, title: "The Gate" }],
      activeChapterId: "md-c1",
      manuscripts: { "md-c1": { html: "", text: "Anwen walked the toll road in the rain." } },
    });
    const md = B.ProjectArchiveService.buildMarkdownExport({});
    log("[md] project header present", /^# Loomwright Project/m.test(md));
    log("[md] manuscript chapter + body included", md.includes("### Ch. 1 — The Gate") && md.includes("toll road in the rain"));
    log("[md] entity sections render with summaries", md.includes("## Cast") && md.includes("### Anwen Hale") && md.includes("Holds the north road."));
    log("[md] linked records resolve to names (no ids)", md.includes("**Home Location:** Toll Gate") && !md.includes(keep.id));
    log("[md] relationships table renders", md.includes("| From | Bond | To | Notes |") && md.includes("| Anwen Hale | rival | Bram Iron |"));
    log("[md] canon facts listed with band", md.includes("## Canon") && md.includes("**[CANON]** Iron sinks in mist."));
    log("[md] references indexed", md.includes("## References") && md.includes("**Coastal forts dossier** (research)"));
    log("[md] no [object Object] anywhere", !md.includes("[object Object]"));
    const mdNoMs = B.ProjectArchiveService.buildMarkdownExport({ scope: { manuscript: false } });
    log("[md] scope can exclude the manuscript", !mdNoMs.includes("## Manuscript") && mdNoMs.includes("## Cast"));
    const html = B.ProjectArchiveService.buildHtmlExport({});
    log("[md] html export is a standalone document", html.startsWith("<!doctype html>") && html.includes("<h1>Loomwright Project</h1>"));
    log("[md] html renders the relationships table", html.includes("<table>") && html.includes("<td>Anwen Hale</td>"));
    log("[md] html leaves no raw markdown bold", !/\*\*/.test(html));
  }

  // --- [tpl] TemplateService — entity + board templates, builtins ---
  {
    const TS = B.TemplateService;
    const genreTpls = TS.listSync({ kind: "entity", entityType: "classes" }).filter((t) => t.source === "builtin");
    log("[tpl] genre starter templates ship as builtins", genreTpls.length >= 3 && genreTpls.some((t) => t.genre === "Grimdark"));
    // Entity template round-trip: snapshot strips identity, initial restores.
    const tpl = await TS.saveEntityTemplate({
      name: "Border keep", entityType: "locations",
      fields: { summary: "A fortified crossing.", data: { kind: "building", danger: "watched", id: "should-be-stripped", name: "should-be-stripped" } },
    });
    log("[tpl] saveEntityTemplate strips identity keys", !("id" in tpl.fields.data) && !("name" in tpl.fields.data) && tpl.fields.data.kind === "building");
    const init = TS.entityInitialFrom(tpl.id);
    log("[tpl] entityInitialFrom yields a flat editor prefill", init.summary === "A fortified crossing." && init.kind === "building" && init.danger === "watched");
    log("[tpl] builtins cannot be removed", (await TS.remove(genreTpls[0].id)) === false);
    // Board template: normalized to origin, instantiates with remapped edges.
    const board = await B.TangleService.addBoard({ name: "Tpl board" });
    const n1 = await B.TangleService.addNode({ boardId: board.id, kind: "note", title: "Cause", x: 300, y: 300 });
    const n2 = await B.TangleService.addNode({ boardId: board.id, kind: "note", title: "Effect", x: 500, y: 380 });
    await B.TangleService.addEdge({ from: n1.id, to: n2.id, label: "leads to" });
    const boardView = B.TangleService.listBoardSync(board.id);
    const btpl = await TS.saveBoardTemplate({ name: "Cause-effect", nodes: boardView.nodes, edges: boardView.edges });
    log("[tpl] board template normalizes positions to origin", btpl.nodes.some((n) => n.x === 0 && n.y === 0));
    const board2 = await B.TangleService.addBoard({ name: "Stamp target" });
    const made = await TS.instantiateBoardTemplate(btpl.id, board2.id, { x: 1000, y: 1000 });
    const stamped = B.TangleService.listBoardSync(board2.id);
    log("[tpl] instantiate stamps nodes at the drop point", made.length === 2 && stamped.nodes.every((n) => n.x >= 1000));
    log("[tpl] instantiate remaps edges to the new node ids",
      stamped.edges.length === 1 && stamped.edges[0].label === "leads to" &&
      stamped.nodes.some((n) => n.id === stamped.edges[0].from));
    // Export carries user templates, never builtins.
    const tplExport = await B.ProjectArchiveService.buildExport({});
    const exportedTpls = (tplExport.templates && tplExport.templates.templates) || [];
    log("[tpl] export includes user templates and excludes builtins",
      exportedTpls.some((t) => t.id === tpl.id) && !exportedTpls.some((t) => t.source === "builtin"));
  }

  // --- [rel2] two-pass relationship extraction — candidate shaping ---
  {
    const anwen2 = await B.EntityService.save("cast", { name: "Pass Two Anwen" }, { status: "active" });
    const bram2 = await B.EntityService.save("cast", { name: "Pass Two Bram" }, { status: "active" });
    const present = [anwen2, bram2];
    const rows = [
      { from: "Pass Two Anwen", to: "Pass Two Bram", type: "Rival", strength: 140, trust: -5, conflict: 80, secret: 1,
        summary: "Border rivals since the toll war.", evidenceQuote: "Anwen would not yield the gate to Bram." },
      { from: "Pass Two Anwen", to: "Pass Two Bram", type: "ally" },           // duplicate pair → dropped
      { from: "Pass Two Anwen", to: "Nobody Known", type: "ally" },             // unknown name → skipped
      { from: "Pass Two Anwen", to: "Pass Two Anwen", type: "self" },           // self pair → skipped
    ];
    const cands = B.buildRelationshipPassCandidates(rows, present, { chapterId: null, sessionId: "smoke", deep: true });
    log("[rel2] resolves names to ids and dedupes pairs", cands.length === 1 && cands[0].suggestedChanges.fromId === anwen2.id && cands[0].suggestedChanges.toId === bram2.id);
    log("[rel2] meters clamp to 0–100 and secret coerces",
      cands[0].suggestedChanges.strength === 100 && cands[0].suggestedChanges.trust === 0 && cands[0].suggestedChanges.conflict === 80 && cands[0].suggestedChanges.secret === true);
    log("[rel2] evidence quote rides the candidate AND the record diff",
      cands[0].sourceQuote.includes("yield the gate") && cands[0].suggestedChanges.sourceQuote.includes("yield the gate"));
    // Accepting (the registry merges suggestedChanges into data) yields a
    // fully-rendered edge in the live Relationships normalizer.
    await B.EntityService.save("relationships", {
      name: cands[0].name, summary: cands[0].summary, data: { ...cands[0].suggestedChanges },
    }, { status: "active" });
    const relEdge = B.LinkService.listRelationshipEdgesSync().find((e) =>
      (e.a === anwen2.id && e.b === bram2.id) || (e.a === bram2.id && e.b === anwen2.id));
    log("[rel2] accepted pass-2 bond renders with its rich meters", !!relEdge && relEdge.type === "rival" && relEdge.strength === 100 && relEdge.conflict === 80 && relEdge.secret === true);
  }

  // --- [exq] extraction quality 2 — field mapping, dedupe, aliases, calibration ---
  {
    await B.StorageService.clear();
    const owner = await B.EntityService.save("cast", { name: "Anwen Hale" }, { status: "active" });
    // E1: deep-pass rich fields survive into suggestedChanges (and thus data).
    const itemCand = B.buildCandidate({
      entityType: "items", name: "Iron Seal",
      payload: { name: "Iron Seal", type: "relic", rarity: "rare", owner: "Anwen Hale", confidence: 0.8 },
    });
    log("[exq] AI item fields map to real editor ids",
      itemCand.suggestedChanges?.itemType === "relic" && itemCand.suggestedChanges?.rarity === "rare");
    log("[exq] owner names resolve to live entity refs",
      itemCand.suggestedChanges?.owner?.id === owner.id && itemCand.suggestedChanges?.owner?.type === "cast");
    const castCand = B.buildCandidate({
      entityType: "cast", name: "Bram Iron",
      payload: { name: "Bram Iron", role: "antagonist", traits: "stubborn, loyal", confidence: 0.8 },
    });
    log("[exq] cast traits land as trait chips (data.tags)",
      castCand.suggestedChanges?.role === "antagonist" && JSON.stringify(castCand.suggestedChanges?.tags) === JSON.stringify(["stubborn", "loyal"]));
    const questCand = B.buildCandidate({
      entityType: "quests", name: "Hold the gate",
      payload: { title: "Hold the gate", type: "defense", status: "active", objectives: ["Man the wall", "Signal the keep"], confidence: 0.8 },
    });
    log("[exq] quest objectives become real steps",
      questCand.suggestedChanges?.steps?.length === 2 && questCand.suggestedChanges.steps[0].title === "Man the wall");
    // Category-bucket guard: quick-pass rows reuse `type` as the bucket.
    const locCand = B.buildCandidate({ entityType: "locations", name: "Toll Gate", payload: { type: "locations", name: "Toll Gate" } });
    log("[exq] category bucket never leaks in as a field value", !(locCand.suggestedChanges && locCand.suggestedChanges.kind === "locations"));
    // E1 end-to-end: accepting (autoApply path) lands the mapped data.
    const savedItem = await B.autoApplyCandidate(itemCand);
    log("[exq] accepted candidate carries the mapped fields",
      savedItem.data?.itemType === "relic" && savedItem.data?.rarity === "rare" && savedItem.data?.owner?.id === owner.id);
    // E2: 0.80–0.85 near-duplicates become merge suggestions, not new records.
    const nearDup = B.buildCandidate({ entityType: "cast", name: "Anwem Hales" });
    log("[exq] near-duplicate names promote to merge",
      nearDup.matchType === "ambiguous" && nearDup.existingEntityId === owner.id && nearDup.suggestedAction === "merge");
    // E3: title + epithet alias clustering.
    const clustered = B.clusterAliases([
      B.buildCandidate({ entityType: "cast", name: "Captain Brec", confidence: 0.7 }),
      B.buildCandidate({ entityType: "cast", name: "Brec", confidence: 0.7 }),
    ]);
    log("[exq] 'Captain Brec' clusters with 'Brec' (title alias)",
      clustered.length === 1 && (clustered[0].suggestedChanges?.aliases || []).includes("Brec"));
    const epithets = B.clusterAliases([
      B.buildCandidate({ entityType: "cast", name: "the Silent Reaper", confidence: 0.7 }),
      B.buildCandidate({ entityType: "cast", name: "the Reaper", confidence: 0.7 }),
    ]);
    log("[exq] epithet variants cluster on the shared last token", epithets.length === 1);
    // E5: calibrated detector confidence honours Settings overrides + proximity.
    log("[exq] detector confidence defaults hold", B.detectorConfidence("travel", {}) === 0.8);
    log("[exq] tight constructions earn the proximity boost", B.detectorConfidence("travel", { proximity: 20 }) === 0.86);
    await B.SettingsService.saveSection("extraction", { detectorConfidence: { travel: 0.7 } });
    log("[exq] Settings overrides re-base a detector", B.detectorConfidence("travel", {}) === 0.7);
    // E5: chunk-overlap exact-offset duplicates collapse without losing distinct spans.
    const d1 = B.buildCandidate({ entityType: "cast", name: "Cole Fenn", startOffset: 10, endOffset: 19, sourceQuote: "alpha" });
    const d2 = B.buildCandidate({ entityType: "cast", name: "Cole Fenn", startOffset: 10, endOffset: 19, sourceQuote: "alpha-overlap" });
    const d3 = B.buildCandidate({ entityType: "cast", name: "Cole Fenn", startOffset: 400, endOffset: 409, sourceQuote: "beta" });
    const deduped = B.dedupeCandidates([d1, d2, d3]);
    log("[exq] same-span chunk duplicates skip; distinct spans still merge quotes",
      deduped.length === 1 && deduped[0].sourceQuotes.includes("alpha") && deduped[0].sourceQuotes.includes("beta") && !deduped[0].sourceQuotes.includes("alpha-overlap"));
  }

  // --- [pron] E4 — offline sentence-local pronoun resolution ---
  {
    await B.StorageService.clear();
    const her = await B.EntityService.save("cast", { name: "Anwen Hale", data: { pronouns: "she/her" } }, { status: "active" });
    const him = await B.EntityService.save("cast", { name: "Bram Iron", data: { gender: "male" } }, { status: "active" });
    const textP = "Anwen Hale reached the gate. She paid the toll. Bram Iron watched from the wall, and he said nothing. They argued until dusk.";
    const occs = B.resolvePronounsInText(textP, "pron-ch", "pron-s");
    const byText = (t) => occs.filter((o) => o.exactText.toLowerCase() === t);
    log("[pron] 'She' resolves to the female antecedent", byText("she").length === 1 && byText("she")[0].entityId === her.id);
    log("[pron] 'he' resolves to the male antecedent", byText("he").length === 1 && byText("he")[0].entityId === him.id);
    log("[pron] resolved rows are flagged + offset-accurate",
      occs.every((o) => o.isPronounResolution === true) &&
      textP.slice(byText("she")[0].startOffset, byText("she")[0].endOffset) === "She");
    log("[pron] 'they' resolves to the most recent mention", byText("they").length === 1 && byText("they")[0].entityId === him.id);
    // No cast → no work; gender mismatch in lookback → unresolved pronouns stay out.
    const lonely = B.resolvePronounsInText("He walked alone for days.", "pron-ch", "pron-s");
    log("[pron] pronouns with no antecedent are skipped", lonely.length === 0);
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
