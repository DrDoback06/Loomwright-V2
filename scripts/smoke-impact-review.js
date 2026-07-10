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
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
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
  const check = (label, ok, detail = "") => {
    console.log(ok ? "  OK  " : " FAIL ", label, detail ? `— ${detail}` : "");
    if (!ok) failures.push(label);
  };

  const win = makeWindow();
  load(win, "backend-services.jsx");
  await new Promise((resolve) => setTimeout(resolve, 50));
  load(win, "story-intelligence.jsx");
  load(win, "story-intelligence-rules.jsx");
  load(win, "impact-review-service.jsx");
  load(win, "impact-review-receipt-rules.jsx");

  const B = win.LoomwrightBackend;
  const IR = B.ImpactReviewService;
  check("ImpactReviewService extends the existing backend", !!IR);
  if (!IR) process.exit(1);

  await B.ManuscriptChapterService.save({
    chapters: [
      { id: "ir-ch1", num: 1, title: "The Transfer", bodyText: "Mara gave the Witness Key to Soren at Salt Gate." },
      { id: "ir-ch2", num: 2, title: "The Debt", bodyText: "The debt followed them into the city." },
    ],
    activeChapterId: "ir-ch1", manuscripts: {},
  });

  const mara = await B.EntityService.save("cast", { id: "ir-mara", name: "Mara Vale", data: { summary: "A courier." } }, { status: "active" });
  const soren = await B.EntityService.save("cast", { id: "ir-soren", name: "Soren Grey", data: { summary: "A reluctant heir." } }, { status: "active" });
  const gate = await B.EntityService.save("locations", { id: "ir-gate", name: "Salt Gate", data: { summary: "A border gate.", placed: true } }, { status: "active" });
  const quest = await B.EntityService.save("quests", {
    id: "ir-quest", name: "Pay the Old Debt",
    data: { summary: "Settle the inherited debt.", participants: [{ id: mara.id, name: mara.name, type: "cast" }, { id: soren.id, name: soren.name, type: "cast" }], locations: [{ id: gate.id, name: gate.name, type: "locations" }] },
  }, { status: "active" });
  const key = await B.EntityService.save("items", {
    id: "ir-key", name: "Witness Key",
    data: { summary: "Records every transfer.", currentOwner: { id: mara.id, name: mara.name, type: "cast" }, currentLocation: { id: gate.id, name: gate.name, type: "locations" }, relatedQuests: [{ id: quest.id, name: quest.name, type: "quests" }] },
  }, { status: "active" });

  await B.OccurrenceService.saveMany([
    { occurrenceId: "ir-occ-mara", entityId: mara.id, entityType: "cast", exactText: "Mara", chapterId: "ir-ch1", startOffset: 0, endOffset: 4 },
    { occurrenceId: "ir-occ-key", entityId: key.id, entityType: "items", exactText: "Witness Key", chapterId: "ir-ch1", startOffset: 14, endOffset: 25 },
    { occurrenceId: "ir-occ-soren", entityId: soren.id, entityType: "cast", exactText: "Soren", chapterId: "ir-ch1", startOffset: 29, endOffset: 34 },
    { occurrenceId: "ir-occ-candidate", candidateId: "ir-candidate", entityId: null, entityType: "items", exactText: "gave", chapterId: "ir-ch1", startOffset: 5, endOffset: 9 },
  ]);

  await B.ReviewService.add({
    id: "ir-review", candidateId: "ir-candidate", entityType: "items", name: "Witness Key changes owner", status: "pending",
    existingEntityId: key.id, relatedEntityIds: [mara.id, soren.id, gate.id, quest.id], suggestedAction: "update",
    suggestedChanges: { currentOwner: { id: soren.id, name: soren.name, type: "cast" } },
    chapterId: "ir-ch1", paragraphId: "p1", sourceQuote: "Mara gave the Witness Key to Soren at Salt Gate.", matchType: "inferred",
  });

  const analysis = IR.analyse("ir-review");
  check("analysis includes stored evidence", analysis.evidence.some((e) => e.quote.includes("Witness Key")));
  check("analysis builds a before/after owner change", analysis.changes.some((c) => c.fieldKey === "currentOwner" && c.key === "Current owner" && c.before?.id === mara.id && c.after?.id === soren.id));
  check("analysis calculates linked spiderweb entities", analysis.impact.affected.some((e) => e.id === quest.id) && analysis.impact.affected.some((e) => e.id === gate.id));
  check("analysis includes affected chapters", analysis.impact.chapters.some((c) => c.id === "ir-ch1"));
  check("analysis provides consequence guidance", analysis.hints.some((h) => /ownership/i.test(h)));

  await IR.postpone("ir-review", "Need Soren's point of view");
  check("postpone preserves the review with a reason", IR.getItemSync("ir-review")?.status === "postponed" && IR.getItemSync("ir-review")?.decision?.reason.includes("Soren"));
  await IR.resume("ir-review");
  check("resume returns the decision to pending", IR.getItemSync("ir-review")?.status === "pending");

  const scenario = await IR.createScenario("ir-review", "Soren refuses the key");
  check("scenario exploration creates a non-canon reference", scenario?.kind === "scenario" && scenario?.reviewScenario?.committed === false);
  check("scenario links the affected entity spiderweb", scenario?.linkedEntities?.some((e) => e.id === key.id));
  await IR.resume("ir-review");

  const beforeOwner = B.EntityService.getSync(key.id, "items").data.currentOwner.id;
  const beforeOccurrence = B.OccurrenceService.listAllSync().find((o) => o.occurrenceId === "ir-occ-candidate");
  await IR.acceptWithReceipt("ir-review", async (item) => {
    const current = B.EntityService.getSync(key.id, "items");
    await B.EntityService.update("items", key.id, { data: { ...current.data, ...item.suggestedChanges } });
    await B.OccurrenceService.linkCandidateToEntity(item.candidateId, key.id, "items");
    await B.ReviewService.resolve(item.id, "done");
  });

  const accepted = IR.getItemSync("ir-review");
  check("acceptance keeps the existing action and records a receipt", accepted.status === "done" && !!accepted.impactReceipt);
  check("receipt records the actual changed entity", accepted.impactReceipt.changedEntities.some((change) => change.id === key.id && change.kind === "updated"));
  check("receipt records manuscript occurrence rebinding", accepted.impactReceipt.changedOccurrences.some((change) => change.id === "ir-occ-candidate"));
  check("accepted owner change was applied", B.EntityService.getSync(key.id, "items").data.currentOwner.id === soren.id);
  check("receipt is safe before later edits", IR.receiptSafety(accepted).safe === true);

  await IR.revertAcceptance("ir-review");
  const reverted = IR.getItemSync("ir-review");
  const restoredOccurrence = B.OccurrenceService.listAllSync().find((o) => o.occurrenceId === "ir-occ-candidate");
  check("safe revert restores the previous owner", B.EntityService.getSync(key.id, "items").data.currentOwner.id === beforeOwner);
  check("safe revert restores candidate occurrence links", restoredOccurrence.entityId === beforeOccurrence.entityId && restoredOccurrence.candidateId === beforeOccurrence.candidateId);
  check("safe revert returns the decision to pending", reverted.status === "pending" && !!reverted.impactReceipt.revertedAt);

  // A second acceptance followed by a later edit must disable automatic revert.
  await IR.acceptWithReceipt("ir-review", async (item) => {
    const current = B.EntityService.getSync(key.id, "items");
    await B.EntityService.update("items", key.id, { data: { ...current.data, ...item.suggestedChanges } });
    await B.ReviewService.resolve(item.id, "done");
  });
  const acceptedAgain = IR.getItemSync("ir-review");
  const current = B.EntityService.getSync(key.id, "items");
  await B.EntityService.update("items", key.id, { data: { ...current.data, condition: "cracked after acceptance" } });
  check("later entity edits pause automatic revert", IR.receiptSafety(acceptedAgain).safe === false);

  let conflictCaught = false;
  try { await IR.revertAcceptance("ir-review"); }
  catch (error) { conflictCaught = error.code === "REVERT_CONFLICT"; }
  check("unsafe revert is blocked instead of overwriting later work", conflictCaught);

  if (failures.length) {
    console.error(`\n${failures.length} Impact Review smoke check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll Impact Review smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
