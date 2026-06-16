#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/hint-gen-check.js
 *
 * Deterministic verification for hint-seeded entity generation
 * (generateEntityFromHint). AIService.complete is monkeypatched to capture the
 * prompt and return a canned JSON, so we verify the pure behaviour without a
 * real model: world-grounding (existing entities + the author's brief land in
 * the prompt), schema shaping, that author-provided fields are NEVER
 * overwritten, and offline/error gating. Mirrors the other node harnesses.
 *
 * Run: node scripts/hint-gen-check.js   (npm run test:hintgen)
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");

const localStorageMap = new Map();
const idbStores = {};
function shimDoc() { return { addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { click() {}, setAttribute() {}, appendChild() {} }; }, body: { appendChild() {}, removeChild() {} } }; }
function shimEventTarget() { const l = {}; return { addEventListener(n, f) { (l[n] = l[n] || []).push(f); }, removeEventListener(n, f) { if (l[n]) l[n] = l[n].filter((x) => x !== f); }, dispatchEvent(e) { (l[e.type] || []).forEach((f) => { try { f(e); } catch (_) {} }); return true; } }; }
function shimIndexedDB() {
  const open = () => { const req = {}; setImmediate(() => {
    const db = { objectStoreNames: { contains: (n) => !!idbStores[n] }, createObjectStore(n) { idbStores[n] = idbStores[n] || new Map(); return idbStores[n]; },
      transaction() { return { objectStore(n) { idbStores[n] = idbStores[n] || new Map(); const s = idbStores[n]; return {
        get(k) { const r = {}; setImmediate(() => { r.result = s.get(k); r.onsuccess && r.onsuccess(); }); return r; },
        put(v, k) { s.set(k, v); const r = {}; setImmediate(() => r.onsuccess && r.onsuccess()); return r; },
        delete(k) { s.delete(k); const r = {}; setImmediate(() => r.onsuccess && r.onsuccess()); return r; } }; }, oncomplete: null }; } };
    idbStores.kv = idbStores.kv || new Map(); req.result = db; if (req.onupgradeneeded) req.onupgradeneeded(); if (req.onsuccess) req.onsuccess();
  }); return req; }; return { open };
}
function makeWindow() {
  const t = shimEventTarget();
  const win = { ...t, addEventListener: t.addEventListener, removeEventListener: t.removeEventListener, dispatchEvent: t.dispatchEvent,
    localStorage: { getItem: (k) => (localStorageMap.has(k) ? localStorageMap.get(k) : null), setItem: (k, v) => localStorageMap.set(k, String(v)), removeItem: (k) => localStorageMap.delete(k), clear: () => localStorageMap.clear() },
    indexedDB: shimIndexedDB(), crypto: { randomUUID: () => "u-" + Math.random().toString(36).slice(2, 10), getRandomValues: (a) => require("node:crypto").webcrypto.getRandomValues(a), subtle: require("node:crypto").webcrypto.subtle },
    document: shimDoc(), prompt: () => null, confirm: () => true, console, setTimeout, clearTimeout, setImmediate, TextEncoder, TextDecoder,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"), atob: (s) => Buffer.from(s, "base64").toString("binary"),
    CustomEvent: function (type, init) { return { type, detail: init?.detail || null }; }, fetch: async () => { throw new Error("no fetch"); },
    URL: { createObjectURL: () => "blob://stub", revokeObjectURL: () => {} }, Blob: function (p) { this.parts = p; }, navigator: { clipboard: { writeText: async () => true } } };
  win.window = win; return win;
}

async function main() {
  const win = makeWindow();
  win.ENTITY_SAMPLES = {}; win.CAST_SAMPLE = []; win.REFERENCES = {}; win.ONBOARDING_ANSWERS = {}; win.WR_DEMO_PROJECT = {}; win.PANEL_PRESETS = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "backend-services.jsx"), "utf8"), win, { filename: "backend-services.jsx" });
  await new Promise((r) => setTimeout(r, 60));
  // Real editor configs so the cast schema has real fillable fields.
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "entity-editor-configs.jsx"), "utf8"), win, { filename: "entity-editor-configs.jsx" });
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "entity-editor-configs-extended.jsx"), "utf8"), win, { filename: "entity-editor-configs-extended.jsx" });
  const B = win.LoomwrightBackend;
  if (!B || !B.generateEntityFromHint) { console.error("generateEntityFromHint not available."); process.exit(1); }

  const failures = []; let total = 0;
  const log = (label, ok, detail = "") => { total++; console.log(ok ? "  OK  " : " FAIL ", label, detail ? "— " + detail : ""); if (!ok) failures.push(label); };

  await B.StorageService.clear();
  await B.EntityService.save("cast", { name: "Graham" }, { status: "active" });

  const schema = B.enrichmentFieldSchema("cast");
  const fillField = schema.find((f) => ["text", "textarea", "longtext"].includes(f.kind) && f.id !== "summary") || schema.find((f) => f.id !== "summary") || schema[0];

  // Monkeypatch the model: capture the prompt, return a canned draft.
  let captured = null;
  B.AIService.complete = async (opts) => { captured = opts; return JSON.stringify({ name: "Graham II", summary: "A model-written summary.", [fillField.id]: "Model value." }); };

  const res = await B.generateEntityFromHint("cast", {
    name: "Steve",
    hint: "main character, best friends with Graham",
    currentData: { name: "Steve", summary: "Steve's own summary." },
    route: { providerId: "x", model: "y" },
  });

  log("returns ok with fields", res.ok === true && !!res.fields);
  log("grounds the prompt in an existing entity (Graham)", !!captured && /Graham/.test(captured.prompt));
  log("includes the author's brief", !!captured && /best friends with Graham/.test(captured.prompt));
  log("echoes the author-provided name into the prompt", !!captured && /Steve/.test(captured.prompt));
  log("uses the entityGeneration purpose", !!captured && captured.purpose === "entityGeneration");
  log("keeps the author's name (model name ignored)", res.ok && !("name" in res.fields), JSON.stringify(res.fields || {}));
  log("keeps the author's summary (only blanks are filled)", res.ok && !("summary" in res.fields));
  log("fills a blank field from the model", res.ok && (fillField.id in res.fields));

  // Offline gate: no provider route -> local mode, no model call.
  const off = await B.generateEntityFromHint("cast", { name: "Z", hint: "x", currentData: {}, route: null });
  log("no provider -> offline (local) mode", off.ok === false && off.mode === "local");

  // Bad model output -> graceful ai-error.
  B.AIService.complete = async () => "this is not json {";
  const bad = await B.generateEntityFromHint("cast", { name: "Q", route: { providerId: "x", model: "y" } });
  log("invalid model JSON -> ai-error", bad.ok === false && bad.mode === "ai-error");

  console.log(`\n${total - failures.length}/${total} hint-generation checks passed.`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
