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
  load(win, "historical-world-state-service.jsx");
  load(win, "historical-world-state-rules.jsx");
  load(win, "live-atlas-service.jsx");

  const B = win.LoomwrightBackend;
  const Atlas = B.LiveAtlasService;
  const World = B.HistoricalWorldStateService;
  check("LiveAtlasService extends LoomwrightBackend", !!Atlas);
  if (!Atlas) process.exit(1);

  await B.ManuscriptChapterService.save({
    chapters: [
      { id: "ab-ch1", num: 1, title: "Salt Gate" },
      { id: "ab-ch2", num: 2, title: "Lantern Court" },
      { id: "ab-ch3", num: 3, title: "The Tower" },
    ],
    activeChapterId: "ab-ch3",
    manuscripts: {},
  });

  const gate = await B.EntityService.save("locations", { id: "ab-gate", name: "Salt Gate", data: { summary: "The western border.", locationType: "gate" } }, { status: "active" });
  const court = await B.EntityService.save("locations", { id: "ab-court", name: "Lantern Court", data: { summary: "Neutral ritual ground.", locationType: "court" } }, { status: "active" });
  const tower = await B.EntityService.save("locations", { id: "ab-tower", name: "Glass Tower", data: { summary: "An unplaced extracted landmark.", locationType: "tower" } }, { status: "active" });
  const mara = await B.EntityService.save("cast", {
    id: "ab-mara", name: "Mara Vale",
    data: {
      currentLocation: { id: court.id, name: court.name, type: "locations" },
      locationHistory: [
        { id: "ab-move-1", from: null, to: { id: gate.id, name: gate.name, type: "locations" }, chapterId: "ab-ch1", sourceQuote: "Mara crossed Salt Gate." },
        { id: "ab-move-2", from: { id: gate.id, name: gate.name, type: "locations" }, to: { id: court.id, name: court.name, type: "locations" }, chapterId: "ab-ch2", sourceQuote: "Mara entered Lantern Court." },
      ],
    },
  }, { status: "active" });

  await B.ReviewService.add({
    id: "ab-review-location", entityType: "locations", name: "Whisper Wharf", status: "pending",
    suggestedAction: "create", sourceQuote: "They moored at Whisper Wharf.", chapterId: "ab-ch3",
  });

  await Atlas.setPlacement(gate.id, { mapId: "atlas-map-world", x: 20, y: 45 });
  await Atlas.setPlacement(court.id, { mapId: "atlas-map-world", x: 72, y: 38 });

  const current = Atlas.buildWorkspace({ anchorId: "current", branchId: "canonical" });
  check("Atlas reads only canonical location entities", current.locations.length === 3 && !current.locations.some((row) => row.name === "Pale Reach"), current.locations.map((row) => row.name).join(", "));
  check("placed and staged locations remain distinct", current.summary.placedCount === 2 && current.summary.stagedCount === 1);
  check("pending location reviews appear in the staging model", current.pendingUnplacedReviews.some((row) => row.id === "ab-review-location"));
  check("current snapshot positions Mara at Lantern Court", current.positions.some((row) => row.id === mara.id && row.locationId === court.id));
  check("travel route joins Salt Gate to Lantern Court", current.routes.some((route) => route.entityId === mara.id && route.waypoints.map((point) => point.locationId).join(",") === `${gate.id},${court.id}`));

  const chapterOne = Atlas.buildWorkspace({ anchorId: "ab-ch1", branchId: "canonical" });
  check("chapter scrub reconstructs Mara at Salt Gate", chapterOne.positions.some((row) => row.id === mara.id && row.locationId === gate.id));
  check("chapter scrub hides later route waypoints", chapterOne.routes.find((route) => route.entityId === mara.id)?.waypoints.length === 1);

  await Atlas.setPlacement(tower.id, { mapId: "atlas-map-world", x: 50, y: 18, source: "smoke" });
  const persisted = Atlas.loadStateSync();
  check("manual placement persists independently of canon", persisted.placements[tower.id]?.x === 50 && B.EntityService.getSync(tower.id, "locations")?.data?.mapPlacement == null);

  const nested = await Atlas.createMap({ name: "Lantern Court Interior", type: "building", parentMapId: "atlas-map-world", locationId: court.id });
  check("nested maps persist with canonical location links", Atlas.loadStateSync().maps.some((map) => map.id === nested.id && map.locationId === court.id));

  const branch = await World.createBranch({ name: "Mara Turns Back", fromAnchor: { type: "chapter", id: "ab-ch2", label: "Ch. 2 · Lantern Court" } });
  await World.addBranchDelta({
    branchId: branch.id,
    entityId: mara.id,
    path: "data.currentLocation",
    after: { id: gate.id, name: gate.name, type: "locations" },
    anchor: { type: "chapter", id: "ab-ch2", label: "Ch. 2 · Lantern Court" },
    kind: "alternative-travel",
    relatedEntityIds: [gate.id, court.id],
  });
  const branchView = Atlas.buildWorkspace({ anchorId: "current", branchId: branch.id, mapId: "atlas-map-world" });
  check("alternate branch projects a different current position", branchView.positions.some((row) => row.id === mara.id && row.locationId === gate.id));
  check("branch travel route ends at the branch-specific location", branchView.routes.find((route) => route.entityId === mara.id)?.waypoints.at(-1)?.locationId === gate.id);

  await Atlas.removePlacement(tower.id);
  const stagedAgain = Atlas.buildWorkspace({ mapId: "atlas-map-world" });
  check("returning a pin to staging is persistent", stagedAgain.stagedLocations.some((row) => row.id === tower.id));

  if (failures.length) {
    console.error(`\n${failures.length} live Atlas smoke assertion(s) failed.`);
    process.exit(1);
  }
  console.log("\nLive Atlas and travel smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
