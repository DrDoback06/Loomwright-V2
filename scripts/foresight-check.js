#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/foresight-check.js
 *
 * Deterministic verification for the widened InsightService foresight engine
 * (zero-token, offline). Seeds a small project — chapters, cast, items, lore,
 * occurrences and a relationship graph — then asserts each detector fires when
 * it should and stays quiet when it shouldn't, including the per-character
 * `computeForEntity` scoping. Mirrors scripts/extraction-precision.js.
 *
 * Run: node scripts/foresight-check.js   (npm run test:foresight)
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");

// ---------------- Browser-like sandbox (mirrors smoke-services.js) ----
const localStorageMap = new Map();
const idbStores = {};
function shimDoc() {
  return { addEventListener() {}, removeEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, createElement() { return { click() {}, setAttribute() {}, appendChild() {} }; },
    body: { appendChild() {}, removeChild() {} } };
}
function shimEventTarget() {
  const listeners = {};
  return { listeners,
    addEventListener(n, fn) { (listeners[n] = listeners[n] || []).push(fn); },
    removeEventListener(n, fn) { if (listeners[n]) listeners[n] = listeners[n].filter((f) => f !== fn); },
    dispatchEvent(e) { (listeners[e.type] || []).forEach((fn) => { try { fn(e); } catch (_) {} }); return true; } };
}
function shimIndexedDB() {
  const open = () => {
    const req = {};
    setImmediate(() => {
      const db = {
        objectStoreNames: { contains: (n) => !!idbStores[n] },
        createObjectStore(n) { idbStores[n] = idbStores[n] || new Map(); return idbStores[n]; },
        transaction() {
          return { objectStore(n) {
            idbStores[n] = idbStores[n] || new Map();
            const store = idbStores[n];
            return {
              get(k) { const r = {}; setImmediate(() => { r.result = store.get(k); r.onsuccess && r.onsuccess(); }); return r; },
              put(v, k) { store.set(k, v); const r = {}; setImmediate(() => r.onsuccess && r.onsuccess()); return r; },
              delete(k) { store.delete(k); const r = {}; setImmediate(() => r.onsuccess && r.onsuccess()); return r; },
            };
          }, oncomplete: null };
        },
      };
      idbStores.kv = idbStores.kv || new Map();
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
  const win = { ...target,
    addEventListener: target.addEventListener, removeEventListener: target.removeEventListener, dispatchEvent: target.dispatchEvent,
    localStorage: { getItem: (k) => (localStorageMap.has(k) ? localStorageMap.get(k) : null),
      setItem: (k, v) => localStorageMap.set(k, String(v)), removeItem: (k) => localStorageMap.delete(k), clear: () => localStorageMap.clear() },
    indexedDB: shimIndexedDB(),
    crypto: { randomUUID: () => "u-" + Math.random().toString(36).slice(2, 10),
      getRandomValues: (a) => require("node:crypto").webcrypto.getRandomValues(a), subtle: require("node:crypto").webcrypto.subtle },
    document: shimDoc(), prompt: () => null, confirm: () => true, console,
    setTimeout, clearTimeout, setImmediate, TextEncoder, TextDecoder,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"), atob: (s) => Buffer.from(s, "base64").toString("binary"),
    CustomEvent: function (type, init) { return { type, detail: init?.detail || null }; },
    fetch: async () => { throw new Error("no fetch"); },
    URL: { createObjectURL: () => "blob://stub", revokeObjectURL: () => {} },
    Blob: function (p) { this.parts = p; }, navigator: { clipboard: { writeText: async () => true } } };
  win.window = win;
  return win;
}

async function main() {
  const win = makeWindow();
  win.ENTITY_SAMPLES = {}; win.CAST_SAMPLE = []; win.REFERENCES = {};
  win.ONBOARDING_ANSWERS = {}; win.WR_DEMO_PROJECT = {}; win.PANEL_PRESETS = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "backend-services.jsx"), "utf8"), win, { filename: "backend-services.jsx" });
  await new Promise((r) => setTimeout(r, 60));
  const B = win.LoomwrightBackend;
  if (!B || !B.InsightService) { console.error("InsightService not available."); process.exit(1); }

  const failures = [];
  let total = 0;
  const log = (label, ok, detail = "") => { total++; console.log(ok ? "  OK  " : " FAIL ", label, detail ? "— " + detail : ""); if (!ok) failures.push(label); };

  await B.StorageService.clear();

  // ---- Seed chapters 1..6 (text only where a detector reads prose) ----
  const chapters = [];
  const manuscripts = {};
  for (let n = 1; n <= 6; n++) chapters.push({ id: "ch" + n, num: n, title: "Chapter " + n, state: "saved" });
  manuscripts.ch1 = { text: "Mira had warm brown hair and a quick smile that morning." };
  manuscripts.ch2 = { text: "By the docks, Mira's silver hair caught the lantern light." };
  await B.ManuscriptChapterService.save({ chapters, activeChapterId: "ch1", manuscripts, trashedChapters: [] });

  // ---- Seed cast ----
  const cast = {};
  for (const name of ["Garrent", "Steady", "Aldric", "Bren", "Cass", "Dorn", "Mira"]) {
    cast[name] = await B.EntityService.save("cast", { name, data: { role: "supporting", goals: ["x"], backstory: "seeded" } }, { status: "active" });
  }

  // ---- Seed items + lore ----
  const crown = await B.EntityService.save("items", { name: "Crown of Ash", data: { rarity: "Legendary", itemType: "regalia" } }, { status: "active" });
  await B.EntityService.save("items", { name: "Old Knife", data: { rarity: "Common", itemType: "tool", currentOwner: "x" } }, { status: "active" });
  const prophecy = await B.EntityService.save("lore", { name: "Pale Prophecy", data: { band: "provisional", body: "A king will fall." } }, { status: "active" });
  await B.EntityService.save("lore", { name: "Founding Date", data: { band: "canon", body: "Year 0." } }, { status: "active" });

  // ---- Seed occurrences (entity appearances per chapter) ----
  const occ = (ent, chN) => B.OccurrenceService.save({ entityId: ent.id, entityType: ent.type, exactText: ent.name, chapterId: "ch" + chN, startOffset: 0, endOffset: ent.name.length });
  await occ(cast.Garrent, 1); await occ(cast.Garrent, 6);          // absence gap (1 -> 6)
  await occ(cast.Steady, 5); await occ(cast.Steady, 6);            // control: no gap
  await occ(cast.Aldric, 1); await occ(cast.Aldric, 2);            // tension pair shares Ch1-2
  await occ(cast.Bren, 1); await occ(cast.Bren, 2);
  await occ(cast.Cass, 1);                                          // bonded-apart: never co-occur
  await occ(cast.Dorn, 3);
  await occ(crown, 1);                                             // significant item, single mention

  // ---- Seed relationships (parties under data, per LinkService) ----
  await B.EntityService.save("relationships", { name: "Aldric ⚔ Bren",
    data: { fromId: cast.Aldric.id, toId: cast.Bren.id, bondType: "rival", conflict: 70, strength: 55 } }, { status: "active" });
  await B.EntityService.save("relationships", { name: "Cass & Dorn",
    data: { fromId: cast.Cass.id, toId: cast.Dorn.id, bondType: "ally", strength: 60 } }, { status: "active" });

  B.InsightService.bump();
  const insights = B.InsightService.computeInsights().insights || [];
  const find = (pred) => insights.find(pred);
  const has = (pred) => insights.some(pred);

  // ---- Assertions ----
  log("[gap] flags a mid-story disappearance (Garrent Ch1->Ch6)",
    has((i) => i.kind === "absence-gap" && i.entityRef.id === cast.Garrent.id));
  log("[gap] does NOT flag a continuously-present character (Steady)",
    !has((i) => i.kind === "absence-gap" && i.entityRef.id === cast.Steady.id));

  const quiet = find((i) => i.kind === "relationship-thread" && i.relatedIds && i.relatedIds.includes(cast.Aldric.id) && i.relatedIds.includes(cast.Bren.id));
  log("[rel] flags a high-tension bond gone quiet (Aldric/Bren)", !!quiet, quiet ? quiet.title : "");
  log("[rel] tension insight is severity warn", !!quiet && quiet.severity === "warn");

  const apart = find((i) => i.kind === "relationship-thread" && i.relatedIds && i.relatedIds.includes(cast.Cass.id) && i.relatedIds.includes(cast.Dorn.id));
  log("[rel] flags a recorded bond whose parties never share a scene (Cass/Dorn)", !!apart, apart ? apart.title : "");

  log("[payoff] flags a significant item never used (Crown of Ash)",
    has((i) => i.kind === "promise-payoff" && i.entityRef.id === crown.id));
  log("[payoff] does NOT flag a common item (Old Knife)",
    !has((i) => i.kind === "promise-payoff" && /old knife/i.test(i.entityRef.label || "")));
  log("[payoff] flags unresolved provisional lore (Pale Prophecy)",
    has((i) => i.kind === "promise-payoff" && i.entityRef.id === prophecy.id));
  log("[payoff] does NOT flag canon lore (Founding Date)",
    !has((i) => i.kind === "promise-payoff" && /founding/i.test(i.entityRef.label || "")));

  log("[contradiction] catches hair-colour drift across chapters (Mira)",
    has((i) => i.kind === "contradiction" && i.entityRef.id === cast.Mira.id && /hair/i.test(i.title)));

  // ---- computeForEntity scoping ----
  const garrentScoped = B.InsightService.computeForEntity(cast.Garrent.id).insights || [];
  log("[scope] computeForEntity(Garrent) includes his gap",
    garrentScoped.some((i) => i.kind === "absence-gap"));
  log("[scope] computeForEntity(Garrent) excludes unrelated insights",
    !garrentScoped.some((i) => i.entityRef.id === crown.id));
  const aldricScoped = B.InsightService.computeForEntity(cast.Aldric.id).insights || [];
  log("[scope] computeForEntity(Aldric) includes his relationship thread",
    aldricScoped.some((i) => i.kind === "relationship-thread"));

  // ---- determinism / cache ----
  const a = B.InsightService.computeInsights();
  const b = B.InsightService.computeInsights();
  log("[cache] repeated compute returns the identical cached object", a === b);
  B.InsightService.bump();
  log("[cache] bump forces a fresh recompute", B.InsightService.computeInsights() !== a);

  console.log(`\n${total - failures.length}/${total} foresight checks passed.`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
