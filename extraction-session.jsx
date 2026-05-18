// =====================================================================
// extraction-session.jsx — ExtractionSessionDrawer
// Right-side full-height drawer summarizing one extraction run.
// =====================================================================

const { useState: _esUS } = React;

// ---------------------------------------------------------------------
// ExtractionSessionDrawer
//
// props:
//   open: boolean
//   session: ExtractionSession | null
//   history: ExtractionSession[]    -- previous runs to switch between
//   onClose, onRerunExtraction, onOpenSourceChapter, onCompareWithPrevious
// ---------------------------------------------------------------------
const ExtractionSessionDrawer = ({
  open,
  session,
  history = [],
  onClose,
  onRerunExtraction,
  onOpenSourceChapter,
  onCompareWithPrevious,
  onSelectSession,
}) => {
  if (!open) return null;
  const [activeId, setActiveId] = _esUS(session?.id);

  const active = history.find((s) => s.id === activeId) || session;
  if (!active) return null;
  const t = active.totals || {};

  return (
    <>
      <div className="esd-backdrop" onClick={onClose} aria-hidden/>
      <aside className="esd" data-ui="ExtractionSessionDrawer" role="complementary" aria-label="Extraction session" data-testid="extraction-session-drawer">
        <div className="esd__head">
          <div>
            <div className="esd__eyebrow">Extraction Session</div>
            <div className="esd__title">{active.chapterLabel}</div>
            <div className="esd__id">ID · {active.id}</div>
          </div>
          <Btn variant="ghost" size="sm" icon="close" onClick={onClose} aria-label="Close drawer" data-callback="onClosePanel"/>
        </div>

        <div className="esd__body">
          {/* Meta */}
          <section>
            <div className="esd__sec-title">Run details</div>
            <div className="esd__meta-grid">
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">Mode</div>
                <div className="esd__meta-row__val">{active.mode === "deep" ? "Deep extraction" : "Quick extraction"}</div>
              </div>
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">Privacy</div>
                <div className="esd__meta-row__val">
                  {active.privacy === "local" ? "Local model" : active.privacy === "ai" ? "AI cloud" : "Cloud"}
                </div>
              </div>
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">Started</div>
                <div className="esd__meta-row__val esd__meta-row__val--mono">{active.startedAt}</div>
              </div>
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">Completed</div>
                <div className="esd__meta-row__val esd__meta-row__val--mono">{active.completedAt || "—"}</div>
              </div>
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">Duration</div>
                <div className="esd__meta-row__val esd__meta-row__val--mono">{active.duration || "—"}</div>
              </div>
              <div className="esd__meta-row">
                <div className="esd__meta-row__lbl">State</div>
                <div className="esd__meta-row__val">
                  <span className="chip">{(active.state || "complete").toUpperCase()}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Totals */}
          <section>
            <div className="esd__sec-title">Outcome</div>
            <div className="esd__totals">
              <div className="esd__total" data-tone="info">
                <div className="esd__total__val">{t.candidates ?? 0}</div>
                <div className="esd__total__lbl">Candidates</div>
              </div>
              <div className="esd__total" data-tone="info">
                <div className="esd__total__val">{t.autoAdded ?? 0}</div>
                <div className="esd__total__lbl">Auto-added</div>
              </div>
              <div className="esd__total" data-tone="ok">
                <div className="esd__total__val">{t.accepted ?? 0}</div>
                <div className="esd__total__lbl">Accepted</div>
              </div>
              <div className="esd__total" data-tone="ok">
                <div className="esd__total__val">{t.merged ?? 0}</div>
                <div className="esd__total__lbl">Merged</div>
              </div>
              <div className="esd__total" data-tone="warn">
                <div className="esd__total__val">{t.denied ?? 0}</div>
                <div className="esd__total__lbl">Denied</div>
              </div>
              <div className="esd__total" data-tone="danger">
                <div className="esd__total__val">{t.failed ?? 0}</div>
                <div className="esd__total__lbl">Failed</div>
              </div>
            </div>
            {active.note && (
              <div style={{ marginTop: "var(--sp-4)", fontSize: "var(--fs-xs)", color: "var(--ink-3)", fontStyle: "italic" }}>
                {active.note}
              </div>
            )}
          </section>

          {/* Previous sessions */}
          {history.length > 1 && (
            <section>
              <div className="esd__sec-title">Previous runs · {history.length}</div>
              <div className="esd__history">
                {history.map((s) => (
                  <div
                    key={s.id}
                    className={"esd__history__row " + (s.id === active.id ? "is-active" : "")}
                    onClick={() => { setActiveId(s.id); onSelectSession && onSelectSession(s.id); }}
                    data-callback="onSelectSession"
                  >
                    <div className="esd__history__row-top">
                      <span className="chip">{s.mode === "deep" ? "DEEP" : "QUICK"}</span>
                      <span style={{ flex: 1, color: "var(--ink-1)" }}>{s.chapterLabel}</span>
                      <span style={{ color: "var(--ink-4)" }}>{s.startedAt}</span>
                    </div>
                    <div className="esd__history__row-bot">
                      <span>{s.totals?.candidates ?? 0} cand.</span>
                      <span>{s.totals?.accepted ?? 0} acc.</span>
                      <span>{s.totals?.denied ?? 0} den.</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="esd__foot">
          <div style={{ display: "flex", gap: "var(--sp-3)" }}>
            <Btn variant="ghost" size="sm" icon="feather" data-callback="onOpenSourceChapter" onClick={onOpenSourceChapter}>Open chapter</Btn>
            <Btn variant="ghost" size="sm" icon="link" data-callback="onCompareWithPrevious" onClick={onCompareWithPrevious}>Compare</Btn>
          </div>
          <Btn variant="primary" size="sm" icon="bolt" data-callback="onRerunExtraction" onClick={onRerunExtraction}>Re-run</Btn>
        </div>
      </aside>
    </>
  );
};

Object.assign(window, { ExtractionSessionDrawer });
