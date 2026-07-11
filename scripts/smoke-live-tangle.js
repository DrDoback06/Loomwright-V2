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
  load(win, "live-tangle-service.jsx");

  const B = win.LoomwrightBackend;
  const Tangle = B.LiveTangleService;
  check("LiveTangleService extends LoomwrightBackend", !!Tangle);
  if (!Tangle) process.exit(1);

  const initial = Tangle.buildWorkspace();
  check("fresh Tangle starts with an honest empty board", initial.nodes.length === 0 && initial.boards.length === 1);
  check("fresh Tangle does not contain sample plot names", !JSON.stringify(initial).includes("Aelinor") && !JSON.stringify(initial).includes("Pale Reach"));

  const mara = await B.EntityService.save("cast", {
    id: "ac-mara", name: "Mara Vale", data: { summary: "A courier carrying an inherited debt." },
  }, { status: "active" });
  const key = await B.EntityService.save("items", {
    id: "ac-key", name: "Witness Key", data: { summary: "Records every transfer." },
  }, { status: "active" });

  const maraNode = await Tangle.addEntityNode("cast", mara.id, { id: "ac-node-mara", x: 120, y: 140 });
  const keyNode = await Tangle.addEntityNode("items", key.id, { id: "ac-node-key", x: 480, y: 140 });
  const note = await Tangle.addNode({ id: "ac-node-note", kind: "note", title: "The missing oath", body: "Decide who broke the first promise.", x: 300, y: 390 });
  let workspace = Tangle.buildWorkspace();
  check("canonical entities become live board nodes", workspace.nodes.filter((row) => row.entityId).length === 2);
  check("planning notes remain non-canonical", workspace.nodes.find((row) => row.id === note.id)?.entityId == null);

  await B.EntityService.update("cast", mara.id, { data: { summary: "A courier who now distrusts the court." } });
  workspace = Tangle.buildWorkspace();
  check("entity-node content follows the canonical entity", workspace.nodes.find((row) => row.id === maraNode.id)?.body.includes("distrusts the court"));

  await Tangle.moveNode(note.id, 777, 555);
  check("freeform node position persists", Tangle.loadStateSync().nodes.find((row) => row.id === note.id)?.x === 777 && Tangle.loadStateSync().nodes.find((row) => row.id === note.id)?.y === 555);

  const edge = await Tangle.connectNodes(maraNode.id, keyNode.id, { id: "ac-edge", label: "carries" });
  check("node connection persists with its label", Tangle.buildWorkspace().edges.some((row) => row.id === edge.id && row.label === "carries"));

  const group = await Tangle.createGroup({ id: "ac-group", name: "Oath cluster", nodeIds: [maraNode.id, note.id] });
  await Tangle.updateGroup(group.id, { collapsed: true });
  workspace = Tangle.buildWorkspace();
  check("groups preserve membership and collapsed state", workspace.groups.some((row) => row.id === group.id && row.collapsed && row.nodeIds.length === 2));
  check("group membership is reflected on nodes", workspace.nodes.filter((row) => row.groupId === group.id).length === 2);

  await Tangle.autoLayout(workspace.board.id);
  const laidOut = Tangle.buildWorkspace().nodes;
  check("auto-layout produces deterministic grid positions", laidOut.every((row) => Number.isFinite(row.x) && Number.isFinite(row.y)) && new Set(laidOut.map((row) => `${row.x},${row.y}`)).size === laidOut.length);

  const promoted = await Tangle.promoteNode(note.id, "quests", { name: "The Missing Oath", summary: "Discover who broke the first promise." });
  workspace = Tangle.buildWorkspace();
  const promotedNode = workspace.nodes.find((row) => row.id === note.id);
  check("promoting a note creates a canonical draft entity", promoted?.type === "quests" && B.EntityService.getSync(promoted.id, "quests")?.status === "draft");
  check("promotion keeps the planning node and links it live", promotedNode?.entityId === promoted.id && promotedNode?.title === "The Missing Oath");

  const secondBoard = await Tangle.createBoard({ id: "ac-board-two", name: "Alternate ending" });
  await Tangle.addNode({ id: "ac-board-two-note", boardId: secondBoard.id, title: "The key is never found", body: "Branch idea." });
  const secondWorkspace = Tangle.buildWorkspace({ boardId: secondBoard.id });
  const firstWorkspace = Tangle.buildWorkspace({ boardId: "tangle-board-main" });
  check("boards isolate their nodes", secondWorkspace.nodes.length === 1 && firstWorkspace.nodes.length === 3);
  check("active board persists", Tangle.loadStateSync().activeBoardId === secondBoard.id);

  const legacy = Tangle.normaliseState({
    nodes: [{ id: "legacy-node", kind: "note", title: "Old note", preview: "Legacy body", x: 20, y: 30 }],
    edges: [],
    groups: [],
  });
  check("legacy single-board archives migrate without sample seeding", legacy.boards.length === 1 && legacy.nodes[0].boardId === legacy.activeBoardId && legacy.nodes[0].body === "Legacy body");

  const persisted = Tangle.loadStateSync();
  check("complete multi-board state survives synchronous reload", persisted.boards.length === 2 && persisted.edges.length === 1 && persisted.groups.length === 1);

  if (failures.length) {
    console.error(`\n${failures.length} live Tangle smoke assertion(s) failed.`);
    process.exit(1);
  }
  console.log("\nLive Tangle board smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
