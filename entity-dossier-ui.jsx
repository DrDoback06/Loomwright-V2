// =====================================================================
// entity-dossier-ui.jsx — live entity dossier and rich comparison surfaces.
//
// Wraps the existing EntityTabShell and CastDetail. Type-specific renderers,
// roster actions, editors, review actions and Cast's bespoke dossier remain
// intact; this layer adds a shared evidence/evolution/history vocabulary.
// =====================================================================

(function () {
  const service = () => window.LoomwrightBackend?.EntityDossierService || window.EntityDossierService;
  if (!service() || typeof EntityTabShell === "undefined") return;

  const { useState, useEffect, useMemo } = React;
  const BaseEntityTabShell = EntityTabShell;
  const BaseCastDetail = typeof CastDetail !== "undefined" ? CastDetail : null;

  const DOSSIER_EVENTS = [
    "lw:entity-store-updated", "lw:occurrence-store-updated", "lw:occurrences-updated",
    "lw:manuscript-chapters-updated", "lw:review-queue-updated", "lw:impact-review-updated",
    "lw:references-updated", "lw:audit-log-updated", "lw:audit-undo-applied",
    "lw:narrative-tracking-updated", "lw:project-imported", "lw:backend-ready",
  ];

  function openEntity(ref) {
    if (!ref?.id) return;
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: ref.type, focus: { entityId: ref.id, entityType: ref.type, label: ref.name } } }));
    window.dispatchEvent(new CustomEvent("lw:open-search-result", { detail: { type: "entity", entityId: ref.id, entityType: ref.type } }));
  }

  function openEvidence(row) {
    if (!row?.chapterId) return;
    window.dispatchEvent(new CustomEvent("lw:open-route", { detail: {
      routeId: "writers-room", chapterId: row.chapterId, occurrenceId: row.id,
      startOffset: row.startOffset, endOffset: row.endOffset,
    } }));
    window.dispatchEvent(new CustomEvent("lw:set-active-chapter", { detail: {
      chapterId: row.chapterId, occurrenceId: row.id, startOffset: row.startOffset, endOffset: row.endOffset,
    } }));
  }

  function openReview(row) {
    if (!row?.id) return;
    window.dispatchEvent(new CustomEvent("lw:open-search-result", { detail: { type: "review", reviewItemId: row.id } }));
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function short(value, max = 190) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  function useDossier(entity, asOfChapterId) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
      const bump = () => setTick((value) => value + 1);
      DOSSIER_EVENTS.forEach((name) => window.addEventListener(name, bump));
      return () => DOSSIER_EVENTS.forEach((name) => window.removeEventListener(name, bump));
    }, []);
    return useMemo(() => {
      void tick;
      if (!entity?.id) return null;
      try { return service()?.build?.(entity.id, entity.type || entity.entityType, { asOfChapterId }) || null; }
      catch (error) { console.warn("[EntityDossier] build failed", error); return null; }
    }, [entity?.id, entity?.type, entity?.entityType, asOfChapterId, tick]);
  }

  function Metric({ value, label, tone }) {
    return (
      <div className="led-metric" data-tone={tone || undefined}>
        <div className="led-metric__value">{value}</div>
        <div className="led-metric__label">{label}</div>
      </div>
    );
  }

  function FieldList({ rows = [], limit = 16 }) {
    if (!rows.length) return <div className="led-card__empty">No confirmed fields in this section yet.</div>;
    return (
      <div className="led-fields">
        {rows.slice(0, limit).map((row) => (
          <div className="led-field" key={row.key}>
            <div className="led-field__key">{row.label}</div>
            <div className="led-field__value">{row.display}</div>
          </div>
        ))}
      </div>
    );
  }

  function OverviewTab({ dossier, legacyBody }) {
    const summary = dossier.entity.summary || dossier.entity.data?.summary || dossier.entity.description || dossier.entity.data?.description;
    return (
      <div data-ui="EntityDossierOverview">
        <div className="led__metrics">
          <Metric value={`${dossier.metrics.completeness}%`} label="Dossier depth" tone={dossier.metrics.completeness < 60 ? "warn" : ""}/>
          <Metric value={dossier.metrics.mentions} label="Mentions"/>
          <Metric value={dossier.metrics.chapters} label="Chapters"/>
          <Metric value={dossier.metrics.links} label="Canonical links"/>
          <Metric value={dossier.metrics.pendingReview} label="Pending review" tone={dossier.metrics.pendingReview ? "warn" : ""}/>
          <Metric value={dossier.metrics.risk} label="Continuity risk" tone={dossier.metrics.risk > 8 ? "danger" : ""}/>
        </div>

        <div className="led__grid">
          <section className="led-card">
            <div className="led-card__head"><Icon name="paper" size={10}/><span className="led-card__title">Story identity</span></div>
            {summary && <div style={{ marginBottom: 8, color: "var(--ink-1)", font: "12px/1.5 var(--font-serif)" }}>{summary}</div>}
            <FieldList rows={[...dossier.fields.identity, ...dossier.fields.purpose].filter((row) => row.key !== "summary")} limit={14}/>
          </section>
          <section className="led-card">
            <div className="led-card__head"><Icon name="clock" size={10}/><span className="led-card__title">Current accepted state</span></div>
            <FieldList rows={dossier.fields.state} limit={14}/>
            {!dossier.fields.state.length && <div className="led-card__empty">State will build as ownership, movement, status and canon changes are accepted.</div>}
          </section>
          {dossier.warnings.length > 0 && (
            <section className="led-card led-card--wide">
              <div className="led-card__head"><Icon name="warn" size={10}/><span className="led-card__title">Needs attention</span></div>
              <div className="led__warnings">{dossier.warnings.map((warning, index) => <div className="led-warning" key={index}><Icon name="warn" size={10}/><span>{warning}</span></div>)}</div>
            </section>
          )}
          <section className="led-card">
            <div className="led-card__head"><Icon name="eye" size={10}/><span className="led-card__title">First and latest evidence</span></div>
            {dossier.firstAppearance ? (
              <>
                <button className="led-evidence__row" onClick={() => openEvidence(dossier.firstAppearance)} style={{ gridTemplateColumns: "64px minmax(0,1fr)", marginBottom: 6 }}>
                  <div className="led-evidence__where">First<br/>{dossier.firstAppearance.chapterLabel}</div>
                  <div className="led-evidence__quote">“{short(dossier.firstAppearance.quote || dossier.firstAppearance.exactText, 130)}”</div>
                </button>
                {dossier.lastAppearance?.id !== dossier.firstAppearance.id && (
                  <button className="led-evidence__row" onClick={() => openEvidence(dossier.lastAppearance)} style={{ gridTemplateColumns: "64px minmax(0,1fr)" }}>
                    <div className="led-evidence__where">Latest<br/>{dossier.lastAppearance.chapterLabel}</div>
                    <div className="led-evidence__quote">“{short(dossier.lastAppearance.quote || dossier.lastAppearance.exactText, 130)}”</div>
                  </button>
                )}
              </>
            ) : <div className="led-card__empty">No manuscript evidence is linked yet.</div>}
          </section>
          <section className="led-card">
            <div className="led-card__head"><Icon name="link" size={10}/><span className="led-card__title">Connected story graph</span></div>
            {dossier.connections.slice(0, 6).map((connection) => (
              <button key={connection.id} className="led-connection" style={{ width: "100%", marginBottom: 5 }} onClick={() => openEntity(connection)}>
                <span className="led-connection__glyph">{ENTITY_TYPES[connection.type]?.glyph || connection.name.slice(0, 1)}</span>
                <span className="led-connection__body"><span className="led-connection__name">{connection.name}</span><span className="led-connection__meta">{connection.type} · {connection.direction}</span></span>
              </button>
            ))}
            {!dossier.connections.length && <div className="led-card__empty">No canonical links yet.</div>}
          </section>
        </div>

        {legacyBody && <div className="led__legacy"><div className="led__legacy-head">Type-specific dossier</div>{legacyBody}</div>}
      </div>
    );
  }

  function EvidenceTab({ dossier }) {
    const availableTags = ["all", ...new Set(dossier.evidence.flatMap((row) => row.tags || []))];
    const [tag, setTag] = useState("all");
    const rows = tag === "all" ? dossier.evidence : dossier.evidence.filter((row) => row.tags.includes(tag));
    return (
      <div data-ui="EntityDossierEvidence">
        <div className="led-evidence-toolbar">
          {availableTags.slice(0, 12).map((value) => <button key={value} className={`led-filter ${tag === value ? "is-active" : ""}`} onClick={() => setTag(value)}>{value.replace(/-/g, " ")}</button>)}
          <span style={{ flex: 1 }}/><span style={{ color: "var(--ink-4)", font: "9px/1 var(--font-sans)" }}>{rows.length} source {rows.length === 1 ? "passage" : "passages"}</span>
        </div>
        <div className="led-evidence">
          {rows.map((row) => (
            <button className="led-evidence__row" key={row.id} onClick={() => openEvidence(row)} data-testid={`dossier-evidence-${row.id}`}>
              <div>
                <div className="led-evidence__where">{row.chapterLabel}</div>
                <div className="led-evidence__meta">
                  {row.sceneIndex != null && <span className="led-evidence__tag">scene {row.sceneIndex + 1}</span>}
                  <span className="led-evidence__tag">{row.role}</span>
                  <span className="led-evidence__tag">{row.sentiment}</span>
                  {row.temporalAnchor && <span className="led-evidence__tag">{row.temporalAnchor}</span>}
                </div>
              </div>
              <div>
                <div className="led-evidence__quote">“{row.quote || row.exactText}”</div>
                {row.coMentioned.length > 0 && <div className="led-evidence__links">{row.coMentioned.slice(0, 6).map((ref) => <span className="led-mini-link" key={ref.id}>{ref.name}</span>)}</div>}
              </div>
            </button>
          ))}
          {!rows.length && <div className="led-card led-card__empty">No evidence matches this filter.</div>}
        </div>
      </div>
    );
  }

  function EvolutionTab({ dossier }) {
    const state = dossier.evolution.state || {};
    const stateRows = [
      ["Status", state.status], ["Location", service().displayValue(state.location)], ["Owner", service().displayValue(state.owner)],
      ["Condition", state.condition], ["Faction", service().displayValue(state.faction)],
    ].filter(([, value]) => value && value !== "—");
    return (
      <div data-ui="EntityDossierEvolution">
        <div className="led-statebar">
          {stateRows.map(([label, value]) => <div className="led-state" key={label}><div className="led-state__label">{label}</div><div className="led-state__value">{value}</div></div>)}
          {!stateRows.length && <div className="led-card__empty">No accepted historical state has been recorded yet.</div>}
        </div>
        <div className="led-evolution">
          {dossier.evolution.rows.map((row) => (
            <div key={row.id} className={`led-evolution__row ${row.active ? "" : "is-future"}`} data-testid={`dossier-chapter-${row.id}`}>
              <div><div className="led-evolution__chapter">{row.label}</div><div className="led-evolution__counts">{row.mentionCount} mentions · {row.changes.length} changes</div></div>
              <div className="led-evolution__items">
                {row.changes.map((change) => <div className="led-evolution__item" key={change.id}><span className="led-evolution__kind">{change.kind}</span><span>{change.label}{change.sourceQuote ? ` — “${short(change.sourceQuote, 120)}”` : ""}</span></div>)}
                {!row.changes.length && row.evidence.slice(0, 2).map((evidence) => <button key={evidence.id} className="led-evolution__item" onClick={() => openEvidence(evidence)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" }}><span className="led-evolution__kind">mention</span><span>“{short(evidence.quote || evidence.exactText, 140)}”</span></button>)}
              </div>
            </div>
          ))}
          {!dossier.evolution.rows.length && <div className="led-card led-card__empty">No chapter-linked evidence or state changes yet.</div>}
        </div>
      </div>
    );
  }

  function ConnectionsTab({ dossier }) {
    return (
      <div data-ui="EntityDossierConnections">
        <div className="led-connections">
          {dossier.connections.map((connection) => (
            <button key={connection.id} className="led-connection" onClick={() => openEntity(connection)} data-testid={`dossier-connection-${connection.id}`}>
              <span className="led-connection__glyph">{ENTITY_TYPES[connection.type]?.glyph || connection.name.slice(0, 1)}</span>
              <span className="led-connection__body">
                <span className="led-connection__name">{connection.name}</span>
                <span className="led-connection__meta">{connection.type} · {connection.kind || connection.direction}</span>
                {connection.markers.length > 0 && <span className="led-markers">{connection.markers.slice(0, 5).map((marker, index) => <span className="led-marker" key={marker.id || index}>{marker.type || marker.label || marker.name || marker.polarity}</span>)}</span>}
              </span>
            </button>
          ))}
        </div>
        {!dossier.connections.length && <div className="led-card led-card__empty">This entity has not yet been linked to another canonical record.</div>}
        {dossier.references.length > 0 && (
          <div className="led__grid" style={{ marginTop: 10 }}>
            <section className="led-card led-card--wide">
              <div className="led-card__head"><Icon name="bookmark" size={10}/><span className="led-card__title">Supporting references</span></div>
              {dossier.references.map((reference) => <div key={reference.id} style={{ padding: "7px 0", borderTop: "1px solid var(--line-2)" }}><div style={{ font: "600 11px/1.3 var(--font-serif)", color: "var(--ink-1)" }}>{reference.title}</div><div style={{ marginTop: 3, font: "9px/1.3 var(--font-sans)", color: "var(--ink-4)" }}>{reference.kind} · {reference.aiContext ? "available to AI context" : "excluded from AI context"}</div>{reference.content && <div style={{ marginTop: 4, font: "11px/1.4 var(--font-serif)", color: "var(--ink-2)" }}>{short(reference.content, 240)}</div>}</div>)}
            </section>
          </div>
        )}
      </div>
    );
  }

  function PerspectiveTab({ dossier }) {
    const historyWithoutClaims = dossier.history.filter((row) => !["knowledgeClaim", "belief"].includes(row.kind));
    return (
      <div data-ui="EntityDossierPerspective">
        <div className="led__grid">
          <section className="led-card">
            <div className="led-card__head"><Icon name="eye" size={10}/><span className="led-card__title">Knowledge, beliefs and secrets</span></div>
            <div className="led-knowledge">
              {dossier.knowledge.map((claim) => (
                <div className="led-claim" key={claim.id}>
                  <div className="led-claim__head"><span className="led-claim__kind">{claim.kind}</span><span className="led-claim__state">{claim.state}{claim.certainty ? ` · ${claim.certainty}` : ""}</span>{claim.chapterId && <span className="led-claim__chapter">{dossier.chapterOptions.find((chapter) => chapter.id === claim.chapterId)?.label || claim.chapterId}</span>}</div>
                  <div className="led-claim__statement">{claim.statement}</div>
                  {claim.sourceQuote && <div className="led-claim__quote">“{claim.sourceQuote}”</div>}
                </div>
              ))}
              {!dossier.knowledge.length && <div className="led-card__empty">No character-specific knowledge or belief records yet.</div>}
            </div>
          </section>
          <section className="led-card">
            <div className="led-card__head"><Icon name="branch" size={10}/><span className="led-card__title">Intentions and changing state</span></div>
            <div className="led-history">
              {historyWithoutClaims.slice(-14).reverse().map((row) => <div className="led-history__row" key={row.id}><div className="led-history__when">{row.chapterLabel}</div><div><div className="led-history__label">{row.label}</div>{row.sourceQuote && <div className="led-history__source">“{short(row.sourceQuote, 140)}”</div>}</div><span className="led-evolution__kind">{row.kind}</span></div>)}
              {!historyWithoutClaims.length && <div className="led-card__empty">No tracked state, intention or motive changes yet.</div>}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function HistoryTab({ dossier }) {
    return (
      <div data-ui="EntityDossierHistory">
        <div className="led__grid">
          <section className="led-card">
            <div className="led-card__head"><Icon name="warn" size={10}/><span className="led-card__title">Review and accepted receipts</span></div>
            <div className="led-review">
              {dossier.reviews.map((row) => <button className="led-review__row" key={row.id} onClick={() => openReview(row)} data-testid={`dossier-review-${row.id}`}><span><span className="led-review__name">{row.name}</span><span className="led-review__meta"><span>{row.status}</span><span>{row.suggestedAction}</span><span>{row.affectedCount} linked</span><span>{row.chapterCount} chapters</span>{row.receipt && <span>{row.receipt.revertedAt ? "reverted receipt" : "reversible receipt"}</span>}</span></span><span className="led-review__impact">{row.severity}</span></button>)}
              {!dossier.reviews.length && <div className="led-card__empty">No review decisions or receipts involve this entity.</div>}
            </div>
          </section>
          <section className="led-card">
            <div className="led-card__head"><Icon name="clock" size={10}/><span className="led-card__title">Accountable edit history</span></div>
            <div className="led-history">
              {dossier.audit.slice(0, 30).map((row) => <div className="led-history__row" key={row.id}><div className="led-history__when">{formatDate(row.createdAt)}</div><div><div className="led-history__label">{row.label}</div><div className="led-history__source">{row.contributor || row.source || "Loomwright"}</div></div>{row.reversible && <button className="rpg-btn rpg-btn--small" onClick={() => window.LoomwrightBackend?.AuditService?.undo?.(row.id)}>Undo</button>}</div>)}
              {!dossier.audit.length && <div className="led-card__empty">No audit entries have been recorded for this entity yet.</div>}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function ComparisonTable({ comparison }) {
    if (!comparison?.dossiers?.length) return <div className="led-card__empty">Pin or add at least one entity to begin.</div>;
    const columns = `150px repeat(${comparison.dossiers.length}, minmax(170px,1fr))`;
    return (
      <div className="led-compare__table" style={{ gridTemplateColumns: columns }} data-ui="EntityComparisonTable">
        <div className="led-compare__cell led-compare__cell--label led-compare__cell--head">Field</div>
        {comparison.dossiers.map((dossier) => <div className="led-compare__cell led-compare__cell--head" key={dossier.id}><div className="led-compare__entity">{dossier.name}</div><div className="led-compare__type">{dossier.type} · {dossier.metrics.mentions} mentions</div></div>)}
        {comparison.rows.map((row) => (
          <React.Fragment key={row.key}>
            <div className="led-compare__cell led-compare__cell--label">{row.label}</div>
            {row.values.map((value) => <div key={value.entityId} className={`led-compare__cell ${row.same ? "" : "is-different"}`}>{value.empty ? <span className="led-compare__empty">—</span> : value.display}</div>)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  function EntityComparisonOverlay({ initialRefs = [], onClose }) {
    const [version, setVersion] = useState(0);
    const [selected, setSelected] = useState(() => {
      const rows = [...initialRefs, ...(service()?.readPins?.() || [])];
      return [...new Map(rows.filter((row) => row?.id).map((row) => [row.id, row])).values()].slice(0, 6);
    });
    const [picker, setPicker] = useState("");
    useEffect(() => {
      const bump = () => setVersion((value) => value + 1);
      window.addEventListener("lw:entity-compare-pins-updated", bump);
      DOSSIER_EVENTS.forEach((name) => window.addEventListener(name, bump));
      return () => {
        window.removeEventListener("lw:entity-compare-pins-updated", bump);
        DOSSIER_EVENTS.forEach((name) => window.removeEventListener(name, bump));
      };
    }, []);
    const allEntities = useMemo(() => {
      void version;
      return (service()?.storySnapshot?.().entities || []).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    }, [version]);
    const comparison = useMemo(() => {
      void version;
      return service()?.compare?.(selected) || { dossiers: [], rows: [], differenceCount: 0, sameCount: 0, sharedConnections: [], sharedChapterIds: [] };
    }, [selected, version]);
    const add = () => {
      const entity = allEntities.find((row) => row.id === picker);
      if (!entity || selected.some((row) => row.id === entity.id)) return;
      setSelected((rows) => [...rows, entityRefForUi(entity)].slice(0, 6));
      setPicker("");
    };
    const remove = (id) => setSelected((rows) => rows.filter((row) => row.id !== id));
    return (
      <div className="led-compare-backdrop" role="dialog" aria-modal="true" data-ui="EntityComparisonOverlay" data-testid="entity-comparison-overlay">
        <div className="led-compare">
          <div className="led-compare__head">
            <div className="led-compare__copy"><div className="led__eyebrow">Cross-entity comparison</div><div className="led-compare__title">See what is shared, missing and contradictory.</div><div className="led-compare__sub">Current canonical fields, manuscript reach, dossier depth, links, review and tracked history are compared live.</div></div>
            <select className="led-compare-picker" value={picker} onChange={(event) => setPicker(event.target.value)} aria-label="Add entity to comparison"><option value="">Add another entity…</option>{allEntities.filter((entity) => !selected.some((row) => row.id === entity.id)).map((entity) => <option key={entity.id} value={entity.id}>{ENTITY_TYPES[entity.type]?.singular || entity.type}: {entity.name}</option>)}</select>
            <button className="rpg-btn rpg-btn--small" onClick={add} disabled={!picker}>Add</button>
            <button className="rpg-btn rpg-btn--small" onClick={onClose}>Close</button>
            <div className="led-compare__pins" style={{ width: "100%" }}>{selected.map((row) => <span className="led-pin" key={row.id}>{row.name}<button onClick={() => remove(row.id)} aria-label={`Remove ${row.name}`}>×</button></span>)}</div>
          </div>
          <div className="led-compare__body"><ComparisonTable comparison={comparison}/></div>
          <div className="led-compare__foot">
            <span className="led-compare__stat">{comparison.differenceCount} differing fields</span>
            <span className="led-compare__stat">{comparison.sameCount} matching fields</span>
            <span className="led-compare__stat">{comparison.sharedChapterIds.length} shared chapters</span>
            <span className="led-compare__stat">{comparison.sharedConnections.length} shared connections</span>
            <span style={{ flex: 1 }}/>
            <button className="rpg-btn rpg-btn--small" onClick={() => selected.forEach((row) => service()?.pin?.(row))}><Icon name="bookmark" size={10}/> Pin selection across tabs</button>
            <button className="rpg-btn rpg-btn--small rpg-btn--primary" disabled={selected.length < 2} onClick={() => window.LoomwrightDispatchCallback?.("onMergeEntity", { detail: { ids: selected.map((row) => row.id), entityType: selected[0]?.type } })}>Merge selected…</button>
          </div>
        </div>
      </div>
    );
  }

  function entityRefForUi(entity) {
    return { id: entity.id, name: entity.name, type: entity.type || entity.entityType };
  }

  function LiveEntityDossier({ entity, legacyBody = null, onOpenCompare = null, heading = "Living entity dossier" }) {
    const [tab, setTab] = useState("overview");
    const [asOfChapterId, setAsOfChapterId] = useState("");
    const [localCompare, setLocalCompare] = useState(false);
    const [pinVersion, setPinVersion] = useState(0);
    const dossier = useDossier(entity, asOfChapterId || null);
    useEffect(() => {
      const bump = () => setPinVersion((value) => value + 1);
      window.addEventListener("lw:entity-compare-pins-updated", bump);
      return () => window.removeEventListener("lw:entity-compare-pins-updated", bump);
    }, []);
    if (!dossier) return <div className="led-card led-card__empty">The live dossier could not be built for this record.</div>;
    const pinned = (service()?.readPins?.() || []).some((row) => row.id === dossier.id);
    void pinVersion;
    const tabs = [
      ["overview", "Overview"], ["evidence", `Evidence ${dossier.metrics.mentions}`], ["evolution", "Evolution"],
      ["connections", `Connections ${dossier.metrics.links}`], ["perspective", dossier.type === "cast" ? "Knowledge & intent" : "State & intent"],
      ["history", `History ${dossier.metrics.pendingReview ? `· ${dossier.metrics.pendingReview}` : ""}`],
    ];
    const compare = () => {
      if (onOpenCompare) onOpenCompare([entityRefForUi(dossier.entity)]);
      else setLocalCompare(true);
    };
    return (
      <div className="led" data-ui="LiveEntityDossier" data-entity-id={dossier.id} data-testid={`entity-dossier-${dossier.id}`}>
        <div className="led__command">
          <div className="led__command-copy"><div className="led__eyebrow">{heading}</div><div className="led__command-title">{dossier.name}</div><div className="led__command-sub">Canon, evidence and change history from one live graph · updated automatically</div></div>
          <select className="led__chapter-select" value={asOfChapterId} onChange={(event) => setAsOfChapterId(event.target.value)} aria-label={`View ${dossier.name} as of chapter`} data-testid="dossier-as-of"><option value="">Current accepted state</option>{dossier.chapterOptions.map((chapter) => <option key={chapter.id} value={chapter.id}>As of {chapter.label}</option>)}</select>
          <button className="rpg-btn rpg-btn--small" onClick={() => service()?.togglePin?.(dossier.entity)} data-testid="dossier-pin"><Icon name="bookmark" size={10}/>{pinned ? "Unpin" : "Pin"}</button>
          <button className="rpg-btn rpg-btn--small rpg-btn--primary" onClick={compare} data-testid="dossier-compare">Compare</button>
        </div>
        <div className="led__tabs" role="tablist">{tabs.map(([id, label]) => <button key={id} className={`led__tab ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)} role="tab" aria-selected={tab === id} data-testid={`dossier-tab-${id}`}>{label}</button>)}</div>
        <div className="led__body">
          {tab === "overview" && <OverviewTab dossier={dossier} legacyBody={legacyBody}/>} 
          {tab === "evidence" && <EvidenceTab dossier={dossier}/>} 
          {tab === "evolution" && <EvolutionTab dossier={dossier}/>} 
          {tab === "connections" && <ConnectionsTab dossier={dossier}/>} 
          {tab === "perspective" && <PerspectiveTab dossier={dossier}/>} 
          {tab === "history" && <HistoryTab dossier={dossier}/>} 
        </div>
        {localCompare && <EntityComparisonOverlay initialRefs={[entityRefForUi(dossier.entity)]} onClose={() => setLocalCompare(false)}/>} 
      </div>
    );
  }

  EntityTabShell = function DossierEntityTabShell(props) {
    const [comparisonRefs, setComparisonRefs] = useState([]);
    const originalDetail = props.detailRender;
    const openCompare = (refs) => setComparisonRefs((refs || []).filter(Boolean));
    const detailRender = (entity) => (
      <LiveEntityDossier
        entity={entity}
        legacyBody={originalDetail ? originalDetail(entity) : null}
        onOpenCompare={openCompare}
      />
    );
    const compareHandler = (payload = {}) => {
      const ids = payload.ids || payload.entityIds || [];
      const source = [...(props.entities || []), ...(props.multiEntities || []), ...(props.compareEntities || [])];
      const refs = ids.map((id) => source.find((entity) => entity.id === id) || window.LoomwrightBackend?.EntityService?.getSync?.(id)).filter(Boolean).map(entityRefForUi);
      if (refs.length) setComparisonRefs(refs);
      props.onCompareEntities?.(payload);
    };
    return (
      <>
        <BaseEntityTabShell {...props} detailRender={detailRender} onCompareEntities={compareHandler}/>
        {comparisonRefs.length > 0 && <EntityComparisonOverlay initialRefs={comparisonRefs} onClose={() => setComparisonRefs([])}/>} 
      </>
    );
  };

  if (BaseCastDetail) {
    CastDetail = function DossierCastDetail(props) {
      return (
        <>
          <BaseCastDetail {...props}/>
          <div className="cast cast-section" data-ui="CastLivingDossierExtension" style={{ marginTop: 12 }}>
            <LiveEntityDossier entity={{ id: props.c?.id, type: "cast" }} heading="Living cast intelligence"/>
          </div>
        </>
      );
    };
  }

  // Replace the legacy four-field compare renderer wherever the old compare
  // mode is used directly. It remains inline but uses the same live service.
  EntityCompareView = function RichEntityCompareView({ entities = [], onExitCompare }) {
    const comparison = service()?.compare?.(entities.map(entityRefForUi)) || null;
    return (
      <div className="led" data-ui="RichEntityCompareView">
        <div className="led__command"><div className="led__command-copy"><div className="led__eyebrow">Live comparison</div><div className="led__command-title">{entities.length} canonical records</div><div className="led__command-sub">Differences are highlighted and update when the underlying entities change.</div></div><button className="rpg-btn rpg-btn--small" onClick={onExitCompare}>Close</button></div>
        <ComparisonTable comparison={comparison}/>
      </div>
    );
  };

  Object.assign(window, { LiveEntityDossier, EntityComparisonOverlay, EntityComparisonTable: ComparisonTable, EntityTabShell, EntityCompareView, CastDetail });
})();
