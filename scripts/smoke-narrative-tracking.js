#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const localStorageMap = new Map();
const idbStores = {};

function eventTarget() {
  const listeners = {};
  return {
    addEventListener(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    removeEventListener(name, fn) { listeners[name] = (listeners[name] || []).filter((row) => row !== fn); },
    dispatchEvent(evt) { (listeners[evt.type] || []).forEach((fn) => { try { fn(evt); } catch (_) {} }); return true; },
  };
}

function indexedDbShim() {
  return {
    open() {
      const request = {};
      setImmediate(() => {
        const db = {
          objectStoreNames: { contains: (name) => !!idbStores[name] },
          createObjectStore(name) { idbStores[name] = idbStores[name] || new Map(); },
          transaction() {
            return {
              objectStore(name) {
                idbStores[name] = idbStores[name] || new Map();
                const store = idbStores[name];
                return {
                  get(key) { const r = {}; setImmediate(() => { r.result = store.get(key); r.onsuccess?.(); }); return r; },
                  put(value, key) { store.set(key, value); const r = {}; setImmediate(() => r.onsuccess?.()); return r; },
                  delete(key) { store.delete(key); const r = {}; setImmediate(() => r.onsuccess?.()); return r; },
                };
              },
            };
          },
        };
        idbStores.kv = idbStores.kv || new Map();
        idbStores.keyring = idbStores.keyring || new Map();
        request.result = db;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

function makeWindow() {
  const events = eventTarget();
  const win = {
    ...events,
    localStorage: {
      getItem: (key) => localStorageMap.has(key) ? localStorageMap.get(key) : null,
      setItem: (key, value) => localStorageMap.set(key, String(value)),
      removeItem: (key) => localStorageMap.delete(key),
      clear: () => localStorageMap.clear(),
    },
    indexedDB: indexedDbShim(),
    crypto: {
      randomUUID: () => crypto.randomUUID(),
      getRandomValues: (array) => crypto.webcrypto.getRandomValues(array),
      subtle: crypto.webcrypto.subtle,
    },
    document: {
      addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
      createElement() { return { click() {}, setAttribute() {}, appendChild() {} }; }, body: { appendChild() {}, removeChild() {} },
    },
    CustomEvent: function CustomEvent(type, init) { return { type, detail: init?.detail || null }; },
    navigator: { clipboard: { writeText: async () => true } },
    prompt: () => null,
    confirm: () => true,
    fetch: async () => { throw new Error("fetch disabled in smoke test"); },
    URL: { createObjectURL: () => "blob://stub", revokeObjectURL() {} },
    Blob: function Blob(parts) { this.parts = parts; },
    TextEncoder,
    TextDecoder,
    AbortController,
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    setTimeout, clearTimeout, setImmediate, console,
    ENTITY_SAMPLES: {}, CAST_SAMPLE: [], REFERENCES: [], ONBOARDING_ANSWERS: {}, WR_DEMO_PROJECT: {}, PANEL_PRESETS: {},
  };
  win.window = win;
  return win;
}

function load(win, file) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), win, { filename: file });
}

async function main() {
  const failures = [];
  const check = (label, okay, detail = "") => {
    console.log(okay ? "  OK  " : " FAIL ", label, detail ? `— ${detail}` : "");
    if (!okay) failures.push(label);
  };

  const win = makeWindow();
  load(win, "backend-services.jsx");
  await new Promise((resolve) => setTimeout(resolve, 50));
  load(win, "story-intelligence.jsx");
  load(win, "story-intelligence-rules.jsx");
  load(win, "impact-review-service.jsx");
  load(win, "impact-review-receipt-rules.jsx");
  load(win, "narrative-tracking-service.jsx");
  load(win, "narrative-tracking-rules.jsx");

  const B = win.LoomwrightBackend;
  const tracking = B.NarrativeTrackingService;
  check("NarrativeTrackingService extends the existing extraction backend", !!tracking && B.ExtractionService.runExtraction !== undefined);
  if (!tracking) process.exit(1);

  await B.SettingsService.setSection("extraction", {
    aggressiveness: "balanced",
    autoAdd95: true,
    showAutoAddedInReview: true,
    threshold: 50,
    scan: {},
  });

  const mara = await B.EntityService.save("cast", {
    id: "nt-mara", name: "Mara Vale", aliases: ["Mara"],
    data: { summary: "A courier.", currentLocation: null, knowledgeClaims: [], beliefs: [], goals: [] },
  }, { status: "active" });
  const soren = await B.EntityService.save("cast", {
    id: "nt-soren", name: "Soren Grey", aliases: ["Soren"], data: { summary: "A reluctant heir." },
  }, { status: "active" });
  const gate = await B.EntityService.save("locations", {
    id: "nt-gate", name: "Salt Gate", data: { summary: "An old border gate.", placed: true, status: "open" },
  }, { status: "active" });
  const court = await B.EntityService.save("locations", {
    id: "nt-court", name: "Lantern Court", data: { summary: "A neutral court.", placed: true },
  }, { status: "active" });
  const coats = await B.EntityService.save("factions", {
    id: "nt-coats", name: "Grey Coats", aliases: ["the Grey Coats"], data: { summary: "A military order." },
  }, { status: "active" });
  const key = await B.EntityService.save("items", {
    id: "nt-key", name: "Witness Key",
    data: { summary: "Records every transfer.", currentOwner: { id: mara.id, name: mara.name, type: "cast" }, ownershipHistory: [] },
  }, { status: "active" });
  await B.EntityService.save("relationships", {
    id: "nt-rel", name: "Mara Vale ↔ Soren Grey",
    data: { fromId: mara.id, toId: soren.id, relationshipType: "acquaintance", markers: [{ type: "familiarity", polarity: "positive" }] },
  }, { status: "active" });

  const text = [
    "Mara gave the Witness Key to Soren at Salt Gate.",
    "Soren entered Lantern Court.",
    "Mara learned that the Grey Coats had lowered their banner.",
    "Mara promised to find the missing witness.",
    "Soren betrayed Mara.",
    "Salt Gate was sealed.",
    "Mara had never met Soren.",
    "Mara stared toward Lantern Court.",
    "She entered Lantern Court.",
    "She suspected that Soren had lied.",
  ].join("\n");

  await B.ManuscriptChapterService.save({
    chapters: [{ id: "nt-ch1", num: 1, title: "The Transfer", bodyText: text }],
    activeChapterId: "nt-ch1",
    manuscripts: {},
  });

  const result = await B.ExtractionService.runExtraction({
    chapterId: "nt-ch1",
    text,
    deep: true,
    scope: "chapter",
  });

  check("enhanced extraction returns a tracking report", !!result.tracking && result.tracking.version === 1);
  check("tracking report records state changes", result.tracking.stateChangeCount >= 3, result.tracking.stateChangeCount);
  check("tracking report records knowledge and beliefs", result.tracking.knowledgeCount >= 2, result.tracking.knowledgeCount);
  check("tracking report records promises/open threads", result.tracking.promiseCount >= 1, result.tracking.promiseCount);
  check("tracking report identifies history contradictions", result.tracking.contradictionCount >= 1, result.tracking.contradictionCount);

  const queue = B.ReviewService.listSync();
  const ownership = queue.find((row) => row.trackingKind === "ownership" && row.existingEntityId === key.id && row.suggestedChanges?.currentOwner?.id === soren.id);
  const movement = queue.find((row) => row.trackingKind === "movement" && row.existingEntityId === soren.id && row.suggestedChanges?.currentLocation?.id === court.id);
  const knowledge = queue.find((row) => row.trackingKind === "knowledge" && row.existingEntityId === mara.id && row.suggestedChanges?.knowledgeClaims?.length);
  const belief = queue.find((row) => row.trackingKind === "belief" && row.existingEntityId === mara.id && row.suggestedChanges?.beliefs?.length);
  const promise = queue.find((row) => row.trackingKind === "promise" && row.entityType === "quests");
  const betrayal = queue.find((row) => row.trackingKind === "relationship" && row.relatedEntityIds?.includes(mara.id) && row.relatedEntityIds?.includes(soren.id));
  const sealed = queue.find((row) => row.trackingKind === "world-state" && row.existingEntityId === gate.id && row.suggestedChanges?.status === "sealed");
  const contradiction = queue.find((row) => row.trackingKind === "contradiction" && row.conflict?.kind === "history-contradiction");
  const pronounMove = queue.find((row) => row.trackingKind === "movement" && /previous sentence/i.test(row.summary || ""));

  check("ownership transfer proposes structured owner and history", !!ownership && ownership.suggestedChanges.ownershipHistory.length > 0);
  check("movement proposes current location and route history", !!movement && movement.suggestedChanges.locationHistory.length > 0);
  check("knowledge is separated from objective canon", !!knowledge && knowledge.suggestedChanges.knowledgeClaims[0].state === "known");
  check("belief/suspicion is tracked separately from knowledge", !!belief && belief.suggestedChanges.beliefs.some((row) => row.state === "suspicion"));
  check("explicit promise becomes a reviewable Story Thread", !!promise && promise.suggestedChanges.questType === "promise" && promise.suggestedChanges.unresolved === true);
  check("relationship action creates directional marker evidence", !!betrayal && betrayal.suggestedChanges.markers.some((row) => row.type === "trust" && row.polarity === "negative"));
  check("world-state change proposes location history", !!sealed && sealed.suggestedChanges.statusHistory.length > 0);
  check("contradiction links accepted history and source evidence", !!contradiction && contradiction.relatedEntityIds.includes(mara.id) && contradiction.relatedEntityIds.includes(soren.id));
  check("cross-sentence pronoun resolution adds a low-confidence movement proposal", !!pronounMove && pronounMove.confidence < 0.75);

  const occurrences = B.OccurrenceService.listByChapterSync("nt-ch1");
  const keyOccurrence = occurrences.find((row) => row.entityId === key.id);
  const maraOccurrence = occurrences.find((row) => row.entityId === mara.id && row.trackingTags?.includes("ownership"));
  check("occurrences retain exact sentence context", !!keyOccurrence?.sourceSentence && keyOccurrence.sourceSentence.includes("Witness Key"));
  check("occurrences retain scene and sentence indices", Number.isInteger(keyOccurrence?.sentenceIndex) && Number.isInteger(keyOccurrence?.sceneIndex));
  check("occurrences retain co-mentioned entities", keyOccurrence?.coMentionedEntityIds?.includes(mara.id) && keyOccurrence?.coMentionedEntityIds?.includes(soren.id));
  check("occurrences expose narrative tracking tags", !!maraOccurrence);

  const reportFromStore = B.ExtractionService.latestTrackingReportSync();
  const history = B.ExtractionService.loadHistorySync();
  check("latest tracking report persists in the existing extraction session store", reportFromStore?.id === result.tracking.id);
  check("extraction history contains the completed tracking run", history.some((row) => row.sessionId === result.tracking.sessionId));

  const firstPending = B.ReviewService.listSync().filter((row) => row.chapterId === "nt-ch1" && row.status === "pending").length;
  const second = await B.ExtractionService.runExtraction({ chapterId: "nt-ch1", text, deep: true, scope: "chapter" });
  const secondPending = B.ReviewService.listSync().filter((row) => row.chapterId === "nt-ch1" && row.status === "pending").length;
  check("re-extraction is idempotent instead of duplicating pending review", secondPending <= firstPending + 2, `${firstPending} → ${secondPending}`);
  check("extraction history preserves more than the latest run", B.ExtractionService.loadHistorySync().length >= 2, B.ExtractionService.loadHistorySync().length);
  check("second report remains locally generated without requiring AI", second.tracking && second.session.aiUsed === false);

  const dashboard = B.StoryIntelligenceService.buildDashboard();
  check("Home/Today intelligence receives the latest tracking report", dashboard.tracking?.id === second.tracking.id);
  const suggestions = B.StoryIntelligenceService.buildSuggestions({ limit: 80 });
  check("Today surfaces contradiction tracking", suggestions.some((row) => row.id.startsWith("tracking-contradictions-")));
  check("Today surfaces promises and unresolved questions", suggestions.some((row) => row.id.startsWith("tracking-promises-")));
  check("Today surfaces character perspective changes", suggestions.some((row) => row.id.startsWith("tracking-knowledge-")));

  if (failures.length) {
    console.error(`\n${failures.length} narrative-tracking smoke check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll narrative-tracking smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
