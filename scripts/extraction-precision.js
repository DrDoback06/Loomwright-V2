#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/extraction-precision.js
 *
 * A measured precision / recall / F1 harness for Loomwright's OFFLINE
 * entity-discovery engine (no AI provider). It loads backend-services.jsx
 * in a shimmed window (same approach as smoke-services.js), runs
 * `ExtractionService.runExtraction({ deep:false })` over a hand-labelled
 * corpus, and scores the discovered "create" candidates against gold.
 *
 * Why this exists: EXTRACTION_QUALITY_REPORT.md calls for "detector tuning
 * against real manuscript text" and notes the existing fixtures are
 * synthetic subset-checks, not a precision score. This gives an objective
 * bar so engine changes can be proven (before/after numbers), per the
 * user's ask that offline discovery be "spot on and precise."
 *
 * Scoring (per entity type + overall):
 *   - recall    = gold entities discovered with the correct type / gold
 *   - precision = discovered candidates that match a gold/allow / discovered
 *   - F1        = harmonic mean
 * Name matching is normalised (case, leading "the"/honorific, trailing
 * possessive 's) and token-subset aware ("Saren" matches "Saren of Hess").
 *
 * Run: node scripts/extraction-precision.js
 * Exit code is non-zero if any explicit regression CHECK fails (so it can
 * gate CI), but the P/R/F1 table always prints.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

// ---------------- Minimal browser-like sandbox (mirrors smoke-services.js)
const localStorageMap = new Map();
const idbStores = {};
function shimDoc() {
  return {
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return { click() {}, setAttribute() {}, appendChild() {} }; },
    body: { appendChild() {}, removeChild() {} },
  };
}
function shimEventTarget() {
  const listeners = {};
  return {
    listeners,
    addEventListener(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    removeEventListener(name, fn) { if (listeners[name]) listeners[name] = listeners[name].filter((f) => f !== fn); },
    dispatchEvent(evt) { (listeners[evt.type] || []).forEach((fn) => { try { fn(evt); } catch (_) {} }); return true; },
  };
}
function shimIndexedDB() {
  const open = () => {
    const req = {};
    setImmediate(() => {
      const db = {
        objectStoreNames: { contains: (n) => !!idbStores[n] },
        createObjectStore(name) { idbStores[name] = idbStores[name] || new Map(); return idbStores[name]; },
        transaction() {
          return {
            objectStore(name) {
              idbStores[name] = idbStores[name] || new Map();
              const store = idbStores[name];
              return {
                get(key) { const r = {}; setImmediate(() => { r.result = store.get(key); r.onsuccess && r.onsuccess(); }); return r; },
                put(value, key) { store.set(key, value); const r = {}; setImmediate(() => r.onsuccess && r.onsuccess()); return r; },
                delete(key) { store.delete(key); const r = {}; setImmediate(() => r.onsuccess && r.onsuccess()); return r; },
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
      subtle: require("node:crypto").webcrypto.subtle,
    },
    document: shimDoc(),
    prompt: () => null, confirm: () => true, console,
    setTimeout, clearTimeout, setImmediate,
    TextEncoder, TextDecoder,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    CustomEvent: function (type, init) { return { type, detail: init?.detail || null }; },
    fetch: async () => { throw new Error("fetch not available in precision harness"); },
    URL: { createObjectURL: () => "blob://stub", revokeObjectURL: () => {} },
    Blob: function (parts) { this.parts = parts; },
    navigator: { clipboard: { writeText: async () => true } },
  };
  win.window = win;
  return win;
}
function loadService(win, relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  vm.runInNewContext(code, win, { filename: relPath });
}

// ---------------- Labelled corpus -------------------------------------
// gold:  entities that MUST be discovered with the right type (recall).
// allow: names acceptable if found but not required, and not penalised as
//        false positives (ambiguous/known-limitation cases).
// checks: explicit named regression assertions for the report.
const CORPUS = [
  {
    name: "saren-variants+possessive",
    text:
      'Saren of Hess crossed Vraska Pass before dawn. "We have no time," Saren muttered to the wind. ' +
      "General Vorrik's outriders watched from the ridge, and Saren counted them twice.",
    gold: { cast: ["Saren", "Vorrik"], locations: ["Vraska Pass"] },
    allow: ["Hess"],
    checks: [
      ["discovers recurring lead 'Saren' (variant unification)", (d) => hasCand(d, "cast", "Saren")],
      ["strips possessive: 'Vorrik' not 'Vorrik's'", (d) => hasCand(d, "cast", "Vorrik") && !d.some((c) => /vorrik['’]s/i.test(c.name))],
      ["does not emit a separate 'Saren of Hess' cast card", (d) => d.filter((c) => c.entityType === "cast" && /saren/i.test(c.name)).length === 1],
    ],
  },
  {
    name: "location-headnoun-within-surface",
    text:
      "The bells of the Pale Cathedral rang at midnight. Morwen knelt before the Pale Cathedral and prayed.",
    gold: { locations: ["Pale Cathedral"], cast: ["Morwen"] },
    allow: [],
    checks: [
      ["'Pale Cathedral' classified as location (head-noun)", (d) => hasCand(d, "locations", "Pale Cathedral")],
      ["'Pale Cathedral' NOT misfiled as cast/event", (d) => !d.some((c) => /pale cathedral/i.test(c.name) && c.entityType !== "locations")],
    ],
  },
  {
    name: "dialogue-and-action-cast",
    text:
      '"Hold the line," said Theron. Theron raised his shield as the charge broke. ' +
      "Across the mud, Brannick only laughed.",
    gold: { cast: ["Theron", "Brannick"] },
    allow: [],
    checks: [
      ["dialogue tag -> 'Theron' cast", (d) => hasCand(d, "cast", "Theron")],
      ["action verb -> single-mention 'Brannick' cast", (d) => hasCand(d, "cast", "Brannick")],
    ],
  },
  {
    name: "item-cues",
    text:
      "Aelinor drew the Sunblade and raised it high. The Sunblade burned with pale fire. She sheathed the weapon and turned away.",
    gold: { cast: ["Aelinor"], items: ["Sunblade"] },
    allow: [],
    checks: [["'Sunblade' classified as item", (d) => hasCand(d, "items", "Sunblade")]],
  },
  {
    name: "location-of-and-headnoun",
    text: "They rode hard to the Keep of Ashfall. Beyond the walls lay the Drowned Marsh, grey and endless.",
    gold: { locations: ["Keep of Ashfall", "Drowned Marsh"] },
    allow: [],
    checks: [
      ["'Drowned Marsh' -> location (head-noun)", (d) => hasCand(d, "locations", "Drowned Marsh")],
      ["'Keep of Ashfall' -> location (kind token)", (d) => d.some((c) => c.entityType === "locations" && /ashfall/i.test(c.name))],
    ],
  },
  {
    name: "false-positive-control",
    text:
      "Time passed slowly that winter. Morning came grey and cold. The Captain said nothing at all. " +
      "Later, Spring arrived without ceremony.",
    gold: {},
    allow: [],
    checks: [
      ["no capitalised-common-noun cards (Time/Morning/Spring)", (d) => !d.some((c) => /^(time|morning|spring|winter|later)$/i.test(c.name.trim()))],
      ["bare honorific 'Captain' not discovered as cast", (d) => !d.some((c) => /^(the\s+)?captain$/i.test(c.name.trim()))],
    ],
  },
  {
    name: "action-verb-singletons",
    text: "Korrin sharpened his knife beside the embers. Nearby, Wend whittled a length of pine.",
    gold: { cast: ["Korrin", "Wend"] },
    allow: ["Nearby"],
    checks: [["single-mention action subjects discovered", (d) => hasCand(d, "cast", "Korrin") && hasCand(d, "cast", "Wend")]],
  },
  {
    name: "mixed-types",
    text: "The Grey Order marched at dawn. Lyssa carried the Hollow Crown into the Sundered Hall.",
    gold: { cast: ["Lyssa"], locations: ["Sundered Hall"] },
    allow: ["Grey Order", "Hollow Crown"],
    checks: [["'Sundered Hall' -> location (head-noun)", (d) => hasCand(d, "locations", "Sundered Hall")]],
  },
];

// ---------------- Name matching ---------------------------------------
const HONORIFICS = /^(?:captain|lord|lady|ser|sir|dame|king|queen|prince|princess|commander|lieutenant|colonel|major|sergeant|master|mistress|maester|archon|general|admiral|doctor|dr|professor|mr|mrs|ms|miss|father|brother|sister|aunt|uncle|saint|st|emperor|empress|duke|duchess|baron|baroness|count|countess)\.?\s+/i;
const CONNECTORS = new Set(["of", "the", "de", "von", "van", "al", "da", "di", "del", "la", "le"]);
function norm(s) {
  return String(s || "").trim().toLowerCase()
    .replace(/^the\s+/, "")
    .replace(HONORIFICS, "")
    .replace(/['’]s?$/, "")
    .replace(/\s+/g, " ")
    .trim();
}
function sigTokens(s) { return norm(s).split(" ").filter((t) => t && !CONNECTORS.has(t)); }
function nameMatch(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = new Set(sigTokens(a)), tb = sigTokens(b);
  if (tb.length && tb.every((t) => ta.has(t))) return true; // b ⊆ a
  const ta2 = sigTokens(a), tb2 = new Set(sigTokens(b));
  if (ta2.length && ta2.every((t) => tb2.has(t))) return true; // a ⊆ b
  return false;
}
function hasCand(discovered, type, name) {
  return discovered.some((c) => c.entityType === type && nameMatch(c.name, name));
}

function pct(n, d) { return d === 0 ? 1 : n / d; }
function f1(p, r) { return p + r === 0 ? 0 : (2 * p * r) / (p + r); }
function fmt(x) { return (x * 100).toFixed(1).padStart(5) + "%"; }

async function main() {
  const win = makeWindow();
  win.ENTITY_SAMPLES = {}; win.CAST_SAMPLE = []; win.REFERENCES = [];
  win.ONBOARDING_ANSWERS = {}; win.WR_DEMO_PROJECT = {}; win.PANEL_PRESETS = {};
  loadService(win, "backend-services.jsx");
  await new Promise((r) => setTimeout(r, 60));
  const B = win.LoomwrightBackend;
  if (!B) { console.error("Backend did not initialise."); process.exit(1); }

  // Per-type tallies: tp (gold found), fn (gold missed), fp (junk emitted).
  const tally = {}; // type -> { tp, fn, fp }
  const bump = (t, k) => { (tally[t] = tally[t] || { tp: 0, fn: 0, fp: 0 })[k]++; };
  const checkResults = [];
  let typeErrors = 0;

  for (const item of CORPUS) {
    await B.StorageService.clear();
    win.__LW_SAMPLE_LOADED__ = false; win.ENTITY_SAMPLES = {}; win.CAST_SAMPLE = [];
    await B.SettingsService.saveSection("extraction", {
      aggressiveness: "balanced", autoAdd95: false, showAutoAddedInReview: true, threshold: 50, scan: {},
    });
    await B.ExtractionService.runExtraction({ chapterId: "p-" + item.name, text: item.text, deep: false });
    const discovered = B.StorageService.getSync(B.keys.reviewQueue, [])
      .filter((q) => q.chapterId === "p-" + item.name && q.suggestedAction === "create" && q.name);
    if (process.env.DEBUG) console.log(`  [${item.name}] ->`, discovered.map((c) => `${c.entityType}:${c.name}`).join("  |  ") || "(none)");

    // Recall: every gold (type,name) must be discovered with that type.
    for (const [type, names] of Object.entries(item.gold || {})) {
      for (const gName of names) {
        if (discovered.some((c) => c.entityType === type && nameMatch(c.name, gName))) bump(type, "tp");
        else {
          bump(type, "fn");
          // Was it found under the WRONG type? (diagnostic)
          if (discovered.some((c) => nameMatch(c.name, gName))) typeErrors++;
        }
      }
    }
    // Precision: every discovered candidate must match a gold/allow.
    const goldFlat = Object.entries(item.gold || {}).flatMap(([type, ns]) => ns.map((n) => ({ type, name: n })));
    for (const c of discovered) {
      const okGold = goldFlat.some((g) => g.type === c.entityType && nameMatch(g.name, c.name));
      const okAllow = (item.allow || []).some((a) => nameMatch(a, c.name));
      if (!okGold && !okAllow) bump(c.entityType, "fp");
    }
    // Explicit regression checks.
    for (const [label, fn] of item.checks || []) {
      let ok = false; try { ok = !!fn(discovered); } catch (_) {}
      checkResults.push([item.name, label, ok]);
    }
  }

  // ---- Report ----
  console.log("\n=== Offline extraction — precision / recall ===\n");
  console.log("type          precision   recall      F1     (tp/fn/fp)");
  console.log("------------------------------------------------------------");
  let TP = 0, FN = 0, FP = 0;
  for (const type of Object.keys(tally).sort()) {
    const { tp, fn, fp } = tally[type];
    TP += tp; FN += fn; FP += fp;
    const p = pct(tp, tp + fp), r = pct(tp, tp + fn);
    console.log(`${type.padEnd(12)}  ${fmt(p)}     ${fmt(r)}   ${fmt(f1(p, r))}   (${tp}/${fn}/${fp})`);
  }
  const P = pct(TP, TP + FP), R = pct(TP, TP + FN);
  console.log("------------------------------------------------------------");
  console.log(`${"OVERALL".padEnd(12)}  ${fmt(P)}     ${fmt(R)}   ${fmt(f1(P, R))}   (${TP}/${FN}/${FP})`);
  if (typeErrors) console.log(`\n(${typeErrors} gold entit${typeErrors === 1 ? "y" : "ies"} found under the WRONG type)`);

  console.log("\n=== Regression checks ===\n");
  let failed = 0;
  for (const [passage, label, ok] of checkResults) {
    console.log(`${ok ? " OK  " : "FAIL "} [${passage}] ${label}`);
    if (!ok) failed++;
  }
  console.log(`\n${checkResults.length - failed}/${checkResults.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
