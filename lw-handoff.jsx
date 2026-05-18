// =====================================================================
// lw-handoff.jsx — AI Handoff Pack history + result parser (Phase 9).
//
// The ai-handoff.jsx UI already builds packs (`buildAIHandoffPack`) and
// formats prompts (`buildAIHandoffPrompt`). This module adds:
//   • `HandoffService` — small store of recent packs and parsed results.
//   • `parseHandoffResult(text)` — robust parser used by the import path.
//   • An event bridge wired in app.jsx (see Phase 9 listeners) that routes
//     imported AI results back to the appropriate services.
// =====================================================================

(function initLwHandoff(global) {
  const Storage = global.StorageService;
  if (!Storage) {
    // eslint-disable-next-line no-console
    console.error("[Loomwright] lw-handoff.jsx loaded before lw-storage.jsx");
    return;
  }

  const HISTORY_KEY = "handoff_history";
  const MAX_HISTORY = 25;

  function nowIso() { return new Date().toISOString(); }

  function parseHandoffResult(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return { kind: "empty" };
    try {
      const parsed = JSON.parse(trimmed);
      return { kind: "json", value: parsed, raw: trimmed };
    } catch (e) { /* fall through */ }
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      try {
        const parsed = JSON.parse(fence[1].trim());
        return { kind: "json", value: parsed, raw: trimmed };
      } catch (e) { /* noop */ }
    }
    return { kind: "prose", prose: trimmed, raw: trimmed };
  }

  const HandoffService = {
    KEY: HISTORY_KEY,

    async history() {
      return (await Storage.get(HISTORY_KEY)) || [];
    },

    async record(pack, kind) {
      const all = await HandoffService.history();
      all.unshift({
        id: pack?.id || ("ahp-" + Date.now()),
        kind: kind || "export",
        purpose: pack?.purpose || pack?.outputType || null,
        surface: pack?.surface || null,
        pack: pack || null,
        ts: nowIso(),
      });
      const capped = all.slice(0, MAX_HISTORY);
      await Storage.set(HISTORY_KEY, capped);
      return capped[0];
    },

    /** Apply a parsed AI result by routing it to the right services. */
    async applyResult({ result, mode, raw, surface, pack } = {}) {
      const outcomes = { reviewItems: 0, entityUpdates: 0, references: 0, drafts: 0 };
      const r = result || (raw ? parseHandoffResult(raw).value : null) || {};

      if (mode === "saveReference" || mode === "saveAsReference") {
        if (global.ReferencesService) {
          await global.ReferencesService.save({
            type: "ai-result",
            title: "AI Handoff result · " + (surface || "unknown"),
            content: typeof raw === "string" ? raw : JSON.stringify(r, null, 2),
            aiIncluded: false,
          });
          outcomes.references++;
        }
      }

      if (Array.isArray(r.entityUpdates) && r.entityUpdates.length) {
        if (global.EntityService) {
          for (const u of r.entityUpdates) {
            if (!u || !u.id) continue;
            const prev = await global.EntityService.get(u.id);
            if (!prev) continue;
            await global.EntityService.save(Object.assign({}, prev, u.patch || {}, { id: u.id, type: prev.type }));
            outcomes.entityUpdates++;
          }
        }
      }

      if (Array.isArray(r.suggestedReviewItems) && r.suggestedReviewItems.length) {
        if (global.ReviewQueueService) {
          for (const it of r.suggestedReviewItems) {
            await global.ReviewQueueService.add(Object.assign({ source: "ai-handoff" }, it));
            outcomes.reviewItems++;
          }
        }
      }

      if (mode === "draft" || mode === "insertDraft") {
        if (typeof r.prose === "string" && r.prose.trim()) {
          // Surface the draft via a UI event so the active surface can decide
          // how to insert (composition overlay vs. manuscript).
          global.dispatchEvent(new CustomEvent("lw:ai-handoff-draft-ready", {
            detail: { prose: r.prose, surface, pack },
          }));
          outcomes.drafts++;
        }
      }

      await HandoffService.record(pack, "import");
      return outcomes;
    },

    parseResult: parseHandoffResult,
  };

  global.HandoffService = HandoffService;
  global.parseHandoffResult = parseHandoffResult;
  global.Loomwright = Object.assign(global.Loomwright || {}, { HandoffService, parseHandoffResult });
})(typeof window !== "undefined" ? window : globalThis);
