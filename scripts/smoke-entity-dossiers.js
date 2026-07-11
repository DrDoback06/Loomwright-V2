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
    queueMicrotask,
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
  load(win, "entity-dossier-service.jsx");
  load(win, "app-product-defaults.jsx");

  const B = win.LoomwrightBackend;
  const DS = B.EntityDossierService;
  check("EntityDossierService extends the existing backend", !!DS);
  if (!DS) process.exit(1);

  await B.ManuscriptChapterService.save({
    chapters: [
      { id: "ed-ch1", num: 1, title: "The Gate", bodyText: "Mara carried the Witness Key through Salt Gate." },
      { id: "ed-ch2", num: 2, title: "The Court", bodyText: "Mara gave the Witness Key to Soren in Lantern Court." },
      { id: "ed-ch3", num: 3, title: "The Fracture", bodyText: "Soren broke the Witness Key after Mara learned the truth." },
    ],
    activeChapterId: "ed-ch3",
    manuscripts: {},
  });

  const mara = await B.EntityService.save("cast", {
    id: "ed-mara", name: "Mara Vale", aliases: ["Mara"],
    data: {
      summary: "A courier carrying an inherited debt.", personality: "Precise and guarded", goals: ["Find the missing witness"],
      currentLocation: { id: "ed-court", name: "Lantern Court", type: "locations" },
      knowledgeClaims: [{ id: "k1", statement: "The court altered the old record", state: "known", certainty: "confirmed-to-character", chapterId: "ed-ch3", sourceQuote: "Mara learned the truth." }],
      beliefs: [{ id: "b1", statement: "Soren intends to betray her", state: "suspicion", certainty: "uncertain", chapterId: "ed-ch2", sourceQuote: "Mara suspected Soren." }],
      intentions: [{ id: "i1", action: "Find the missing witness", status: "active", chapterId: "ed-ch2", sourceQuote: "Mara promised to find the missing witness." }],
      locationHistory: [
        { id: "m1", from: null, to: { id: "ed-gate", name: "Salt Gate", type: "locations" }, chapterId: "ed-ch1", sourceQuote: "Mara entered Salt Gate." },
        { id: "m2", from: { id: "ed-gate", name: "Salt Gate", type: "locations" }, to: { id: "ed-court", name: "Lantern Court", type: "locations" }, chapterId: "ed-ch2", sourceQuote: "Mara entered Lantern Court." },
      ],
    },
  }, { status: "active" });
  const soren = await B.EntityService.save("cast", {
    id: "ed-soren", name: "Soren Grey", aliases: ["Soren"],
    data: { summary: "A reluctant heir.", personality: "Patient and calculating", goals: ["Control the court"], currentLocation: { id: "ed-court", name: "Lantern Court", type: "locations" } },
  }, { status: "active" });
  const gate = await B.EntityService.save("locations", {
    id: "ed-gate", name: "Salt Gate", data: { summary: "An old border gate.", placed: true, status: "sealed" },
  }, { status: "active" });
  const court = await B.EntityService.save("locations", {
    id: "ed-court", name: "Lantern Court", data: { summary: "Neutral ground maintained by ritual.", placed: true, status: "open" },
  }, { status: "active" });
  const key = await B.EntityService.save("items", {
    id: "ed-key", name: "Witness Key",
    data: {
      summary: "Records every transfer.", itemType: "story object", condition: "broken",
      currentOwner: { id: soren.id, name: soren.name, type: "cast" },
      currentLocation: { id: court.id, name: court.name, type: "locations" },
      ownershipHistory: [
        { id: "o1", from: null, to: { id: mara.id, name: mara.name, type: "cast" }, chapterId: "ed-ch1", sourceQuote: "Mara carried the Witness Key." },
        { id: "o2", from: { id: mara.id, name: mara.name, type: "cast" }, to: { id: soren.id, name: soren.name, type: "cast" }, chapterId: "ed-ch2", sourceQuote: "Mara gave the Witness Key to Soren." },
      ],
      statusHistory: [{ id: "s1", previousCondition: "whole", condition: "broken", status: "broken", chapterId: "ed-ch3", sourceQuote: "Soren broke the Witness Key." }],
      relatedCharacters: [{ id: mara.id, name: mara.name, type: "cast" }, { id: soren.id, name: soren.name, type: "cast" }],
    },
  }, { status: "active" });
  await B.EntityService.save("relationships", {
    id: "ed-rel", name: "Mara Vale → Soren Grey",
    data: {
      fromId: mara.id, toId: soren.id, relationshipType: "trust",
      markers: [{ id: "rm1", type: "trust", polarity: "negative", chapterId: "ed-ch3", sourceQuote: "Soren betrayed Mara." }],
      evidence: [{ id: "re1", chapterId: "ed-ch3", sourceQuote: "Soren betrayed Mara." }],
    },
  }, { status: "active" });

  await B.OccurrenceService.saveMany([
    { occurrenceId: "e1", entityId: mara.id, entityType: "cast", exactText: "Mara", chapterId: "ed-ch1", startOffset: 0, endOffset: 4, sourceSentence: "Mara carried the Witness Key through Salt Gate.", sceneIndex: 0, sentenceIndex: 0, sentiment: "neutral", trackingTags: ["ownership", "travel"], coMentionedEntityIds: [key.id, gate.id] },
    { occurrenceId: "e2", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "ed-ch1", startOffset: 18, endOffset: 29, sourceSentence: "Mara carried the Witness Key through Salt Gate.", sceneIndex: 0, sentenceIndex: 0, sentiment: "neutral", trackingTags: ["ownership"], coMentionedEntityIds: [mara.id, gate.id] },
    { occurrenceId: "e3", entityId: mara.id, entityType: "cast", exactText: "Mara", chapterId: "ed-ch2", startOffset: 0, endOffset: 4, sourceSentence: "Mara gave the Witness Key to Soren in Lantern Court.", sceneIndex: 0, sentenceIndex: 0, sentiment: "neutral", trackingTags: ["ownership", "relationship"], coMentionedEntityIds: [key.id, soren.id, court.id] },
    { occurrenceId: "e4", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "ed-ch2", startOffset: 14, endOffset: 25, sourceSentence: "Mara gave the Witness Key to Soren in Lantern Court.", sceneIndex: 0, sentenceIndex: 0, sentiment: "neutral", trackingTags: ["ownership"], coMentionedEntityIds: [mara.id, soren.id, court.id] },
    { occurrenceId: "e5", entityId: soren.id, entityType: "cast", exactText: "Soren", chapterId: "ed-ch3", startOffset: 0, endOffset: 5, sourceSentence: "Soren broke the Witness Key after Mara learned the truth.", sceneIndex: 0, sentenceIndex: 0, sentiment: "negative", trackingTags: ["world-state", "knowledge"], coMentionedEntityIds: [key.id, mara.id] },
    { occurrenceId: "e6", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "ed-ch3", startOffset: 16, endOffset: 27, sourceSentence: "Soren broke the Witness Key after Mara learned the truth.", sceneIndex: 0, sentenceIndex: 0, sentiment: "negative", trackingTags: ["world-state"], coMentionedEntityIds: [soren.id, mara.id] },
  ]);

  await B.ReferencesService.save({
    id: "ed-ref", kind: "research", title: "Court succession notes", content: "The Witness Key validates transfers at Lantern Court.",
    linkedEntities: [{ id: key.id, name: key.name, type: "items" }, { id: court.id, name: court.name, type: "locations" }],
    includedInAIContext: true,
  });
  await B.ReviewService.add({
    id: "ed-review", entityType: "items", name: "Witness Key is secretly copied", status: "pending", existingEntityId: key.id,
    relatedEntityIds: [mara.id, soren.id, court.id], suggestedAction: "update", suggestedChanges: { secrets: ["A copy exists"] },
    chapterId: "ed-ch3", sourceQuote: "A second key lay beneath the ledger.", confidence: 0.81, confidenceBand: "green",
  });
  await B.ReviewService.add({
    id: "ed-receipt", entityType: "items", name: "Witness Key changes owner", status: "done", existingEntityId: key.id,
    impactReceipt: { id: "receipt-1", severity: "high", acceptedAt: new Date().toISOString(), changedEntities: [{ id: key.id, type: "items", name: key.name, kind: "updated", before: null, after: key }], affectedEntityIds: [key.id, mara.id, soren.id], affectedChapterIds: ["ed-ch2"], revertedAt: null },
  });

  const dossier = DS.build(key.id, "items");
  check("dossier contains the canonical entity", dossier?.id === key.id && dossier.name === "Witness Key");
  check("dossier derives manuscript evidence with chapter labels", dossier.evidence.length === 3 && dossier.evidence[1].chapterLabel.includes("The Court"));
  check("dossier preserves co-mentioned entity links", dossier.evidence.some((row) => row.coMentioned.some((ref) => ref.id === mara.id)));
  check("dossier derives ownership and state history", dossier.history.some((row) => row.field === "ownershipHistory") && dossier.history.some((row) => row.field === "statusHistory"));
  check("dossier exposes canonical connections", dossier.connections.some((row) => row.id === mara.id) && dossier.connections.some((row) => row.id === soren.id));
  check("dossier includes linked references", dossier.references.some((row) => row.id === "ed-ref"));
  check("dossier includes pending review and accepted receipts", dossier.reviews.some((row) => row.id === "ed-review") && dossier.reviews.some((row) => row.receipt?.id === "receipt-1"));
  check("dossier metrics count chapters and history", dossier.metrics.chapters === 3 && dossier.metrics.historyEvents >= 3);

  const maraDossier = DS.build(mara.id, "cast");
  check("cast dossier separates knowledge and belief claims", maraDossier.knowledge.some((row) => row.kind === "knowledge") && maraDossier.knowledge.some((row) => row.kind === "belief"));
  check("cast dossier exposes chapter evolution", maraDossier.evolution.rows.some((row) => row.id === "ed-ch1") && maraDossier.evolution.rows.some((row) => row.id === "ed-ch2"));

  const asOfChapter1 = DS.build(key.id, "items", { asOfChapterId: "ed-ch1" });
  const asOfChapter2 = DS.build(key.id, "items", { asOfChapterId: "ed-ch2" });
  check("as-of Chapter 1 projects the first owner", asOfChapter1.evolution.state.owner?.id === mara.id, asOfChapter1.evolution.state.owner?.name);
  check("as-of Chapter 2 replays transfer to Soren", asOfChapter2.evolution.state.owner?.id === soren.id, asOfChapter2.evolution.state.owner?.name);
  check("as-of view marks later chapters as future", asOfChapter1.evolution.rows.some((row) => row.id === "ed-ch3" && row.active === false));

  const comparison = DS.compare([{ id: mara.id, type: "cast" }, { id: soren.id, type: "cast" }, { id: key.id, type: "items" }]);
  check("comparison supports cross-type records", comparison.dossiers.length === 3);
  check("comparison detects meaningful differences", comparison.differenceCount > 0);
  check("comparison includes dynamic canonical fields", comparison.rows.some((row) => row.key === "personality") && comparison.rows.some((row) => row.key === "condition"));
  check("comparison reports shared chapters", comparison.sharedChapterIds.includes("ed-ch3"));

  DS.pin(mara);
  DS.pin(key);
  check("comparison pins persist in localStorage", DS.readPins().some((row) => row.id === mara.id) && DS.readPins().some((row) => row.id === key.id));
  DS.togglePin(mara);
  check("pin toggle removes an existing pin", !DS.readPins().some((row) => row.id === mara.id));
  DS.clearPins();
  check("pin collection can be cleared", DS.readPins().length === 0);

  if (failures.length) {
    console.error(`\n${failures.length} entity-dossier smoke check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll entity-dossier smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
