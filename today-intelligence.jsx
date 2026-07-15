// =====================================================================
// today-intelligence.jsx — enhanced live Today experience.
//
// Loaded after backend-services.jsx + story-intelligence.jsx. It replaces the
// original lightweight Today renderers while preserving the existing panel,
// route, callbacks, design language, AI Writer, and service architecture.
// =====================================================================

(function () {
  const SECTIONS = [
    { id: "continuity", title: "Continuity & impact", sub: "Conflicts, broken links, duplicate identities, and changes with a wide blast radius." },
    { id: "queue", title: "Review decisions", sub: "Extracted changes waiting for confirmation, now with their knock-on effects." },
    { id: "threads", title: "Story tracking gaps", sub: "Chapters or entities that are not yet fully connected to the live story graph." },
    { id: "quests", title: "Open story threads", sub: "Promises, mysteries, goals, quests, branches, and unresolved steps." },
    { id: "untouched", title: "Dormant & unplaced", sub: "Characters, objects, and places that may need a callback, decision, or Atlas placement." },
    { id: "intel", title: "Entity intelligence", sub: "Important records that need richer motives, history, context, or canon." },
    { id: "inspiration", title: "Idea Forge", sub: "Free local seeds built to connect with the project rather than generic random prompts." },
  ];

  function SI() {
    return window.LoomwrightBackend?.StoryIntelligenceService || window.StoryIntelligenceService || null;
  }

  function liveSuggestions() {
    try { return SI()?.buildSuggestions?.({ limit: 40 }) || []; }
    catch (err) {
      console.warn("[Today] story intelligence failed", err);
      return [];
    }
  }

  // Replace the original static/live-basic builder with the richer service.
  buildTodaySuggestions = liveSuggestions;
  TODAY_SECTIONS = SECTIONS;
  window.TODAY_SECTIONS = SECTIONS;

  useTodaySuggestions = function useTodayIntelligenceSuggestions() {
    const [tick, setTick] = React.useState(0);
    React.useEffect(() => {
      const bump = () => setTick((t) => t + 1);
      const names = [
        "lw:entity-store-updated",
        "lw:review-queue-updated",
        "lw:manuscript-chapters-updated",
        "lw:occurrence-store-updated",
        "lw:references-updated",
        "lw:project-intel-updated",
        "lw:project-imported",
        "lw:story-intelligence-ready",
        "lw:story-intelligence-updated",
        "lw:backend-ready",
      ];
      names.forEach((name) => window.addEventListener(name, bump));
      return () => names.forEach((name) => window.removeEventListener(name, bump));
    }, []);
    return React.useMemo(() => {
      void tick;
      return liveSuggestions();
    }, [tick]);
  };

  const TodayPulse = () => {
    const [tick, setTick] = React.useState(0);
    React.useEffect(() => {
      const bump = () => setTick((t) => t + 1);
      ["lw:entity-store-updated", "lw:review-queue-updated", "lw:manuscript-chapters-updated", "lw:occurrence-store-updated", "lw:story-intelligence-updated", "lw:backend-ready"]
        .forEach((n) => window.addEventListener(n, bump));
      return () => ["lw:entity-store-updated", "lw:review-queue-updated", "lw:manuscript-chapters-updated", "lw:occurrence-store-updated", "lw:story-intelligence-updated", "lw:backend-ready"]
        .forEach((n) => window.removeEventListener(n, bump));
    }, []);
    const dash = React.useMemo(() => {
      void tick;
      try { return SI()?.buildDashboard?.() || null; } catch (_) { return null; }
    }, [tick]);
    if (!dash || (!dash.chapterCount && !dash.entityCount)) return null;
    const metric = (label, value, sub, tone) => (
      <div style={{ minWidth: 120, padding: "10px 12px", border: "1px solid var(--line-2)", borderRadius: "var(--r-3)", background: "var(--bg-paper-2)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1, color: tone || "var(--ink-1)" }}>{value}</div>
        <div style={{ marginTop: 4, fontFamily: "var(--font-sans)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-3)" }}>{label}</div>
        {sub && <div style={{ marginTop: 3, fontSize: 10, color: "var(--ink-4)" }}>{sub}</div>}
      </div>
    );
    return (
      <div data-ui="TodayStoryPulse" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 14px", marginBottom: 18, border: "1px solid var(--line-2)", borderRadius: "var(--r-3)", background: "linear-gradient(135deg, var(--bg-paper-2), var(--bg-elev))" }}>
        <div style={{ minWidth: 210, flex: 1 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em", color: "var(--accent-deep)" }}>Live story pulse</div>
          <div style={{ marginTop: 4, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-1)" }}>
            {dash.storyHealth >= 75 ? "The story graph is well connected." : dash.storyHealth >= 45 ? "The project is taking shape—several links need attention." : "Build the tracking spine before the story becomes harder to untangle."}
          </div>
          <div style={{ marginTop: 4, fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--ink-3)" }}>
            Calculated from live chapters, entity depth, occurrences, links, Atlas placement, and pending review—not invented progress.
          </div>
        </div>
        {metric("Story health", dash.storyHealth + "%", "connection + completeness")}
        {metric("Tracked chapters", dash.extractionCoverage + "%", `${dash.occurrenceCount} occurrences`)}
        {metric("High-impact review", dash.highImpactReviewCount, `${dash.pendingReviewCount} total pending`, dash.highImpactReviewCount ? "var(--danger, #9f4038)" : undefined)}
        {metric("World gaps", dash.danglingCount + dash.unplacedCount, `${dash.danglingCount} broken · ${dash.unplacedCount} unplaced`)}
      </div>
    );
  };

  const IDEA_TYPES = [
    ["cast", "Character"], ["locations", "Location"], ["items", "Item"], ["quests", "Story thread"],
    ["events", "Event"], ["factions", "Faction"], ["lore", "Canon idea"], ["bestiary", "Creature"],
  ];

  const IdeaForge = ({ compact = false }) => {
    const [type, setType] = React.useState("cast");
    const [nonce, setNonce] = React.useState(() => Date.now());
    const [creating, setCreating] = React.useState(false);
    const service = SI();
    const seed = React.useMemo(() => {
      try { return service?.generateEntitySeed?.({ type, mode: "random", nonce }) || null; }
      catch (_) { return null; }
    }, [service, type, nonce]);

    const create = async () => {
      if (!seed || !service?.createIdeaEntity) return;
      setCreating(true);
      try {
        const entity = await service.createIdeaEntity(seed);
        window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: entity.type, initial: entity } }));
        setNonce(Date.now());
      } finally {
        setCreating(false);
      }
    };

    return (
      <div data-ui="IdeaForge" style={{ padding: compact ? 10 : 14, border: "1px solid var(--line-2)", borderRadius: "var(--r-3)", background: "var(--bg-elev)", boxShadow: "var(--shadow-1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ minWidth: 150, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".11em", color: "var(--accent-deep)" }}>Entity injection · Idea Forge</div>
            <div style={{ marginTop: 2, fontFamily: "var(--font-display)", fontSize: compact ? 16 : 19 }}>Create a useful complication, not random noise.</div>
          </div>
          <select value={type} onChange={(e) => { setType(e.target.value); setNonce(Date.now()); }} className="loc-body__filter" aria-label="Idea entity type">
            {IDEA_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <button className="rpg-btn rpg-btn--small" onClick={() => setNonce(Date.now())} title="Generate another local idea">
            <Icon name="sparkle" size={11}/> Surprise me
          </button>
        </div>
        {seed && (
          <div style={{ marginTop: 10, padding: 10, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: compact ? 16 : 19, color: "var(--ink-1)" }}>{seed.name}</div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-serif)", fontSize: 12, lineHeight: 1.5, color: "var(--ink-2)" }}>{seed.summary}</div>
            {!compact && seed.questions?.length > 0 && (
              <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                {seed.questions.slice(0, 3).map((q, i) => <div key={i} style={{ fontSize: 11, color: "var(--ink-3)" }}>• {q}</div>)}
              </div>
            )}
            {seed.suggestedLinks?.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                <span style={{ fontSize: 10, color: "var(--ink-4)" }}>Could connect to:</span>
                {seed.suggestedLinks.map((e) => <span key={e.id} className="rpg-chip">{ENTITY_TYPES[e.type]?.glyph || "·"} {e.name}</span>)}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <button className="rpg-btn rpg-btn--small rpg-btn--primary" onClick={create} disabled={creating} data-testid="idea-forge-create">
                {creating ? "Creating…" : "Create editable draft"}
              </button>
              <button className="rpg-btn rpg-btn--small" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type } }))}>
                Create manually
              </button>
              <button className="rpg-btn rpg-btn--small" onClick={() => window.LoomwrightDispatchCallback?.("onOpenExtractionWizard", { detail: { scope: "manuscript", typeFocus: type } })}>
                Discover from manuscript
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  function confidenceValue(level) {
    return level === "high" ? 95 : level === "strong" ? 80 : level === "uncertain" ? 58 : 40;
  }

  TodayCardCompact = ({ s, onSelectEntity }) => {
    const [busy, setBusy] = React.useState(false);
    const run = async () => {
      setBusy(true);
      try {
        const handled = await SI()?.executeSuggestion?.(s);
        if (!handled && s.related?.[0]) onSelectEntity?.(s.related[0]);
      } catch (err) {
        window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: err.message || "Could not open this suggestion." } }));
      } finally { setBusy(false); }
    };
    const dismiss = () => SI()?.dismissSuggestion?.(s.id);
    return (
      <article className="today__card" style={{ padding: 12 }} data-suggestion-id={s.id} data-section={s.section}>
        <div className="today__card-head">
          <ConfidenceBadge level={s.confidence} value={confidenceValue(s.confidence)}/>
          {s.impact && (
            <span title="Estimated linked impact" style={{ marginLeft: 6, padding: "2px 6px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-sans)", background: s.impact.severity === "critical" ? "rgba(159,64,56,.12)" : "var(--accent-soft)", color: s.impact.severity === "critical" ? "var(--danger, #9f4038)" : "var(--accent-deep)" }}>
              {s.impact.severity} impact · {s.impact.affected.length} linked
            </span>
          )}
          {s.chapter && s.chapter !== "—" && <span style={{ marginLeft: "auto" }}>{s.chapter}</span>}
        </div>
        <div className="today__card-title" style={{ fontSize: "var(--fs-lg)" }}>{s.title}</div>
        <div className="today__card-why">{s.why}</div>
        {s.related?.length > 0 && (
          <div className="today__card-chips">
            {s.related.map((r) => (
              <button key={`${r.type}-${r.id}`} className="rpg-chip" data-callback="onOpenRelatedTab" onClick={() => onSelectEntity?.(r)}>
                {(ENTITY_TYPES[r.type]?.glyph || "·")} {r.label}
              </button>
            ))}
          </div>
        )}
        {s.impact?.chapters?.length > 0 && (
          <div style={{ marginTop: 7, fontSize: 10, color: "var(--ink-4)" }}>
            Story reach: {s.impact.chapters.slice(0, 6).map((c) => `Ch. ${c.number} · ${c.title || "Untitled"}`).join("  |  ")}
          </div>
        )}
        <div className="today__card-actions">
          <button className="rpg-btn rpg-btn--small rpg-btn--primary" onClick={run} disabled={busy}>
            {busy ? "Opening…" : s.action}
          </button>
          <button className="rpg-btn rpg-btn--small" onClick={() => window.LoomwrightDispatchCallback?.("onSendSuggestionToTangle", { detail: s })}>→ Tangle</button>
          <button className="rpg-btn rpg-btn--small rpg-btn--ghost" onClick={dismiss}>Dismiss</button>
        </div>
      </article>
    );
  };

  TodayPanelBody = ({ panel, onSelectEntity }) => {
    const [filter, setFilter] = React.useState("all");
    const suggestions = useTodaySuggestions();
    const filtered = filter === "all" ? suggestions : suggestions.filter((s) => s.section === filter);
    return (
      <div className="loc-body" data-ui="TodayPanelBody">
        <div className="loc-body__top">
          <div className="loc-body__filters" style={{ flexWrap: "wrap" }}>
            <button className={"today__filter" + (filter === "all" ? " is-active" : "")} onClick={() => setFilter("all")}>All</button>
            {SECTIONS.map((s) => (
              <button key={s.id} className={"today__filter" + (filter === s.id ? " is-active" : "")} onClick={() => setFilter(s.id)}>{s.title.split(" ")[0]}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <IdeaForge compact/>
          {filtered.length === 0 && <div className="today__empty" style={{ padding: 16, color: "var(--ink-4)", fontStyle: "italic" }}>Nothing urgent is being inferred from the live project yet. Write, extract, or create an entity and Loomwright will build the next set of connections.</div>}
          {filtered.map((s) => <TodayCardCompact key={s.id} s={s} onSelectEntity={onSelectEntity}/>) }
        </div>
      </div>
    );
  };

  TodayScreen = ({ onSelectEntity }) => {
    const [filter, setFilter] = React.useState("all");
    const suggestions = useTodaySuggestions();
    const filtered = filter === "all" ? suggestions : suggestions.filter((s) => s.section === filter);
    const bySection = React.useMemo(() => {
      const map = {};
      filtered.forEach((s) => { (map[s.section] = map[s.section] || []).push(s); });
      return map;
    }, [filtered]);
    return (
      <div className="today" data-ui="TodayScreen">
        <div className="today__inner">
          <header className="today__head">
            <div className="today__greet-eyebrow">Today · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
            <h1 className="today__greet-title">What the living story needs next.</h1>
            <p className="today__greet-sub">Every recommendation is derived from your manuscript, entities, links, history, and review queue. Suggestions can create drafts or open the right evidence, but nothing becomes canon without the existing review and edit flow.</p>
            <div className="today__filters">
              <button className={"today__filter" + (filter === "all" ? " is-active" : "")} onClick={() => setFilter("all")}>All</button>
              {SECTIONS.map((sec) => <button key={sec.id} className={"today__filter" + (filter === sec.id ? " is-active" : "")} onClick={() => setFilter(sec.id)}>{sec.title}</button>)}
              <span style={{ flex: 1 }}/>
              <button className="today__filter" onClick={() => SI()?.restoreDismissedSuggestions?.()}>Restore dismissed</button>
            </div>
          </header>

          <TodayPulse/>
          <IdeaForge/>

          {filtered.length === 0 && (
            <section className="today__section" data-ui="TodayEmpty">
              <div className="today__section-head">
                <h2 className="today__section-title">No live recommendations in this view</h2>
                <span className="today__section-sub">That is a genuine empty state. Run extraction, deepen entities, or use Idea Forge to introduce a new pressure point.</span>
              </div>
            </section>
          )}

          {SECTIONS.filter((s) => filter === "all" || filter === s.id).map((sec) => {
            const items = bySection[sec.id] || [];
            if (!items.length) return null;
            return (
              <section key={sec.id} className="today__section">
                <div className="today__section-head">
                  <h2 className="today__section-title">{sec.title}</h2>
                  <span className="today__section-sub">{sec.sub}</span>
                </div>
                <div className="today__cards">{items.map((s) => <TodayCardCompact key={s.id} s={s} onSelectEntity={onSelectEntity}/>)}</div>
              </section>
            );
          })}
        </div>
      </div>
    );
  };

  Object.assign(window, { TodayPanelBody, TodayScreen, TodayCardCompact, IdeaForge, TodayPulse });
})();
