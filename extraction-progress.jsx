// =====================================================================
// extraction-progress.jsx — ExtractionProgressModal + failed/running states
// All visual; emits callbacks for hookup. No real extraction logic.
// =====================================================================

const { useState: _epUS, useEffect: _epUE, useMemo: _epUM } = React;

// ---------------------------------------------------------------------
// Helper — format type-count grid using ENTITY_TYPES order
// ---------------------------------------------------------------------
const EXM_COUNT_KEYS = ["cast", "bestiary", "locations", "items", "events", "factions", "abilities", "lore", "relationships", "timeline"];

// ---------------------------------------------------------------------
// ExtractionProgressModal
//
// props:
//   open: boolean
//   mode: "quick" | "deep"
//   privacy: "local" | "cloud" | "ai"
//   chapterLabel: string
//   sessionId: string
//   stageIndex: number     -- which stage is currently active
//   counts: { [entityType]: number }
//   state: "running" | "complete" | "error" | "cancelled"
//   error?: { title, body, detail }
//   onCancel, onContinueInBackground, onOpenSession, onClose, onRetry
// ---------------------------------------------------------------------
const ExtractionProgressModal = ({
  open,
  mode = "quick",
  privacy = "local",
  chapterLabel = "Chapter",
  sessionId = "ses-…",
  stageIndex = 0,
  counts = {},
  state = "running",
  error,
  onCancelExtraction,
  onContinueExtractionInBackground,
  onOpenExtractionSession,
  onClose,
  onRerunExtraction,
}) => {
  if (!open) return null;

  const stages = EXTRACTION_STAGES;
  const total = stages.length;
  const pct = state === "complete" ? 100
    : state === "error"   ? Math.max(8, (stageIndex / total) * 100)
    : Math.max(4, ((stageIndex + 0.5) / total) * 100);

  const totalDetected = Object.values(counts).reduce((a, b) => a + (b || 0), 0);

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
                    {st !== "pending" && counts[s.id] != null && (
                      <span className="exm__stage__count">+{counts[s.id]}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="exm__counts">
              <div className="exm__col-title">Detected so far · {totalDetected}</div>
              <div className="exm__count-grid">
                {EXM_COUNT_KEYS.map((k) => {
                  const t = ENTITY_TYPES[k];
                  if (!t) return null;
                  const v = counts[k] || 0;
                  return (
                    <div key={k} className="exm__count-row" data-zero={v === 0}>
                      <EntityTypeBadge type={k} size="xs" showLabel={false}/>
                      <span className="exm__count-row__lbl">{t.label}</span>
                      <span className="exm__count-row__val">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="exm__foot">
          <div className="exm__foot__hint">
            {state === "running"   && <>Session <span className="mono">{sessionId}</span> · <em>You can keep writing — this runs in the background.</em></>}
            {state === "complete"  && <>Found {totalDetected} candidates across {Object.keys(counts).filter((k) => counts[k]).length} entity types.</>}
            {state === "error"     && <>Session <span className="mono">{sessionId}</span></>}
            {state === "cancelled" && <>No changes were saved to your dossiers.</>}
          </div>
          <div className="exm__foot__actions">
            {state === "running" && (
              <>
                <Btn variant="ghost" size="sm" data-callback="onCancelExtraction" data-testid="extraction-cancel" onClick={onCancelExtraction}>Cancel</Btn>
                <Btn variant="outline" size="sm" icon="clock" data-callback="onContinueExtractionInBackground" data-testid="extraction-bg" onClick={onContinueExtractionInBackground}>Continue in background</Btn>
                <Btn variant="ghost" size="sm" icon="paper" data-callback="onOpenExtractionSession" onClick={onOpenExtractionSession}>Session details</Btn>
              </>
            )}
            {state === "complete" && (
              <>
                <Btn variant="ghost" size="sm" icon="paper" data-callback="onOpenExtractionSession" onClick={onOpenExtractionSession}>Session details</Btn>
                <Btn variant="primary" size="sm" icon="bell" data-callback="onOpenGlobalReview" onClick={onClose}>Review {totalDetected} candidates</Btn>
              </>
            )}
            {state === "error" && (
              <>
                <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
                <Btn variant="outline" size="sm" icon="paper" data-callback="onOpenExtractionSession" onClick={onOpenExtractionSession}>Open logs</Btn>
                <Btn variant="primary" size="sm" icon="bolt" data-callback="onRerunExtraction" data-testid="extraction-retry" onClick={onRerunExtraction}>Retry</Btn>
              </>
            )}
            {state === "cancelled" && (
              <Btn variant="primary" size="sm" onClick={onClose}>Dismiss</Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ExtractionProgressModal, EXM_COUNT_KEYS });
