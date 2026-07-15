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
  load(win, "historical-world-state-service.jsx");
  load(win, "historical-world-state-rules.jsx");

  const B = win.LoomwrightBackend;
  const WS = B.HistoricalWorldStateService;
  check("HistoricalWorldStateService extends the existing backend", !!WS);
  if (!WS) process.exit(1);

  await B.ManuscriptChapterService.save({
    chapters: [
      { id: "ws-ch1", num: 1, title: "The Gate", bodyText: "Mara carried the Witness Key through Salt Gate." },
      { id: "ws-ch2", num: 2, title: "The Court", bodyText: "Mara gave the Witness Key to Soren in Lantern Court." },
      { id: "ws-ch3", num: 3, title: "The Fracture", bodyText: "Soren broke the Witness Key and betrayed Mara." },
    ],
    activeChapterId: "ws-ch3",
    manuscripts: {},
  });

  const mara = await B.EntityService.save("cast", {
    id: "ws-mara", name: "Mara Vale", aliases: ["Mara"],
    data: {
      summary: "A courier.", currentLocation: { id: "ws-court", name: "Lantern Court", type: "locations" },
      locationHistory: [
        { id: "wm1", from: null, to: { id: "ws-gate", name: "Salt Gate", type: "locations" }, chapterId: "ws-ch1", sourceQuote: "Mara entered Salt Gate." },
        { id: "wm2", from: { id: "ws-gate", name: "Salt Gate", type: "locations" }, to: { id: "ws-court", name: "Lantern Court", type: "locations" }, chapterId: "ws-ch2", sourceQuote: "Mara entered Lantern Court." },
      ],
      knowledgeClaims: [{ id: "wk1", statement: "The court altered the record", state: "known", chapterId: "ws-ch3", sourceQuote: "Mara learned the truth." }],
    },
  }, { status: "active" });
  const soren = await B.EntityService.save("cast", {
    id: "ws-soren", name: "Soren Grey", aliases: ["Soren"],
    data: { summary: "A reluctant heir.", currentLocation: { id: "ws-court", name: "Lantern Court", type: "locations" } },
  }, { status: "active" });
  const gate = await B.EntityService.save("locations", {
    id: "ws-gate", name: "Salt Gate",
    data: {
      summary: "An old border gate.", status: "sealed", currentStatus: "sealed", placed: true,
      statusHistory: [{ id: "wg1", previousStatus: "open", status: "sealed", chapterId: "ws-ch3", sourceQuote: "Salt Gate was sealed." }],
    },
  }, { status: "active" });
  const court = await B.EntityService.save("locations", {
    id: "ws-court", name: "Lantern Court", data: { summary: "Neutral ground.", status: "open", placed: true },
  }, { status: "active" });
  const key = await B.EntityService.save("items", {
    id: "ws-key", name: "Witness Key",
    data: {
      summary: "Records every transfer.", condition: "broken",
      currentOwner: { id: soren.id, name: soren.name, type: "cast" },
      currentLocation: { id: court.id, name: court.name, type: "locations" },
      relatedCharacters: [{ id: mara.id, name: mara.name, type: "cast" }, { id: soren.id, name: soren.name, type: "cast" }],
      ownershipHistory: [
        { id: "wo1", from: null, to: { id: mara.id, name: mara.name, type: "cast" }, chapterId: "ws-ch1", sourceQuote: "Mara carried the Witness Key." },
        { id: "wo2", from: { id: mara.id, name: mara.name, type: "cast" }, to: { id: soren.id, name: soren.name, type: "cast" }, chapterId: "ws-ch2", sourceQuote: "Mara gave the Witness Key to Soren." },
      ],
      statusHistory: [{ id: "wc1", previousCondition: "whole", condition: "broken", status: "broken", chapterId: "ws-ch3", sourceQuote: "Soren broke the Witness Key." }],
    },
  }, { status: "active" });
  const relationship = await B.EntityService.save("relationships", {
    id: "ws-rel", name: "Mara Vale → Soren Grey",
    data: {
      fromId: mara.id, toId: soren.id, relationshipType: "trust",
      markers: [
        { id: "wr1", type: "trust", polarity: "positive", value: 70, chapterId: "ws-ch2", sourceQuote: "Mara trusted Soren with the key." },
        { id: "wr2", type: "trust", polarity: "negative", value: 10, chapterId: "ws-ch3", sourceQuote: "Soren betrayed Mara." },
      ],
    },
  }, { status: "active" });

  await B.OccurrenceService.saveMany([
    { occurrenceId: "wse1", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "ws-ch1", sourceSentence: "Mara carried the Witness Key through Salt Gate.", startOffset: 18, endOffset: 29, coMentionedEntityIds: [mara.id, gate.id] },
    { occurrenceId: "wse2", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "ws-ch2", sourceSentence: "Mara gave the Witness Key to Soren in Lantern Court.", startOffset: 14, endOffset: 25, coMentionedEntityIds: [mara.id, soren.id, court.id] },
    { occurrenceId: "wse3", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "ws-ch3", sourceSentence: "Soren broke the Witness Key and betrayed Mara.", startOffset: 16, endOffset: 27, coMentionedEntityIds: [mara.id, soren.id, relationship.id] },
  ]);

  const ch1 = WS.snapshot({ anchor: { type: "chapter", id: "ws-ch1", label: "Chapter 1" } });
  const ch2 = WS.snapshot({ anchor: { type: "chapter", id: "ws-ch2", label: "Chapter 2" } });
  const ch3 = WS.snapshot({ anchor: { type: "chapter", id: "ws-ch3", label: "Chapter 3" } });
  const current = WS.snapshot();

  check("Chapter 1 reconstructs Mara as the first owner", ch1.entityById.get(key.id)?.data?.currentOwner?.id === mara.id);
  check("Chapter 2 replays ownership transfer to Soren", ch2.entityById.get(key.id)?.data?.currentOwner?.id === soren.id);
  check("Chapter 2 reverses the later broken condition", ch2.entityById.get(key.id)?.data?.condition === "whole", ch2.entityById.get(key.id)?.data?.condition);
  check("Chapter 3 contains the broken current state", ch3.entityById.get(key.id)?.data?.condition === "broken");
  check("Chapter 1 reconstructs Mara at Salt Gate", ch1.entityById.get(mara.id)?.data?.currentLocation?.id === gate.id);
  check("Chapter 2 reconstructs Mara at Lantern Court", ch2.entityById.get(mara.id)?.data?.currentLocation?.id === court.id);
  check("Chapter 2 excludes later character knowledge", !(ch2.entityById.get(mara.id)?.data?.knowledgeClaims || []).some((row) => row.id === "wk1"));
  check("current canonical snapshot remains unchanged", current.entityById.get(key.id)?.data?.currentOwner?.id === soren.id && current.entityById.get(key.id)?.data?.condition === "broken");

  const trajectoryCh2 = WS.relationshipTrajectory(relationship.id, { anchor: { type: "chapter", id: "ws-ch2" } });
  check("relationship trajectory shows the trusted Chapter 2 marker", trajectoryCh2.visibleRows.some((row) => row.marker.id === "wr1"));
  check("relationship trajectory keeps betrayal in the future at Chapter 2", trajectoryCh2.futureRows.some((row) => row.marker.id === "wr2"));

  const branch = await WS.createBranch({
    name: "Mara Keeps the Key",
    description: "Test an ending where the transfer never completes.",
    fromAnchor: { type: "chapter", id: "ws-ch2", label: "Chapter 2 · The Court" },
  });
  await WS.addBranchDelta({
    branchId: branch.id,
    entityId: key.id,
    path: "data.currentOwner",
    after: { id: mara.id, name: mara.name, type: "cast" },
    anchor: { type: "chapter", id: "ws-ch2", label: "Chapter 2 · The Court" },
    kind: "alternative-ownership",
    relatedEntityIds: [mara.id, soren.id],
  });
  await WS.addBranchDelta({
    branchId: branch.id,
    entityId: key.id,
    path: "data.condition",
    after: "whole",
    anchor: { type: "chapter", id: "ws-ch3", label: "Chapter 3 · The Fracture" },
    kind: "alternative-item-state",
    relatedEntityIds: [mara.id, soren.id],
  });
  await WS.addBranchDelta({
    branchId: branch.id,
    entityId: relationship.id,
    path: "data.markers",
    after: [{ id: "alt-trust", type: "trust", polarity: "positive", value: 85, chapterId: "ws-ch3", sourceQuote: "Soren returned the key untouched." }],
    anchor: { type: "chapter", id: "ws-ch3", label: "Chapter 3 · The Fracture" },
    kind: "alternative-relationship",
    relatedEntityIds: [mara.id, soren.id],
  });

  const branchSnapshot = WS.snapshot({ anchor: { type: "chapter", id: "ws-ch3" }, branchId: branch.id });
  check("branch changes ownership without mutating canonical state", branchSnapshot.entityById.get(key.id)?.data?.currentOwner?.id === mara.id && B.EntityService.getSync(key.id, "items")?.data?.currentOwner?.id === soren.id);
  check("branch preserves the key instead of breaking it", branchSnapshot.entityById.get(key.id)?.data?.condition === "whole");
  check("branch replaces the relationship trajectory", branchSnapshot.entityById.get(relationship.id)?.data?.markers?.[0]?.id === "alt-trust");

  const child = await WS.createBranch({
    name: "Open Gate Ending",
    description: "A child branch that also keeps Salt Gate open.",
    fromAnchor: { type: "chapter", id: "ws-ch3", label: "Chapter 3 · The Fracture" },
    parentBranchId: branch.id,
  });
  await WS.addBranchDelta({
    branchId: child.id,
    entityId: gate.id,
    path: "data.currentStatus",
    after: "open",
    anchor: { type: "chapter", id: "ws-ch3", label: "Chapter 3 · The Fracture" },
    kind: "alternative-world-state",
  });
  const childSnapshot = WS.snapshot({ anchor: { type: "chapter", id: "ws-ch3" }, branchId: child.id });
  check("child branch inherits parent ownership", childSnapshot.entityById.get(key.id)?.data?.currentOwner?.id === mara.id);
  check("child branch applies its own world-state delta", childSnapshot.entityById.get(gate.id)?.data?.currentStatus === "open");
  check("branch lineage is ordered parent then child", childSnapshot.branchLineage.map((row) => row.id).join(",") === `${branch.id},${child.id}`);

  const diff = WS.diffSnapshots(
    { anchor: { type: "chapter", id: "ws-ch3" }, branchId: "canonical" },
    { anchor: { type: "chapter", id: "ws-ch3" }, branchId: branch.id },
  );
  check("canonical-vs-branch diff identifies changed entities", diff.changedEntityCount >= 2, diff.changedEntityCount);
  check("diff includes owner and condition changes", diff.rows.some((row) => row.entityId === key.id && row.changes.some((change) => change.field === "currentOwner")) && diff.rows.some((row) => row.entityId === key.id && row.changes.some((change) => change.field === "condition")));

  const reviewIds = await WS.commitBranchToReview(branch.id);
  check("branch commit creates Impact Review proposals", reviewIds.length >= 2 && reviewIds.every((id) => B.ReviewService.listSync().some((row) => row.id === id)));
  check("branch remains non-canon after commit proposal", B.EntityService.getSync(key.id, "items")?.data?.currentOwner?.id === soren.id);
  check("branch status records proposal state", WS.loadStoreSync().branches.find((row) => row.id === branch.id)?.status === "proposed");

  const impact = WS.retconImpact({
    entityId: key.id,
    path: "data.currentOwner",
    anchor: { type: "chapter", id: "ws-ch1", label: "Chapter 1 · The Gate" },
    after: { id: soren.id, name: soren.name, type: "cast" },
  });
  check("retcon impact finds later accepted deltas", impact.laterDeltas.length >= 2, impact.laterDeltas.length);
  check("retcon impact includes later manuscript references", impact.occurrences.some((row) => row.chapterId === "ws-ch2") && impact.occurrences.some((row) => row.chapterId === "ws-ch3"));
  check("retcon impact includes linked entities and chapters", impact.affectedEntityIds.includes(mara.id) && impact.chapterIds.includes("ws-ch3"));
  check("retcon impact assigns a meaningful severity", ["medium", "high", "critical"].includes(impact.severity), impact.severity);

  const proposedRetcon = await WS.proposeRetcon({
    entityId: key.id,
    path: "data.currentOwner",
    anchor: { type: "chapter", id: "ws-ch1", label: "Chapter 1 · The Gate" },
    after: { id: soren.id, name: soren.name, type: "cast" },
    sourceQuote: "Soren had carried the key from the beginning.",
  });
  check("retcon proposal enters Impact Review instead of mutating canon", proposedRetcon.review?.trackingKind === "retcon" && B.EntityService.getSync(key.id, "items")?.data?.currentOwner?.id === soren.id);
  check("retcon proposal stores its impact evidence", proposedRetcon.review?.payload?.retconImpact?.chapterIds?.includes("ws-ch3"));

  const timeline = WS.timelineProjection({ branchId: branch.id });
  check("timeline projection combines canonical and branch deltas", timeline.find((row) => row.id === "ws-ch2")?.deltas?.length > 0 && timeline.find((row) => row.id === "ws-ch2")?.branchDeltas?.length > 0);
  const summary = WS.summary({ anchor: { type: "chapter", id: "ws-ch3" }, branchId: branch.id });
  check("world-state summary reports branch changes", summary.branchChangeCount === 3 && summary.changedEntityCount >= 3);

  await WS.discardBranch(child.id);
  check("discarding a child branch removes only its sandbox", !WS.loadStoreSync().branches.some((row) => row.id === child.id) && WS.loadStoreSync().branches.some((row) => row.id === branch.id));

  if (failures.length) {
    console.error(`\n${failures.length} historical-world-state smoke check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll historical-world-state smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
