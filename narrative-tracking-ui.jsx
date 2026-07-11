// =====================================================================
// narrative-tracking-ui.jsx — report ribbon + session sidecar.
//
// Wraps the existing ExtractionWizard and ExtractionSessionDrawer. Their
// original controls, callbacks, states and layouts remain authoritative.
// =====================================================================

(function () {
  const { useState, useEffect, useMemo } = React;
  const BaseExtractionWizard = typeof ExtractionWizard !== "undefined" ? ExtractionWizard : null;
  const BaseExtractionSessionDrawer = typeof ExtractionSessionDrawer !== "undefined" ? ExtractionSessionDrawer : null;
  if (!BaseExtractionWizard || !BaseExtractionSessionDrawer) return;

  const service = () => window.LoomwrightBackend?.NarrativeTrackingService || window.NarrativeTrackingService;

  function factLabel(fact) {
    if (!fact) return "Tracked fact";
    const subject = fact.subject?.name ? `${fact.subject.name} ` : "";
    if (fact.kind === "movement") return `${subject}moves to ${fact.location?.name || fact.statement || "a new location"}`;
    if (fact.kind === "ownership") return `${fact.object?.name || "Item"} changes hands${fact.recipient?.name ? ` to ${fact.recipient.name}` : ""}`;
    if (fact.kind === "relationship") return `${subject}${fact.predicate || "interacts with"} ${fact.object?.name || "another character"}`;
    if (fact.kind === "knowledge" || fact.kind === "belief") return `${subject}${fact.predicate || "learns"}: ${fact.statement || "new information"}`;
    if (fact.kind === "promise") return `${subject}${fact.predicate || "promises"} ${fact.action || fact.statement || "something"}`;
    if (fact.kind === "contradiction") return fact.statement || "Conflicting history detected";
    return fact.sourceQuote || fact.statement || fact.kind;
  }

  const TrackingMetrics = ({ report, compact = false }) => {
    if (!report) return null;
    const rows = [
      [report.mentionCount || 0, "mentions"],
      [report.stateChangeCount || 0, "state changes"],
      [report.relationshipCount || 0, "relationships"],
      [report.knowledgeCount || 0, "knowledge / beliefs"],
      [report.promiseCount || 0, "open threads"],
      [report.contradictionCount || 0, "contradictions", report.contradictionCount ? "danger" : ""],
    ];
    if (compact) {
      return (
        <div className="ntr-ribbon__metrics">
          {rows.map(([value, label, tone]) => <span key={label} className="ntr-ribbon__metric" data-tone={tone || undefined}>{value} {label}</span>)}
        </div>
      );
    }
    return (
      <div className="ntr-sidecar__grid">
        {rows.map(([value, label]) => (
          <div className="ntr-sidecar__metric" key={label}>
            <div className="ntr-sidecar__value">{value}</div>
            <div className="ntr-sidecar__label">{label}</div>
          </div>
        ))}
      </div>
    );
  };

  const TrackingRibbon = ({ report, onClose }) => {
    if (!report) return null;
    const facts = (report.facts || []).filter((fact) => ["contradiction", "promise", "movement", "ownership", "knowledge", "relationship", "character-status", "world-state"].includes(fact.kind)).slice(0, 4);
    return (
      <aside className="ntr-ribbon" data-ui="NarrativeTrackingRibbon" data-testid="narrative-tracking-ribbon">
        <div className="ntr-ribbon__top">
          <div className="ntr-ribbon__sigil"><Icon name="knot" size={15}/></div>
          <div className="ntr-ribbon__copy">
            <div className="ntr-ribbon__eyebrow">Local deep read complete</div>
            <div className="ntr-ribbon__title">The chapter is now connected to the living story graph.</div>
            <div className="ntr-ribbon__sub">No AI was required for state, movement, relationships, character knowledge, promises or contradiction checks. Every mutation remains reviewable.</div>
          </div>
          <button className="ntr-ribbon__close" onClick={onClose} aria-label="Close tracking report">×</button>
        </div>
        <TrackingMetrics report={report} compact/>
        {facts.length > 0 && (
          <div className="ntr-ribbon__facts">
            {facts.map((fact) => (
              <div className="ntr-ribbon__fact" key={fact.id}>
                <span className="ntr-ribbon__fact-kind">{String(fact.kind).replace(/-/g, " ")}</span>
                <span>{factLabel(fact)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="ntr-ribbon__actions">
          <button className="rpg-btn rpg-btn--small rpg-btn--primary" onClick={() => window.LoomwrightDispatchCallback?.("onOpenReviewQueue", { detail: { source: "narrative-tracking" } })}>Open Impact Review</button>
          <button className="rpg-btn rpg-btn--small" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "today" } }))}>See Today insights</button>
        </div>
      </aside>
    );
  };

  const TrackingSidecar = ({ report }) => {
    if (!report) return null;
    const facts = (report.facts || []).slice(0, 14);
    return (
      <aside className="ntr-sidecar" data-ui="NarrativeTrackingSidecar" data-testid="narrative-tracking-sidecar">
        <div className="ntr-sidecar__head">
          <div className="ntr-sidecar__eyebrow">Narrative tracking report</div>
          <div className="ntr-sidecar__title">What changed in the story</div>
          <div className="ntr-sidecar__meta">Session {report.sessionId} · tracking model v{report.version}</div>
        </div>
        <div className="ntr-sidecar__body">
          <TrackingMetrics report={report}/>
          <div className="ntr-sidecar__section">
            <div className="ntr-sidecar__section-title">Detected facts</div>
            {facts.length === 0 && <div className="ntr-sidecar__row" style={{ fontStyle: "italic", color: "var(--ink-4)" }}>No state-changing facts were detected.</div>}
            {facts.map((fact) => (
              <div className="ntr-sidecar__row" key={fact.id}>
                <span className="ntr-sidecar__kind">{String(fact.kind).replace(/-/g, " ")}</span>
                {factLabel(fact)}
              </div>
            ))}
          </div>
        </div>
        <div className="ntr-sidecar__foot">
          <button className="rpg-btn rpg-btn--small rpg-btn--primary" onClick={() => window.LoomwrightDispatchCallback?.("onOpenReviewQueue", { detail: { source: "narrative-tracking" } })}>Review changes</button>
          <button className="rpg-btn rpg-btn--small" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-route", { detail: { routeId: "today" } }))}>Open Today</button>
        </div>
      </aside>
    );
  };

  ExtractionWizard = function TrackingAwareExtractionWizard(props) {
    const [report, setReport] = useState(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
      if (!props.open) { setReport(null); setVisible(false); return; }
      const handler = (event) => {
        if (!event.detail?.report) return;
        setReport(event.detail.report);
        setVisible(true);
      };
      window.addEventListener("lw:narrative-tracking-updated", handler);
      return () => window.removeEventListener("lw:narrative-tracking-updated", handler);
    }, [props.open]);
    return (
      <>
        <BaseExtractionWizard {...props}/>
        {props.open && visible && <TrackingRibbon report={report} onClose={() => setVisible(false)}/>} 
      </>
    );
  };

  ExtractionSessionDrawer = function TrackingAwareExtractionSessionDrawer(props) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
      const bump = () => setTick((value) => value + 1);
      window.addEventListener("lw:narrative-tracking-updated", bump);
      return () => window.removeEventListener("lw:narrative-tracking-updated", bump);
    }, []);
    const report = useMemo(() => {
      void tick;
      return props.session?.tracking || props.session?.current?.tracking || service()?.latestReportSync?.() || null;
    }, [props.session, tick]);
    return (
      <>
        <BaseExtractionSessionDrawer {...props}/>
        {props.open && <TrackingSidecar report={report}/>} 
      </>
    );
  };

  Object.assign(window, { ExtractionWizard, ExtractionSessionDrawer, NarrativeTrackingRibbon: TrackingRibbon, NarrativeTrackingSidecar: TrackingSidecar });
})();
