// =====================================================================
// extraction-wizard.jsx — Entity Extraction Wizard
//
// A real, self-driving big-extraction window. Pick a scope (whole
// manuscript / current chapter / selected text), run extraction, and watch
// discovered entities stream in live. Triage happens in the unified Review
// Queue (Accept / Edit / Merge / Deny). Mounted globally in app.jsx via the
// `lw:open-extraction-wizard` event; driven entirely off the local
// ExtractionService (no AI required, nothing leaves the device).
// =====================================================================

const { useState: _ewUS, useEffect: _ewUE, useRef: _ewUR, useCallback: _ewUC } = React;

const EW_BAND_COLOR = { blue: "#3b82f6", green: "#3f9d52", orange: "#d08a2e", red: "#c0492f" };

// Resolve a chapter's plain body text from the manuscript store. Mirrors the
// resolution order used by AIContextBuilder (bodyText → stripped html → map).
function ewChapterText(data, id) {
  const chapter = (data.chapters || []).find((c) => c.id === id);
  const m = (data.manuscripts || {})[id] || {};
  return (chapter && chapter.bodyText)
    || (chapter && chapter.bodyHtml ? chapter.bodyHtml.replace(/<[^>]+>/g, " ") : "")
    || m.text
    || (m.html ? m.html.replace(/<[^>]+>/g, " ") : "")
    || "";
}

const ExtractionWizard = ({ open, initialScope = "manuscript", typeFocus = null, initialChapterId = null, onClose }) => {
  const [scope, setScope] = _ewUS(initialScope);
  const [mode, setMode] = _ewUS("quick"); // quick (local, free) | deep (BYOK AI)
  const [phase, setPhase] = _ewUS("setup"); // setup | running | complete | cancelled | error
  const [streamed, setStreamed] = _ewUS([]);
  const [counts, setCounts] = _ewUS({});
  const [note, setNote] = _ewUS("");
  const [progress, setProgress] = _ewUS(0); // 0..1 across the whole run, from live engine events
  const abortRef = _ewUR(null);

  _ewUE(() => {
    if (open) { setScope(initialScope || "manuscript"); setMode("quick"); setPhase("setup"); setStreamed([]); setCounts({}); setNote(""); setProgress(0); }
  }, [open, initialScope]);

  // Allow an external cancel (e.g. a registry-dispatched onCancelExtraction).
  _ewUE(() => {
    const onCancel = () => { if (abortRef.current) abortRef.current.abort(); };
    window.addEventListener("lw:extraction-cancel", onCancel);
    return () => window.removeEventListener("lw:extraction-cancel", onCancel);
  }, []);

  const resolveTargets = _ewUC(() => {
    const B = window.LoomwrightBackend;
    const data = (B && B.ManuscriptChapterService && B.ManuscriptChapterService.loadSync()) || { chapters: [], manuscripts: {} };
    if (scope === "selection") {
      const sel = window.__LW_WIZARD_SELECTION__;
      if (sel && sel.text && sel.text.trim()) return [{ id: sel.chapterId || data.activeChapterId || null, title: "Selected text", text: sel.text }];
      return [];
    }
    if (scope === "chapter") {
      const id = initialChapterId || data.activeChapterId || (data.chapters && data.chapters[0] && data.chapters[0].id);
      const ch = (data.chapters || []).find((c) => c.id === id);
      const text = ewChapterText(data, id);
      return text && text.trim() ? [{ id, title: (ch && ch.title) || "Current chapter", text }] : [];
    }
    return (data.chapters || [])
      .map((c) => ({ id: c.id, title: c.title || ("Chapter " + (c.num || "")).trim(), text: ewChapterText(data, c.id) }))
      .filter((t) => t.text && t.text.trim());
  }, [scope, initialChapterId]);

  const start = _ewUC(async () => {
    const B = window.LoomwrightBackend;
    if (!B || !B.ExtractionService) { setPhase("error"); setNote("Backend unavailable."); return; }
    const targets = resolveTargets();
    if (!targets.length) {
      setPhase("error");
      setNote(scope === "selection" ? "No text selected. Highlight a passage in the Writer's Room first." : "No manuscript text found for this scope.");
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase("running"); setStreamed([]); setCounts({}); setProgress(0);
    const seen = new Set();
    // Live stage → status line + per-chapter progress fraction, so a long
    // (especially AI) run visibly works rather than sitting on one note.
    const STAGE_LABEL = {
      start: "Saving snapshot…",
      scan: "Scanning known entities…",
      detect: "Detecting new entities…",
      "ai-relationships": "Tracing relationships…",
      complete: "Building review queue…",
    };
    const STAGE_FRACTION = { start: 0.05, scan: 0.2, detect: 0.4, "ai-relationships": 0.9, complete: 1 };
    const makeProgressHandler = (targetTitle, targetIndex, targetCount) => (d) => {
      if (d && d.stage) {
        let label = STAGE_LABEL[d.stage] || "";
        let frac = STAGE_FRACTION[d.stage] != null ? STAGE_FRACTION[d.stage] : 0.4;
        if (d.stage === "ai") {
          const done = (d.chunkIndex || 0) + 1;
          const all = d.chunkCount || 1;
          label = "AI deep read · chunk " + Math.min(done, all) + "/" + all + "…";
          frac = 0.4 + 0.5 * (done / all);
        }
        setNote((targetCount > 1 ? ("Chapter " + (targetIndex + 1) + "/" + targetCount + " · ") : "") + targetTitle + (label ? " — " + label : ""));
        setProgress((targetIndex + frac) / targetCount);
      }
      const cands = (d && d.candidates) || [];
      if (!cands.length) return;
      const fresh = [];
      for (const c of cands) {
        const key = c.entityType + ":" + String(c.name || "").toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        if (typeFocus && c.entityType !== typeFocus) continue;
        fresh.push({ id: c.id, entityType: c.entityType, name: c.name, confidenceBand: c.confidenceBand, sourceQuote: c.sourceQuote, matchType: c.matchType });
      }
      if (fresh.length) {
        setStreamed((s) => [...s, ...fresh]);
        setCounts((m) => { const n = { ...m }; fresh.forEach((f) => { n[f.entityType] = (n[f.entityType] || 0) + 1; }); return n; });
      }
    };
    try {
      for (let i = 0; i < targets.length; i++) {
        if (ctrl.signal.aborted) break;
        setNote(targets.length > 1 ? ("Reading " + (i + 1) + " of " + targets.length + ": " + targets[i].title) : targets[i].title);
        await B.ExtractionService.runExtraction({ chapterId: targets[i].id, text: targets[i].text, deep: mode === "deep", scope: "wizard", onProgress: makeProgressHandler(targets[i].title, i, targets.length), signal: ctrl.signal });
      }
      setProgress(1);
      setPhase(ctrl.signal.aborted ? "cancelled" : "complete");
    } catch (e) {
      setPhase("error"); setNote((e && e.message) || "Extraction failed.");
    }
  }, [resolveTargets, typeFocus, scope, mode]);

  if (!open) return null;
  const total = streamed.length;
  const ENTYPES = window.ENTITY_TYPES || {};
  let deepRoute = null;
  try { deepRoute = window.LoomwrightBackend?.AIRoutingService?.resolveRoute?.("deepExtraction") || null; } catch (_) { deepRoute = null; }
  const usingAI = mode === "deep" && !!deepRoute;
  const openReview = () => { window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onOpenReviewQueue" } })); if (onClose) onClose(); };
  const cancelRun = () => { if (abortRef.current) abortRef.current.abort(); };
  // Per-row triage uses the SAME registry callbacks as the Review Queue, so
  // Accept/Edit/Merge/Deny behave identically. Accept/Deny optimistically drop
  // the row from the live list.
  const act = (cbName, it) => {
    window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: cbName, detail: { id: it.id } } }));
    if (cbName === "onAcceptQueueItem" || cbName === "onDenyQueueItem") {
      setStreamed((s) => s.filter((x) => x.id !== it.id));
    }
  };

  return (
    <div className="exm-backdrop" role="dialog" aria-modal="true" data-ui="ExtractionWizardBackdrop">
      <div className="exm" data-ui="ExtractionWizard" data-state={phase} data-testid="extraction-wizard" style={{ maxWidth: 720 }}>
        <div className="exm__head">
          <div className="exm__sigil" aria-hidden><Icon name="sparkle" size={18} /></div>
          <div className="exm__title-stack">
            <div className="exm__eyebrow">Entity Extraction Wizard</div>
            <div className="exm__title">
              {phase === "setup" && "Choose what to read"}
              {phase === "running" && "Reading…"}
              {phase === "complete" && "The reading is done."}
              {phase === "cancelled" && "Extraction cancelled"}
              {phase === "error" && "Couldn't extract"}
            </div>
            <div className="exm__title-meta">
              <span className="chip">{typeFocus ? ((ENTYPES[typeFocus] && ENTYPES[typeFocus].label) || typeFocus).toUpperCase() : "ALL TYPES"}</span>
              <span className="chip">{usingAI ? "AI" : "LOCAL"}</span>
              {note && <span>· {note}</span>}
            </div>
          </div>
          <div className="exm__head-actions">
            <Btn variant="ghost" size="sm" icon="close" aria-label="Close" data-callback="onCloseExtractionModal" onClick={onClose} />
          </div>
        </div>

        {phase === "setup" ? (
          <div className="exm__body" style={{ display: "block" }}>
            <div className="exm__col-title">Scope</div>
            <div style={{ display: "flex", gap: 8, margin: "10px 0 4px", flexWrap: "wrap" }}>
              {[["manuscript", "Whole manuscript"], ["chapter", "Current chapter"], ["selection", "Selected text"]].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  data-testid={"wizard-scope-" + val}
                  aria-pressed={scope === val}
                  onClick={() => setScope(val)}
                  style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--line, #d8cdb6)", background: scope === val ? "var(--accent, #b08a3e)" : "transparent", color: scope === val ? "#fff" : "inherit", fontWeight: 600 }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={{ opacity: 0.7, fontSize: 13, marginTop: 10 }}>
              {scope === "manuscript" && "Reads every chapter in order and streams discovered entities into the review queue."}
              {scope === "chapter" && "Reads only the current chapter."}
              {scope === "selection" && "Reads only the passage you highlighted in the Writer's Room."}
            </p>

            <div className="exm__col-title" style={{ marginTop: 14 }}>Method</div>
            <div style={{ display: "flex", gap: 8, margin: "10px 0 4px", flexWrap: "wrap" }}>
              {[["quick", "Quick · local, free"], ["deep", "Deep AI extraction"]].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  data-testid={"wizard-mode-" + val}
                  aria-pressed={mode === val}
                  onClick={() => setMode(val)}
                  style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--line, #d8cdb6)", background: mode === val ? "var(--accent, #b08a3e)" : "transparent", color: mode === val ? "#fff" : "inherit", fontWeight: 600 }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={{ opacity: 0.7, fontSize: 13, marginTop: 10 }}>
              {mode === "quick" && "Fast, deterministic, runs entirely on your device. No tokens, no cost."}
              {mode === "deep" && (deepRoute
                ? ("Uses your configured AI (" + deepRoute.providerId + (deepRoute.model ? " · " + deepRoute.model : "") + ") for a deeper, multi-domain read. Your project's style and canon are sent so the model follows your rules.")
                : "No AI provider configured — Deep will run locally for now. Add a provider in Settings (a local Ollama model is free) to enable AI-deep extraction.")}
            </p>
          </div>
        ) : (
          <>
            <div className="exm__bar" aria-hidden>
              <div className="exm__bar__fill" style={{ width: (phase === "running" ? Math.max(4, Math.round(progress * 100)) : 100) + "%", transition: "width .3s" }} />
            </div>
            <div className="exm__body" style={{ display: "block", maxHeight: 320, overflowY: "auto" }}>
              <div className="exm__col-title">Discovered so far · {total}</div>
              {total === 0 && phase === "running" && <p style={{ opacity: 0.6, fontSize: 13 }}>Reading the page…</p>}
              {total === 0 && phase !== "running" && <p style={{ opacity: 0.6, fontSize: 13 }}>No new entities found in this scope.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {streamed.map((it, idx) => (
                  <div key={(it.id || it.name) + ":" + idx} data-testid="wizard-stream-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: "1px solid var(--line, #e3dac6)", borderRadius: 8 }}>
                    <span title={it.confidenceBand} style={{ width: 8, height: 8, borderRadius: 99, background: EW_BAND_COLOR[it.confidenceBand] || "#999", flex: "0 0 auto" }} />
                    {typeof EntityTypeBadge !== "undefined" ? <EntityTypeBadge type={it.entityType} size="xs" showLabel={false} /> : <span className="chip">{it.entityType}</span>}
                    <span style={{ fontWeight: 600, flex: "0 0 auto" }}>{it.name}</span>
                    {it.matchType === "ambiguous" && <span className="chip" style={{ fontSize: 10 }}>maybe known</span>}
                    <span style={{ flex: 1, opacity: 0.55, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.sourceQuote}</span>
                    <Btn variant="ghost" size="sm" icon="check" data-testid={"wizard-row-accept-" + it.id} aria-label="Accept" onClick={() => act("onAcceptQueueItem", it)} />
                    <Btn variant="ghost" size="sm" icon="more" aria-label="Edit" onClick={() => act("onEditQueueItem", it)} />
                    <Btn variant="ghost" size="sm" icon="link" aria-label="Merge" onClick={() => act("onMergeQueueItem", it)} />
                    <Btn variant="ghost" size="sm" icon="close" aria-label="Deny" onClick={() => act("onDenyQueueItem", it)} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="exm__foot">
          <div className="exm__foot__hint">
            {phase === "setup" && "Local-only. Nothing leaves your device."}
            {phase === "running" && "You can keep working — triage in the review queue any time."}
            {phase === "complete" && ("Found " + total + " candidate" + (total === 1 ? "" : "s") + ". Triage them in the review queue.")}
            {phase === "cancelled" && "Stopped. Anything already found is in the review queue."}
            {phase === "error" && note}
          </div>
          <div className="exm__foot__actions">
            {phase === "setup" && (
              <>
                <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
                <Btn variant="primary" size="sm" icon="bolt" data-testid="wizard-start" onClick={start}>Start extraction</Btn>
              </>
            )}
            {phase === "running" && (
              <>
                <Btn variant="ghost" size="sm" data-callback="onCancelExtraction" data-testid="wizard-cancel" onClick={cancelRun}>Cancel</Btn>
                <Btn variant="outline" size="sm" icon="clock" data-callback="onContinueExtractionInBackground" onClick={onClose}>Continue in background</Btn>
              </>
            )}
            {(phase === "complete" || phase === "cancelled") && (
              <>
                <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
                <Btn variant="primary" size="sm" icon="bell" data-testid="wizard-review" onClick={openReview}>Review {total} candidate{total === 1 ? "" : "s"}</Btn>
              </>
            )}
            {phase === "error" && (
              <>
                <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
                <Btn variant="primary" size="sm" onClick={() => setPhase("setup")}>Back</Btn>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ExtractionWizard });
