// =====================================================================
// extraction-progress.jsx — ExtractionProgressModal + failed/running states
//
// LIVE: the modal subscribes to `lw:extraction-progress` (emitted by
// ExtractionService.runExtraction) and drives itself — stages advance
// from real engine events, and the right-hand column streams a snapshot
// of every entity found so far, so a long run visibly works.
// =====================================================================

const { useState: _epUS, useEffect: _epUE, useMemo: _epUM, useRef: _epUR } = React;

const EP_BAND_COLOR = { blue: "#3b82f6", green: "#3f9d52", orange: "#d08a2e", red: "#c0492f" };

// Map engine report stages → indices in EXTRACTION_STAGES.
//   start → snapshot(0)   scan → scan(1)   detect → detect(2)
//   ai chunks → walk alias(3)…queues(9) proportionally
//   ai-relationships → rel(4)   complete/cancelled → complete(last)
function epStageIndexFor(d, stagesLen) {
  switch (d.stage) {
    case "start": return 0;
    case "scan": return 1;
    case "detect": return 2;
    case "ai": {
      const span = (stagesLen - 2) - 3; // alias … queues
      const frac = d.chunkCount ? (d.chunkIndex + 1) / d.chunkCount : 0;
      return 3 + Math.min(span, Math.floor(frac * span));
    }
    case "ai-relationships": return 4;
    case "complete": case "cancelled": return stagesLen - 1;
    default: return 0;
  }
}

// ---------------------------------------------------------------------
// useExtractionProgress — one live session's state, from engine events.
// Resets on every `start` so re-runs replace the previous snapshot.
// ---------------------------------------------------------------------
function useExtractionProgress(open) {
  const empty = () => ({
    sessionId: null, stageIdx: 0, found: [], counts: {},
    occurrenceCount: 0, knownMentions: [], chunkIndex: 0, chunkCount: 0,
    finished: false, cancelled: false, finalCount: null, deep: false,
  });
  const [live, setLive] = _epUS(empty);
  const seenRef = _epUR(new Set());
  _epUE(() => {
    if (!open) return undefined;
    setLive(empty());
    seenRef.current = new Set();
    const onProg = (e) => {
      const d = e.detail || {};
      if (d.stage === "start") {
        seenRef.current = new Set();
        setLive({ ...empty(), sessionId: d.sessionId, deep: !!d.deep });
        return;
      }
      setLive((prev) => {
        if (prev.sessionId && d.sessionId && d.sessionId !== prev.sessionId) return prev;
        const stagesLen = (typeof EXTRACTION_STAGES !== "undefined" ? EXTRACTION_STAGES.length : 11);
        const next = { ...prev, stageIdx: Math.max(prev.stageIdx, epStageIndexFor(d, stagesLen)) };
        if (d.stage === "scan") next.occurrenceCount = d.occurrenceCount || 0;
        if (Array.isArray(d.knownMentions)) next.knownMentions = d.knownMentions;
        if (d.stage === "ai") { next.chunkIndex = (d.chunkIndex || 0) + 1; next.chunkCount = d.chunkCount || 0; }
        // Candidates stream in on `detect` (local pass) and `complete`
        // (final list, including AI finds). Dedupe by type+name; upgrade
        // earlier rows when the final pass brings ids/bands.
        if (Array.isArray(d.candidates) && d.candidates.length) {
          const found = prev.found.slice();
          const counts = { ...prev.counts };
          for (const c of d.candidates) {
            if (!c || !c.name) continue;
            const key = (c.entityType || "?") + ":" + String(c.name).toLowerCase();
            if (seenRef.current.has(key)) continue;
            seenRef.current.add(key);
            found.push({ name: c.name, entityType: c.entityType, band: c.confidenceBand, quote: c.sourceQuote || "" });
            counts[c.entityType] = (counts[c.entityType] || 0) + 1;
          }
          next.found = found;
          next.counts = counts;
        }
        if (d.stage === "complete" || d.stage === "cancelled") {
          next.finished = true;
          next.cancelled = d.stage === "cancelled";
          next.finalCount = d.candidateCount != null ? d.candidateCount : next.found.length;
        }
        return next;
      });
    };
    window.addEventListener("lw:extraction-progress", onProg);
    return () => window.removeEventListener("lw:extraction-progress", onProg);
  }, [open]);
  return live;
}

// ---------------------------------------------------------------------
// ExtractionProgressModal
//
// props:
//   open: boolean
//   mode: "quick" | "deep"
//   privacy: "local" | "cloud" | "ai"
//   chapterLabel: string
//   state: optional override — "error" forces the failed body
//   error?: { title, body, detail }
//   onCancelExtraction, onContinueExtractionInBackground,
//   onOpenExtractionSession, onClose, onRerunExtraction, onOpenReview
// ---------------------------------------------------------------------
const ExtractionProgressModal = ({
  open,
  mode = "quick",
  privacy = "local",
  chapterLabel = "Chapter",
  state: stateProp,
  error,
  onCancelExtraction,
  onContinueExtractionInBackground,
  onOpenExtractionSession,
  onClose,
  onRerunExtraction,
  onOpenReview,
}) => {
  const live = useExtractionProgress(open);
  if (!open) return null;

  const stages = EXTRACTION_STAGES;
  const total = stages.length;
  const state = stateProp === "error" ? "error"
    : live.finished ? (live.cancelled ? "cancelled" : "complete")
    : "running";
  const stageIndex = state === "complete" ? total - 1 : live.stageIdx;
  const pct = state === "complete" ? 100
    : state === "error"   ? Math.max(8, (stageIndex / total) * 100)
    : Math.max(4, ((stageIndex + 0.5) / total) * 100);

  const foundTotal = live.found.length;
  const totalDetected = live.finalCount != null ? live.finalCount : foundTotal;
  const nonZeroTypes = Object.entries(live.counts).filter(([, v]) => v > 0);
  const ENTYPES = (typeof ENTITY_TYPES !== "undefined") ? ENTITY_TYPES : {};

  return (
    <div className="exm-backdrop" data-ui="ExtractionProgressModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="exm-title">
      <div className="exm" data-ui="ExtractionProgressModal" data-state={state} data-testid="extraction-progress">
        <div className="exm__head">
          <div className="exm__sigil" aria-hidden>
            <Icon name={state === "error" ? "warn" : state === "complete" ? "check" : "sparkle"} size={18}/>
          </div>
          <div className="exm__title-stack">
            <div className="exm__eyebrow">
              {state === "running"   && (mode === "deep" ? "Deep extraction" : "Quick extraction")}
              {state === "complete"  && "Extraction complete"}
              {state === "error"     && "Extraction failed"}
              {state === "cancelled" && "Extraction cancelled"}
            </div>
            <div className="exm__title" id="exm-title">
              {state === "complete"
                ? "The page has been read."
                : state === "error"
                ? "Couldn't finish reading the page."
                : "Reading the page…"}
            </div>
            <div className="exm__title-meta">
              <span>{chapterLabel}</span>
              <span>·</span>
              <span className="chip">{mode === "deep" ? "DEEP" : "QUICK"}</span>
              <span className="chip">{privacy === "local" ? "LOCAL" : privacy === "ai" ? "AI" : "CLOUD"}</span>
              {state === "running" && live.chunkCount > 0 && (
                <span>· AI chunk {Math.min(live.chunkIndex, live.chunkCount)}/{live.chunkCount}</span>
              )}
            </div>
          </div>
          <div className="exm__head-actions">
            <Btn variant="ghost" size="sm" icon="close" onClick={onClose} aria-label="Close" data-callback="onCloseExtractionModal"/>
          </div>
        </div>

        <div className="exm__bar" aria-hidden>
          <div className="exm__bar__fill" style={{ width: pct + "%" }}/>
        </div>

        {state === "error" ? (
          <div className="exm__failed">
            <div className="exm__failed__icon"><Icon name="warn" size={26}/></div>
            <div className="exm__failed__title">{error?.title || "Extraction failed"}</div>
            <div className="exm__failed__body">{error?.body || "Your draft is safe. The local model couldn't reach the manuscript index — try again, or continue without extraction."}</div>
            {error?.detail && (
              <pre className="exm__failed__detail">{error.detail}</pre>
            )}
          </div>
        ) : (
          <div className="exm__body">
            <div className="exm__stages" role="list">
              <div className="exm__col-title">Stages</div>
              {stages.map((s, i) => {
                const st = state === "complete" ? "done"
                  : state === "cancelled" && i > stageIndex ? "pending"
                  : i < stageIndex ? "done"
                  : i === stageIndex ? "active"
                  : "pending";
                return (
                  <div key={s.id} className="exm__stage" data-state={st} role="listitem">
                    <div className="exm__stage__dot" aria-hidden>
                      {st === "done" && <Icon name="check" size={11}/>}
                      {st === "pending" && <span style={{ width: 4, height: 4, borderRadius: 99, background: "currentColor" }}/>}
                    </div>
                    <div className="exm__stage__txt">
                      <div className="exm__stage__lbl">{s.label}</div>
                      <div className="exm__stage__hint">{s.hint}</div>
                    </div>
                    {s.id === "scan" && st !== "pending" && live.occurrenceCount > 0 && (
                      <span className="exm__stage__count" title="Mentions of entities you've already approved — these don't need review">{live.occurrenceCount} mentions</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="exm__counts" data-testid="exm-found">
              <div className="exm__col-title">New candidates · {foundTotal}</div>
              {nonZeroTypes.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0 8px" }}>
                  {nonZeroTypes.map(([k, v]) => (
                    <span key={k} className="chip" style={{ fontSize: 10 }}>
                      {(ENTYPES[k] && ENTYPES[k].label) || k} · {v}
                    </span>
                  ))}
                </div>
              )}
              {foundTotal === 0 && (
                <p style={{ opacity: 0.6, fontSize: 13, fontStyle: "italic" }}>
                  {state === "running"
                    ? "Reading the page — new names appear here the moment they're found…"
                    : live.knownMentions.length
                    ? "No NEW names — everything mentioned here is already in your world (below). Only new or changed things need review."
                    : "Nothing new found in this scope."}
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: live.knownMentions.length ? 150 : 230, overflowY: "auto", paddingRight: 4 }}>
                {live.found.map((f, i) => (
                  <div key={f.entityType + ":" + f.name + ":" + i} data-testid="exm-found-row"
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 6px", border: "1px solid var(--line-1, #e7dfcc)", borderRadius: 7, fontSize: 12.5 }}>
                    <span title={f.band || ""} style={{ width: 7, height: 7, borderRadius: 99, background: EP_BAND_COLOR[f.band] || "#999", flex: "0 0 auto" }}/>
                    {typeof EntityTypeBadge !== "undefined"
                      ? <EntityTypeBadge type={f.entityType} size="xs" showLabel={false}/>
                      : <span className="chip">{f.entityType}</span>}
                    <span data-testid="exm-found-name" style={{ fontWeight: 600, flex: "0 0 auto" }}>{f.name}</span>
                    <span style={{ flex: 1, opacity: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.quote}</span>
                  </div>
                ))}
              </div>

              {live.knownMentions.length > 0 && (
                <div style={{ marginTop: 10 }} data-testid="exm-known">
                  <div className="exm__col-title" title="Mentions of entities you've already approved — they update mention counts and highlights, not the review queue">
                    Already in your world · {live.occurrenceCount} mention{live.occurrenceCount === 1 ? "" : "s"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, maxHeight: 84, overflowY: "auto" }}>
                    {live.knownMentions.map((m) => (
                      <span key={m.entityId} className="chip" data-testid="exm-known-chip" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {typeof EntityTypeBadge !== "undefined" && m.entityType
                          ? <EntityTypeBadge type={m.entityType} size="xs" showLabel={false}/>
                          : null}
                        {m.name} ×{m.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="exm__foot">
          <div className="exm__foot__hint">
            {state === "running"   && <>Session <span className="mono">{live.sessionId || "…"}</span> · <em>You can keep writing — this runs in the background.</em></>}
            {state === "complete"  && <>
              {totalDetected} new candidate{totalDetected === 1 ? "" : "s"} for review
              {live.occurrenceCount > 0 && <> · {live.occurrenceCount} mention{live.occurrenceCount === 1 ? "" : "s"} of {live.knownMentions.length} known entit{live.knownMentions.length === 1 ? "y" : "ies"} re-confirmed</>}.
            </>}
            {state === "error"     && <>Session <span className="mono">{live.sessionId || "…"}</span></>}
            {state === "cancelled" && <>Stopped. Anything already found is in the review queue.</>}
          </div>
          <div className="exm__foot__actions">
            {state === "running" && (
              <>
                <Btn variant="ghost" size="sm" data-callback="onCancelExtraction" data-testid="extraction-cancel" onClick={onCancelExtraction}>Cancel</Btn>
                <Btn variant="outline" size="sm" icon="clock" data-callback="onContinueExtractionInBackground" data-testid="extraction-bg" onClick={onContinueExtractionInBackground}>Continue in background</Btn>
                <Btn variant="ghost" size="sm" icon="paper" data-callback="onOpenExtractionSession" onClick={onOpenExtractionSession}>Session details</Btn>
              </>
            )}
            {(state === "complete" || state === "cancelled") && (
              <>
                <Btn variant="ghost" size="sm" icon="paper" data-callback="onOpenExtractionSession" onClick={onOpenExtractionSession}>Session details</Btn>
                <Btn variant="primary" size="sm" icon="bell" data-callback="onOpenGlobalReview" data-testid="extraction-review"
                  onClick={() => { if (onOpenReview) onOpenReview(); else if (onClose) onClose(); }}>
                  Review {totalDetected} candidate{totalDetected === 1 ? "" : "s"}
                </Btn>
              </>
            )}
            {state === "error" && (
              <>
                <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
                <Btn variant="outline" size="sm" icon="paper" data-callback="onOpenExtractionSession" onClick={onOpenExtractionSession}>Open logs</Btn>
                <Btn variant="primary" size="sm" icon="bolt" data-callback="onRerunExtraction" data-testid="extraction-retry" onClick={onRerunExtraction}>Retry</Btn>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ExtractionProgressModal, useExtractionProgress });
