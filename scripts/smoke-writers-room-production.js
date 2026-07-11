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

async function main() {
  const failures = [];
  const check = (label, okay, detail = "") => {
    console.log(okay ? "  OK  " : " FAIL ", label, detail ? `— ${detail}` : "");
    if (!okay) failures.push(label);
  };

  const events = eventTarget();
  const body = {
    innerHTML: "<p data-paragraph-id=\"p1\">Opening line.</p>",
    dispatchEvent() { return true; },
  };
  const title = { innerText: "Chapter One", textContent: "Chapter One" };
  const canvas = { getAttribute(name) { return name === "data-chapter-id" ? "wr-ch1" : null; } };
  const document = {
    addEventListener() {}, removeEventListener() {},
    querySelector(selector) {
      if (selector === "[data-testid='wr-manuscript-body']") return body;
      if (selector === "[data-ui='ManuscriptTitle']") return title;
      if (selector.includes("ManuscriptCanvas")) return canvas;
      return null;
    },
    querySelectorAll() { return []; },
    createElement() { return { click() {}, setAttribute() {}, appendChild() {}, classList: { add() {} } }; },
    body: { appendChild() {}, removeChild() {} },
  };
  const win = {
    ...events,
    document,
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
    CustomEvent: function CustomEvent(type, init) { return { type, detail: init?.detail || null }; },
    InputEvent: function InputEvent(type, init) { return { type, ...init }; },
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
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
  const load = (file) => vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), win, { filename: file });

  load("backend-services.jsx");
  await new Promise((resolve) => setTimeout(resolve, 50));
  load("writers-room-production-service.jsx");
  const service = win.LoomwrightBackend?.WriterRoomProductionService;
  check("WriterRoomProductionService extends the existing backend", !!service);
  if (!service) process.exit(1);

  const matches = service._test.findMatchesInText("Ash ash ASH", "ash", { caseSensitive: false });
  check("find helper returns every case-insensitive match", matches.length === 3, matches.length);
  check("case-sensitive find remains exact", service._test.findMatchesInText("Ash ash", "Ash", { caseSensitive: true }).length === 1);

  const reordered = service._test.reorderState({ chapters: [
    { id: "a", num: 1, title: "A" },
    { id: "b", num: 2, title: "B" },
    { id: "c", num: 3, title: "C" },
  ], activeChapterId: "a", manuscripts: {} }, "c", "a", "before");
  check("chapter reorder is deterministic", reordered.chapters.map((row) => row.id).join(",") === "c,a,b");
  check("chapter reorder renumbers narrative order", reordered.chapters.map((row) => row.num).join(",") === "1,2,3");

  await win.LoomwrightBackend.ManuscriptChapterService.save({
    chapters: [{ id: "a", num: 1 }, { id: "b", num: 2 }, { id: "c", num: 3 }],
    activeChapterId: "a",
    manuscripts: {},
  });
  await service.reorderChapter("c", "a", "before");
  check("runtime reorder persists through ManuscriptChapterService", win.LoomwrightBackend.ManuscriptChapterService.loadSync().chapters.map((row) => row.id).join(",") === "c,a,b");

  await service.capture("seed", { force: true });
  body.innerHTML = "<h2 data-paragraph-id=\"p1\" data-block-type=\"heading\">Opening line.</h2>";
  title.innerText = "Changed title";
  await service.capture("structured-edit", { force: true });
  const history = service.historyState().byChapter["wr-ch1"];
  check("structured history stores bounded snapshots", history.entries.length === 2 && history.index === 1);
  await service.undo();
  check("undo restores manuscript HTML", body.innerHTML.includes("<p"), body.innerHTML);
  check("undo restores chapter title", title.textContent === "Chapter One" || title.innerText === "Chapter One");
  await service.redo();
  check("redo restores structured heading", body.innerHTML.includes("<h2"), body.innerHTML);

  const note = await win.LoomwrightBackend.ManuscriptNoteService.createNote({
    chapterId: "wr-ch1", paragraphId: "p1", quote: "Opening", rangeStart: 0, rangeEnd: 7,
    noteText: "Exact range", source: "selection-range", anchorVersion: { textLength: 13 },
  });
  const persistedNote = win.LoomwrightBackend.ManuscriptNoteService.listByChapterSync("wr-ch1").find((row) => row.id === note.id);
  check("range comment preserves exact offsets", persistedNote?.rangeStart === 0 && persistedNote?.rangeEnd === 7);
  check("range comment preserves anchor metadata", persistedNote?.anchorVersion?.textLength === 13);

  if (failures.length) {
    console.error(`\n${failures.length} production Writer's Room smoke assertion(s) failed.`);
    process.exit(1);
  }
  console.log("\nProduction Writer's Room smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
