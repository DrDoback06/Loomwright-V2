// =====================================================================
// home-intelligence.jsx — enhanced project command centre.
//
// Reuses the existing Home components/styles but replaces the remaining
// cosmetic dashboard assumptions with one live StoryIntelligence snapshot.
// =====================================================================

(function () {
  function SI() {
    return window.LoomwrightBackend?.StoryIntelligenceService || window.StoryIntelligenceService || null;
  }

  function formatRelative(iso) {
    if (!iso) return "not saved yet";
    const time = new Date(iso).getTime();
    if (!Number.isFinite(time)) return "saved locally";
    const mins = Math.max(0, Math.floor((Date.now() - time) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function useHomeSnapshot() {
    const [tick, setTick] = React.useState(0);
    React.useEffect(() => {
      const bump = () => setTick((t) => t + 1);
      const names = [
        "lw:entity-store-updated", "lw:review-queue-updated", "lw:manuscript-chapters-updated",
        "lw:occurrence-store-updated", "lw:references-updated", "lw:project-intel-updated",
        "lw:audit-log-updated", "lw:audit-undo-applied", "lw:project-imported",
        "lw:story-intelligence-updated", "lw:story-intelligence-ready", "lw:backend-ready",
      ];
      names.forEach((n) => window.addEventListener(n, bump));
      return () => names.forEach((n) => window.removeEventListener(n, bump));
    }, []);
    return React.useMemo(() => {
      void tick;
      const backend = window.LoomwrightBackend;
      if (!backend?.EntityService) return null;
      const dashboard = SI()?.buildDashboard?.() || null;
      const manuscript = backend.ManuscriptChapterService?.loadSync?.() || { chapters: [], manuscripts: {} };
      const chapters = (manuscript.chapters || []).filter((c) => !c.reserved);
      const active = chapters.find((c) => c.id === manuscript.activeChapterId) || chapters[chapters.length - 1] || null;
      const activeText = active?.bodyText || String(active?.bodyHtml || "").replace(/<[^>]+>/g, " ") || manuscript.manuscripts?.[active?.id]?.text || "";
      const activeWords = activeText.trim() ? activeText.trim().split(/\s+/).length : 0;
      const projectSettings = backend.SettingsService?.getSectionSync?.("project", {}) || {};
      const intel = backend.ProjectIntelService?.loadSync?.() || {};
      const targetWords = Number(projectSettings.targetWordCount || intel.projectFoundation?.targetWordCount || 90000) || 90000;
      const audit = backend.AuditService?.getRecentSync?.(8) || [];
      const references = backend.ReferencesService?.listSync?.() || [];
      const canonRules = Array.isArray(intel.canonRules) ? intel.canonRules : [];
      return { backend, dashboard, manuscript, chapters, active, activeWords, targetWords, audit, intel, references, canonRules };
    }, [tick]);
  }

  const Metric = ({ value, label, sub, tone }) => (
    <div className={"home-stat" + (tone ? ` home-stat--${tone}` : "")}>
      <div className="home-stat__val">{value}</div>
      <div className="home-stat__lbl">{label}</div>
      {sub && <div className="home-stat__sub">{sub}</div>}
    </div>
  );

  const InsightRows = ({ rows, empty, onOpen }) => (
    <div className="home-warnings">
      {!rows.length && (
        <div className="home-warning home-warning--info">
          <div className="home-warning__body">
            <div className="home-warning__title">{empty}</div>
            <div className="home-warning__sub">This is a genuine live-project result.</div>
          </div>
        </div>
      )}
      {rows.map((row) => (
        <button key={row.id} className={"home-warning home-warning--" + (row.confidence === "high" ? "danger" : "warn")} onClick={() => onOpen(row)}>
          <span className={"home-warning__dot home-warning__dot--" + (row.confidence === "high" ? "danger" : "warn")}/>
          <div className="home-warning__body">
            <div className="home-warning__title">{row.title}</div>
            <div className="home-warning__sub">{row.why}</div>
          </div>
          <span className="home-warning__action">{row.action} →</span>
        </button>
      ))}
    </div>
  );

  HomeScreen = ({
    onOpenPanel, onSetRoute, onOpenReviewQueue,
    onOpenProjectIntelligence, onOpenContinuityWarning,
    onOpenRecentEntity, onOpenImportFlow,
  }) => {
    const state = useHomeSnapshot();
    const dash = state?.dashboard || {
      storyHealth: 0, extractionCoverage: 0, words: 0, chapterCount: 0, entityCount: 0,
      occurrenceCount: 0, pendingReviewCount: 0, highImpactReviewCount: 0,
      danglingCount: 0, unplacedCount: 0, dormantCount: 0, profiles: [], suggestions: [], risks: [], opportunities: [], snapshot: { raw: {}, entities: [] },
    };
    const isEmpty = !dash.chapterCount && !dash.entityCount;
    const activeNumber = state?.active ? (state.active.num || state.active.slotNumber || state.chapters.indexOf(state.active) + 1) : null;
    const lastSaved = state?.chapters?.map((c) => c.updatedAt || c.savedAt).filter(Boolean).sort().slice(-1)[0] || null;
    const progress = Math.min(100, Math.round((dash.words / Math.max(1, state?.targetWords || 90000)) * 100));
    const typeRows = Object.entries(dash.snapshot?.raw || {}).map(([type, byId]) => {
      const meta = window.ENTITY_TYPES?.[type] || {};
      const count = Object.values(byId || {}).filter((e) => e.status !== "deleted").length;
      const queue = (state?.backend?.ReviewService?.listSync?.(type) || []).filter((r) => !["done", "accepted", "denied", "merged"].includes(r.status)).length;
      return { id: type, label: meta.label || type[0].toUpperCase() + type.slice(1), count, queue, color: meta.color || "#76684c", glyph: meta.glyph || type[0].toUpperCase() };
    }).filter((r) => r.count || r.queue).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const highImpact = dash.suggestions.filter((s) => s.reviewItemId && s.impact && ["high", "critical"].includes(s.impact.severity)).slice(0, 5);
    const opportunities = dash.opportunities.slice(0, 5);
    const risks = dash.risks.slice(0, 5);

    const openSuggestion = async (s) => {
      try {
        const handled = await SI()?.executeSuggestion?.(s);
        if (!handled && s.related?.[0]) onOpenPanel?.(s.related[0].type);
      } catch (err) {
        window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: err.message || "Could not open this insight." } }));
      }
    };

    const openAudit = (evt) => {
      if (!evt) return;
      window.dispatchEvent(new CustomEvent("lw:open-search-result", { detail: {
        type: evt.targetType,
        entityType: evt.entityType,
        entityId: evt.targetType === "entity" ? evt.targetId : null,
        chapterId: evt.targetType === "chapter" ? evt.targetId : null,
        referenceId: evt.targetType === "reference" ? evt.targetId : null,
        reviewItemId: evt.targetType === "review" ? evt.targetId : null,
      } }));
    };

    return (
      <div className="home paper-grain" data-ui="HomeScreen" data-route="home">
        <div className="home__inner">
          {isEmpty && (
            <div className="home__empty" data-ui="HomeEmptyState" style={{ background: "var(--paper-soft, #f6efe2)", border: "1px solid var(--ink-3, #bba98b)", borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <Icon name="feather" size={20}/><h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Build the first thread of your world</h2>
              </div>
              <p style={{ margin: "0 0 16px", color: "var(--ink-2)" }}>Start with prose, create an entity manually, discover entities from a manuscript, or use Idea Forge when you want a new pressure point. Loomwright will connect the pieces as the project grows.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button className="home__hero-cta" onClick={() => onSetRoute?.("writers-room")} data-testid="home-empty-open-writers-room"><Icon name="feather" size={12}/> Start writing</button>
                <button className="home__hero-cta home__hero-cta--ghost" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "cast" } }))} data-testid="home-empty-create-character"><Icon name="plus" size={12}/> Create first entity</button>
                <button className="home__hero-cta home__hero-cta--ghost" onClick={() => onSetRoute?.("today")} data-testid="home-empty-idea-forge"><Icon name="sparkle" size={12}/> Open Idea Forge</button>
                <button className="home__hero-cta home__hero-cta--ghost" onClick={onOpenImportFlow} data-testid="home-empty-import"><Icon name="upload" size={12}/> Import project</button>
                <button className="home__hero-cta home__hero-cta--ghost" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "references" } }))} data-testid="home-empty-add-references"><Icon name="book" size={12}/> Add references</button>
                <button className="home__hero-cta home__hero-cta--ghost" onClick={() => { if (!window.confirm || window.confirm("Load the removable sample project? Your own records are preserved.")) state?.backend?.SampleProjectService?.loadSample?.(); }} data-testid="home-empty-load-sample"><Icon name="eye" size={12}/> View sample project</button>
              </div>
            </div>
          )}

          <header className="home__hero">
            <div className="home__hero-eyebrow"><span>{BRAND?.project?.name || "Loomwright project"}</span><span className="home__hero-dot">·</span><span>Author + World Engine</span></div>
            <h1 className="home__hero-title">Story Command Centre</h1>
            <p className="home__hero-sub">One live picture of the manuscript, its entities, their history, the review queue, and every tracked knock-on effect.</p>
            <div className="home__hero-meta">
              <span className="home__hero-chip"><span className="home__hero-chip__dot home__hero-chip__dot--ok"/>Last saved · {formatRelative(lastSaved)}</span>
              <span className="home__hero-chip">Story graph · {dash.storyHealth}%</span>
              <span className="home__hero-chip">Extraction coverage · {dash.extractionCoverage}%</span>
              <button className="home__hero-cta" onClick={() => onSetRoute?.("writers-room")}><Icon name="feather" size={12}/> Continue writing</button>
              <button className="home__hero-cta home__hero-cta--ghost" onClick={() => onSetRoute?.("today")}><Icon name="sparkle" size={12}/> Open Today</button>
            </div>
          </header>

          <div className="home__grid">
            <HomeCard className="home-card--manuscript" eyebrow="Living manuscript" title="Draft & tracking progress" action={<button className="home-link" onClick={() => onSetRoute?.("writers-room")}>Open Writer's Room →</button>}>
              <div className="home-stats">
                <Metric label="Chapters" value={dash.chapterCount} sub={`${dash.occurrenceCount} tracked occurrences`}/>
                <Metric label="Words" value={dash.words.toLocaleString()} sub={`of ${(state?.targetWords || 90000).toLocaleString()}`}/>
                <Metric label="Active" value={activeNumber ? `Ch. ${activeNumber}` : "—"} sub={state?.active?.title || "No active chapter"}/>
                <Metric label="Active chapter" value={(state?.activeWords || 0).toLocaleString()} sub="words on the current page"/>
              </div>
              <div style={{ marginTop: 12 }}>
                <HomeProgressBar value={dash.words} max={state?.targetWords || 90000} label="Toward manuscript target" sub={`${progress}% drafted · ${dash.extractionCoverage}% connected to the story graph`}/>
              </div>
            </HomeCard>

            <HomeCard className="home-card--review" eyebrow="Story pulse" title="Connection health" action={<button className="home-link" onClick={() => onSetRoute?.("today")}>See all insights →</button>}>
              <div className="home-stats">
                <Metric label="Health" value={`${dash.storyHealth}%`} sub="depth + connection" tone={dash.storyHealth >= 70 ? "ok" : undefined}/>
                <Metric label="Entity depth" value={`${dash.avgCompleteness || 0}%`} sub="average dossier completeness"/>
                <Metric label="Unplaced" value={dash.unplacedCount} sub="Atlas staging"/>
                <Metric label="Broken links" value={dash.danglingCount} sub="need repair" tone={dash.danglingCount ? "warn" : "ok"}/>
              </div>
            </HomeCard>

            <HomeCard className="home-card--entities" eyebrow="World model" title="Entity systems" action={<span className="home-card__action-sub">{dash.entityCount} live records</span>}>
              <div className="home-entity-grid">
                {typeRows.length === 0 && <div style={{ padding: 10, color: "var(--ink-4)", fontStyle: "italic" }}>Entities will appear here as they are written, extracted, created, or generated as drafts.</div>}
                {typeRows.slice(0, 14).map((e) => (
                  <button key={e.id} className="home-entity-tile" onClick={() => onOpenPanel?.(e.id)} title={`Open ${e.label}`}>
                    <span className="home-entity-tile__glyph" style={{ background: e.color }}>{e.glyph}</span>
                    <span className="home-entity-tile__lbl">{e.label}</span>
                    <span className="home-entity-tile__count">{e.count}</span>
                    {e.queue > 0 && <span className="home-entity-tile__queue">{e.queue}</span>}
                  </button>
                ))}
              </div>
            </HomeCard>

            <HomeCard className="home-card--warnings" eyebrow="Impact watch" title={`Major decisions · ${highImpact.length}`} action={<button className="home-link" onClick={onOpenReviewQueue}>Open queue →</button>}>
              <InsightRows rows={highImpact} empty="No high-impact review decisions are pending" onOpen={openSuggestion}/>
            </HomeCard>

            <HomeCard className="home-card--warnings" eyebrow="Continuity" title={`Risks · ${risks.length}`} action={<button className="home-link" onClick={() => onSetRoute?.("today")}>Investigate →</button>}>
              <InsightRows rows={risks} empty="No structural continuity risks are currently detected" onOpen={(row) => { openSuggestion(row); onOpenContinuityWarning?.(row); }}/>
            </HomeCard>

            <HomeCard className="home-card--today-bridge" eyebrow="Next best moves" title="Story opportunities" action={<button className="home-link" onClick={() => onSetRoute?.("today")}>Open Today →</button>}>
              <InsightRows rows={opportunities} empty="Write or extract more material to generate opportunities" onOpen={openSuggestion}/>
            </HomeCard>

            <HomeCard className="home-card--pi" eyebrow="Project intelligence" title="Canon, voice & references" action={<button className="home-link" onClick={onOpenProjectIntelligence}>Open file →</button>}>
              <div className="home-stats">
                <Metric label="Canon rules" value={state?.canonRules?.length || 0} sub="facts, beliefs, rumours, secrets"/>
                <Metric label="References" value={state?.references?.length || 0} sub="research + source material"/>
                <Metric label="Style" value={state?.intel?.writingStyleGuide ? "Ready" : "Missing"} sub="voice guidance" tone={state?.intel?.writingStyleGuide ? "ok" : "warn"}/>
                <Metric label="Dormant cast" value={dash.dormantCount} sub="possible callbacks"/>
              </div>
            </HomeCard>

            <HomeCard className="home-card--quick" eyebrow="Entity injection" title="Create, discover, or invent">
              {typeof IdeaForge !== "undefined" ? <IdeaForge compact/> : (
                <div className="home-quick">
                  <button className="home-quick__tile" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "cast" } }))}><Icon name="plus" size={16}/><span>Create manually</span></button>
                  <button className="home-quick__tile" onClick={() => window.LoomwrightDispatchCallback?.("onOpenExtractionWizard", { detail: { scope: "manuscript" } })}><Icon name="sparkle" size={16}/><span>Discover in prose</span></button>
                </div>
              )}
            </HomeCard>

            <HomeCard className="home-card--activity" eyebrow="Accountable history" title="Recent activity">
              <ol className="home-activity" data-ui="HomeRecentActivity">
                {!state?.audit?.length && <li className="home-activity__row home-activity__row--empty"><span className="home-activity__text" style={{ fontStyle: "italic", opacity: .65 }}>Every meaningful edit will appear here with author, time, and undo where safe.</span></li>}
                {(state?.audit || []).map((evt) => (
                  <li key={evt.id} className="home-activity__row" onClick={() => openAudit(evt)}>
                    <span className="home-activity__dot home-activity__dot--entity"/>
                    <span className="home-activity__text">{evt.label || evt.action}</span>
                    <span className="home-activity__when">{formatRelative(evt.createdAt)}</span>
                    {state.backend?.AuditService?.canUndo?.(evt.id) && <button className="home-activity__undo" onClick={(e) => { e.stopPropagation(); state.backend.AuditService.undo(evt.id); }}>Undo</button>}
                  </li>
                ))}
              </ol>
            </HomeCard>

            <HomeCard className="home-card--quick" eyebrow="Jump to" title="Working surfaces">
              <div className="home-quick">
                {[
                  ["writers-room", "Writer's Room", "feather", "route"], ["today", "Today", "sparkle", "route"],
                  ["cast", "Cast", "user", "panel"], ["atlas", "Atlas", "map", "panel"], ["relationships", "Relationships", "link", "panel"],
                  ["timeline", "Timeline", "clock", "panel"], ["quests", "Story Threads", "scroll", "panel"], ["tangle", "Tangle", "knot", "panel"],
                ].map(([id, label, icon, kind]) => <button key={id} className="home-quick__tile" onClick={() => kind === "route" ? onSetRoute?.(id) : onOpenPanel?.(id)}><Icon name={icon} size={16}/><span>{label}</span></button>)}
              </div>
            </HomeCard>
          </div>
        </div>
      </div>
    );
  };

  window.HomeScreen = HomeScreen;
})();
