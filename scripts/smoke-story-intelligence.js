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
    removeEventListener(name, fn) { listeners[name] = (listeners[name] || []).filter((x) => x !== fn); },
    dispatchEvent(evt) { (listeners[evt.type] || []).forEach((fn) => { try { fn(evt); } catch (_) {} }); return true; },
  };
}

function indexedDbShim() {
  return {
    open() {
      const req = {};
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
        req.result = db;
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
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
      getRandomValues: (arr) => crypto.webcrypto.getRandomValues(arr),
      subtle: crypto.webcrypto.subtle,
    },
    document: {
      addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
      createElement() { return { click() {}, setAttribute() {}, appendChild() {} }; },
      body: { appendChild() {}, removeChild() {} },
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
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    setTimeout,
    clearTimeout,
    setImmediate,
    console,
    ENTITY_SAMPLES: {},
    CAST_SAMPLE: [],
    REFERENCES: [],
    ONBOARDING_ANSWERS: {},
    WR_DEMO_PROJECT: {},
    PANEL_PRESETS: {},
  };
  win.window = win;
  return win;
}

function load(win, file) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), win, { filename: file });
}

async function main() {
  const failures = [];
  const check = (label, ok, detail = "") => {
    console.log(ok ? "  OK  " : " FAIL ", label, detail ? `— ${detail}` : "");
    if (!ok) failures.push(label);
  };

  const win = makeWindow();
  load(win, "backend-services.jsx");
  await new Promise((resolve) => setTimeout(resolve, 50));
  load(win, "story-intelligence.jsx");

  const B = win.LoomwrightBackend;
  const SI = B?.StoryIntelligenceService;
  check("StoryIntelligenceService is installed on the existing backend", !!SI);
  if (!SI) process.exit(1);

  const repeated = Array.from({ length: 170 }, (_, i) => `word${i}`).join(" ");
  await B.ManuscriptChapterService.save({
    chapters: [
      { id: "ch1", num: 1, title: "Arrival", bodyText: "Mara carried the key into the Salt Gate." },
      { id: "ch2", num: 2, title: "The Gate", bodyText: "The Salt Gate opened for Mara." },
      { id: "ch3", num: 3, title: "Silence", bodyText: "No one spoke her name." },
      { id: "ch4", num: 4, title: "Untracked", bodyText: repeated },
    ],
    activeChapterId: "ch4",
    manuscripts: {},
  });

  const loc = await B.EntityService.save("locations", {
    id: "loc-salt-gate",
    name: "Salt Gate",
    data: { summary: "A gate on the old road.", placed: false },
  }, { status: "active" });
  const cast = await B.EntityService.save("cast", {
    id: "cast-mara",
    name: "Mara Vale",
    aliases: ["Mara"],
    data: {
      summary: "A courier carrying an inherited debt.",
      currentLocation: { id: loc.id, name: loc.name, type: "locations" },
      goals: ["deliver the key"],
      oldMentor: { id: "missing-mentor", name: "The Grey Mentor", type: "cast" },
    },
  }, { status: "active" });
  const item = await B.EntityService.save("items", {
    id: "item-key",
    name: "Witness Key",
    data: { summary: "A key that records its users.", currentOwner: { id: cast.id, name: cast.name, type: "cast" }, currentLocation: { id: loc.id, name: loc.name, type: "locations" } },
  }, { status: "active" });
  const quest = await B.EntityService.save("quests", {
    id: "quest-debt",
    name: "Pay the Old Debt",
    data: { summary: "Deliver the key.", goal: "Reach the court.", participants: [{ id: cast.id, name: cast.name, type: "cast" }], steps: [{ id: "s1", title: "Cross the gate", status: "Active" }], status: "Active" },
  }, { status: "active" });

  await B.OccurrenceService.saveMany([
    { entityId: cast.id, entityType: "cast", exactText: "Mara", chapterId: "ch1", startOffset: 0, endOffset: 4 },
    { entityId: item.id, entityType: "items", exactText: "key", chapterId: "ch1", startOffset: 17, endOffset: 20 },
    { entityId: loc.id, entityType: "locations", exactText: "Salt Gate", chapterId: "ch1", startOffset: 30, endOffset: 39 },
    { entityId: loc.id, entityType: "locations", exactText: "Salt Gate", chapterId: "ch2", startOffset: 4, endOffset: 13 },
  ]);

  await B.ReviewService.add({
    id: "review-owner-change",
    entityType: "items",
    name: "Witness Key changes owner",
    existingEntityId: item.id,
    relatedEntityIds: [cast.id, loc.id, quest.id],
    suggestedAction: "update",
    suggestedChanges: { currentOwner: { id: quest.id, name: quest.name, type: "quests" } },
    chapterId: "ch2",
    sourceQuote: "The court claimed the Witness Key.",
    status: "pending",
  });

  const snapshot = SI.buildSnapshot();
  check("snapshot reads live entities", snapshot.entities.length >= 4, `${snapshot.entities.length} entities`);
  check("snapshot reads live chapters", snapshot.chapters.length === 4);
  check("snapshot builds reciprocal backlink indexes", snapshot.backlinks.get(cast.id)?.has(item.id));

  const profiles = SI.buildProfiles(snapshot);
  const castProfile = profiles.find((p) => p.entity.id === cast.id);
  const locProfile = profiles.find((p) => p.entity.id === loc.id);
  check("entity profile derives manuscript mention count", castProfile?.mentionCount === 1);
  check("entity profile derives chapter dormancy", castProfile?.dormantGap === 3, `gap ${castProfile?.dormantGap}`);
  check("entity profile reports missing dossier fields", castProfile?.missing.includes("personality") && castProfile?.missing.includes("voice"));
  check("entity profile detects dangling linked records", castProfile?.dangling.some((d) => d.id === "missing-mentor"));
  check("location profile detects Atlas staging need", locProfile?.unplaced === true);

  const impact = SI.buildReviewImpact(B.ReviewService.listSync().find((r) => r.id === "review-owner-change"), snapshot);
  check("review impact includes direct and spiderweb-linked records", impact.affected.some((e) => e.id === item.id) && impact.affected.some((e) => e.id === cast.id));
  check("review impact includes manuscript chapter reach", impact.chapters.some((c) => c.id === "ch1") && impact.chapters.some((c) => c.id === "ch2"));
  check("review impact calculates a non-trivial severity", ["medium", "high", "critical"].includes(impact.severity), impact.severity);

  const suggestions = SI.buildSuggestions({ snapshot, limit: 50 });
  check("Today detects untracked manuscript chapters", suggestions.some((s) => s.actionType === "extract-chapter" && s.chapterId === "ch4"));
  check("Today detects dormant cast from real occurrences", suggestions.some((s) => s.id === `intel-dormant-${cast.id}`));
  check("Today detects unplaced Atlas locations", suggestions.some((s) => s.id === `intel-unplaced-${loc.id}`));
  check("Today enriches review decisions with impact", suggestions.some((s) => s.reviewItemId === "review-owner-change" && s.impact?.affected?.length >= 3));
  check("Today surfaces incomplete but important dossiers", suggestions.some((s) => s.id === `intel-thin-${cast.id}`));
  check("Today includes a locally generated inspiration seed", suggestions.some((s) => s.actionType === "create-idea" && s.ideaSeed));

  const seed = SI.generateEntitySeed({ type: "events", nonce: 12345, snapshot });
  check("Idea Forge creates a structured local seed", seed.type === "events" && !!seed.name && !!seed.summary && seed.questions.length > 0);
  check("Idea Forge proposes links into the live project", seed.suggestedLinks.length > 0);
  const draft = await SI.createIdeaEntity(seed);
  check("Idea Forge saves through EntityService as a draft", draft.status === "draft" && B.EntityService.getSync(draft.id, "events")?.source === "idea-forge");
  check("Idea Forge draft enters the existing review flow", B.ReviewService.listSync("events").some((r) => r.entityId === draft.id));

  const dismissTarget = suggestions.find((s) => s.actionType === "extract-chapter");
  SI.dismissSuggestion(dismissTarget.id);
  check("dismissed Today suggestions are hidden", !SI.buildSuggestions({ limit: 50 }).some((s) => s.id === dismissTarget.id));
  SI.restoreDismissedSuggestions();
  check("dismissed Today suggestions can be restored", SI.buildSuggestions({ limit: 50 }).some((s) => s.id === dismissTarget.id));

  const dashboard = SI.buildDashboard();
  check("dashboard derives a bounded live story-health score", dashboard.storyHealth >= 0 && dashboard.storyHealth <= 100, dashboard.storyHealth);
  check("dashboard reports extraction coverage", dashboard.extractionCoverage > 0 && dashboard.extractionCoverage < 100, dashboard.extractionCoverage);
  check("dashboard counts high-impact review work", dashboard.pendingReviewCount >= 1);

  if (failures.length) {
    console.error(`\n${failures.length} story-intelligence smoke check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll story-intelligence smoke checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
