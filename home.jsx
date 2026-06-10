// =====================================================================
// home.jsx — Home dashboard (project command centre)
//
// Home ≠ Today.
// Home = project overview: manuscript health, entity counts, review
//        queue summary, project intelligence, recent activity,
//        continuity warnings, quick launch.
// Today = action recommendations (lives in today-ai.jsx).
//
// Rendered at routeId === "home" from app.jsx.
// =====================================================================

const { useState: _hm_us, useMemo: _hm_um, useCallback: _hm_uc } = React;

// ---------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------
const HOME_MANUSCRIPT = {
  chaptersDrafted: 7,
  chaptersReserved: 3,
  wordCount: 31482,
  targetWordCount: 90000,
  lastChapterId: "c7",
  lastChapterTitle: "Ash & Auger",
  lastChapterWords: 3214,
  lastSavedHuman: "2 min ago",
};

const HOME_RECENT_ACTIVITY = [
  { id: "ra1", kind: "chapter",    text: "Edited Ch. 7 — Ash & Auger",                when: "2 min ago",  link: { type: "writers-room" } },
  { id: "ra2", kind: "extraction", text: "Accepted 4 candidates from Ch. 7",          when: "12 min ago", link: { type: "review" } },
  { id: "ra3", kind: "entity",     text: "Created Saren of Hess (Cast)",              when: "1 hr ago",   link: { type: "cast", id: "c2" } },
  { id: "ra4", kind: "entity",     text: "Updated The Auger Wake (Events)",           when: "2 hr ago",   link: { type: "events", id: "e1" } },
  { id: "ra5", kind: "panel",      text: "Opened Atlas · centred on Vraska Pass",     when: "3 hr ago",   link: { type: "atlas" } },
  { id: "ra6", kind: "extraction", text: "Denied 2 weak ownership candidates",        when: "Yesterday",  link: { type: "review" } },
];

const HOME_WARNINGS = [
  { id: "w1", level: "danger",  title: "Auger of Hess: contradictory ownership",
    body: "Lost in Ch. 5, used in Ch. 6 — reconcile or split entity.", action: "Open quest log",  link: { type: "items", id: "i1" } },
  { id: "w2", level: "warn",    title: "Saren of Hess: dormant for 4 chapters",
    body: "Last mention Ch. 3; flagged Important — wake or sleep?",   action: "Open Cast",       link: { type: "cast", id: "c2" } },
  { id: "w3", level: "warn",    title: "Vraska Pass: unplaced on Atlas",
    body: "Referenced in 3 chapters with no coordinates.",              action: "Place on Atlas",  link: { type: "atlas" } },
  { id: "w4", level: "info",    title: "Glass Court: contradicts canon",
    body: "Canon says no banner; Ch. 4 shows one. Add canon variant?",  action: "Open Lore",       link: { type: "lore" } },
];

const HOME_PI = {
  completion: 64,
  styleProfile: "Established",
  canonRules: 12,
  references: 7,
  missing: ["Tone bible — sword scenes", "Casting glossary"],
};

const HOME_REVIEW = {
  total: 23,
  high: 6,
  strong: 8,
  uncertain: 6,
  weak: 3,
  autoAccepted: 17,
  needsDecision: 9,
};

const HOME_ENTITY_HEALTH = [
  { id: "cast",      label: "Cast",         count: 14, queue: 1, color: "#7a5aa3", glyph: "C" },
  { id: "locations", label: "Locations",    count: 9,  queue: 2, color: "#5b7a4a", glyph: "L" },
  { id: "items",     label: "Items",        count: 11, queue: 4, color: "#9a7b3a", glyph: "I" },
  { id: "quests",    label: "Quests",       count: 6,  queue: 1, color: "#a85a72", glyph: "Q" },
  { id: "events",    label: "Events",       count: 18, queue: 3, color: "#c79545", glyph: "E" },
  { id: "timeline",  label: "Timeline",     count: 24, queue: 0, color: "#6a7a8a", glyph: "T" },
  { id: "lore",      label: "Lore",         count: 12, queue: 2, color: "#7a5a3a", glyph: "L" },
  { id: "bestiary",  label: "Bestiary",     count: 4,  queue: 0, color: "#a84a3a", glyph: "B" },
];

const HOME_QUICK_LAUNCH = [
  { id: "writers-room", label: "Writer's Room",   icon: "feather", kind: "route" },
  { id: "atlas",        label: "Atlas",           icon: "map",     kind: "panel" },
  { id: "cast",         label: "Cast",            icon: "user",    kind: "panel" },
  { id: "locations",    label: "Locations",       icon: "pin",     kind: "panel" },
  { id: "items",        label: "Items",           icon: "key",     kind: "panel" },
  { id: "quests",       label: "Quests",          icon: "scroll",  kind: "panel" },
  { id: "timeline",     label: "Timeline",        icon: "clock",   kind: "panel" },
  { id: "lore",         label: "Lore / Canon",    icon: "book",    kind: "panel" },
];

// ---------------------------------------------------------------------
// Mini-widgets
// ---------------------------------------------------------------------
const HomeCard = ({ title, eyebrow, action, children, className = "", ...rest }) => (
  <section className={"home-card " + className} {...rest}>
    <header className="home-card__head">
      <div>
        {eyebrow && <div className="home-card__eyebrow">{eyebrow}</div>}
        <div className="home-card__title">{title}</div>
      </div>
      {action && <div className="home-card__action">{action}</div>}
    </header>
    <div className="home-card__body">{children}</div>
  </section>
);

const HomeStat = ({ label, value, sub, tone }) => (
  <div className={"home-stat" + (tone ? " home-stat--" + tone : "")}>
    <div className="home-stat__val">{value}</div>
    <div className="home-stat__lbl">{label}</div>
    {sub && <div className="home-stat__sub">{sub}</div>}
  </div>
);

const HomeProgressBar = ({ value, max, label, sub }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="home-progress">
      <div className="home-progress__head">
        <span className="home-progress__lbl">{label}</span>
        <span className="home-progress__val">{value.toLocaleString()} / {max.toLocaleString()} · {pct}%</span>
      </div>
      <div className="home-progress__track"><div className="home-progress__fill" style={{ width: pct + "%" }}/></div>
      {sub && <div className="home-progress__sub">{sub}</div>}
    </div>
  );
};

// ---------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------
function _homeFormatRelative(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " hr ago";
  const d = Math.floor(h / 24);
  if (d < 7) return d + " day" + (d === 1 ? "" : "s") + " ago";
  return new Date(iso).toLocaleDateString();
}
function _homeKindForAction(action) {
  if (!action) return "panel";
  if (action.startsWith("chapter.")) return "chapter";
  if (action.startsWith("review.")) return "extraction";
  if (action.startsWith("entity.")) return "entity";
  if (action.startsWith("reference.")) return "panel";
  if (action.startsWith("sample.") || action === "project.reset") return "panel";
  if (action === "audit.undo") return "panel";
  return "panel";
}

const HomeScreen = ({
  onOpenPanel, onSetRoute, onOpenReviewQueue,
  onOpenProjectIntelligence, onOpenContinuityWarning,
  onOpenRecentEntity, onOpenImportFlow,
}) => {
  // Live project stats — recomputed on every store mutation. A fresh
  // project yields zeros, never the static demo numbers.
  const [statsTick, setStatsTick] = React.useState(0);
  React.useEffect(() => {
    const bump = () => setStatsTick((t) => t + 1);
    window.addEventListener("lw:entity-store-updated", bump);
    window.addEventListener("lw:review-queue-updated", bump);
    window.addEventListener("lw:manuscript-chapters-updated", bump);
    window.addEventListener("lw:project-imported", bump);
    window.addEventListener("lw:backend-ready", bump);
    return () => {
      window.removeEventListener("lw:entity-store-updated", bump);
      window.removeEventListener("lw:review-queue-updated", bump);
      window.removeEventListener("lw:manuscript-chapters-updated", bump);
      window.removeEventListener("lw:project-imported", bump);
      window.removeEventListener("lw:backend-ready", bump);
    };
  }, []);
  const live = React.useMemo(() => {
    void statsTick;
    const B = window.LoomwrightBackend;
    if (!B?.EntityService) return null;
    const chapters = B.ManuscriptChapterService?.loadSync()?.chapters || [];
    const words = chapters.reduce((sum, c) => sum + ((c.bodyText || (c.bodyHtml || "").replace(/<[^>]+>/g, "")).trim().split(/\s+/).filter(Boolean).length), 0);
    const queue = (B.ReviewService?.listSync() || []).filter((q) => q.status !== "done");
    const band = (b) => queue.filter((q) => (q.level || q.confidenceBand) === b).length;
    const intel = B.ProjectIntelService?.loadSync?.() || {};
    const refs = B.ReferencesService?.listSync?.() || [];
    const types = ["cast", "locations", "items", "quests", "events", "timeline", "lore", "bestiary"];
    const typeMeta = { cast: "#7a5aa3", locations: "#5b7a4a", items: "#9a7b3a", quests: "#a85a72", events: "#c79545", timeline: "#6a7a8a", lore: "#7a5a3a", bestiary: "#a84a3a" };
    const entityHealth = types.map((t) => ({
      id: t, label: t[0].toUpperCase() + t.slice(1), color: typeMeta[t], glyph: t[0].toUpperCase(),
      count: B.EntityService.listSync(t).length,
      queue: (B.ReviewService?.listSync(t) || []).length,
    }));
    const mcState = B.ManuscriptChapterService?.loadSync?.() || {};
    const activeIx = chapters.findIndex((c) => c.id === mcState.activeChapterId);
    const activeChapter = activeIx >= 0 ? chapters[activeIx] : chapters[chapters.length - 1];
    const wordsToday = B.ManuscriptChapterService?.writingStatsSync?.().wordsToday ?? 0;
    const target = Number(B.SettingsService?.getSectionSync?.("project", {})?.targetWordCount) || 90000;
    // Pace line: derived from today's output against the remaining target.
    const remaining = Math.max(0, target - words);
    const paceSub = !words ? "Write your first words to start the clock"
      : wordsToday > 0
        ? "~" + Math.max(1, Math.ceil(remaining / wordsToday)) + " writing days left at today's pace"
        : remaining > 0 ? remaining.toLocaleString() + " words to the draft target" : "Draft target reached";
    return {
      ms: {
        chaptersDrafted: chapters.length,
        chaptersReserved: chapters.filter((c) => c.reserved).length,
        wordCount: words,
        targetWordCount: target,
        activeChapterNum: activeChapter ? (activeChapter.num || (activeIx >= 0 ? activeIx + 1 : chapters.length)) : null,
        wordsToday,
        paceSub,
        lastChapterTitle: chapters[chapters.length - 1]?.title || "—",
        lastSavedHuman: chapters.length ? "saved locally" : "no chapters yet",
      },
      PI: {
        completion: Math.min(100, Math.round(((Array.isArray(intel.canonRules) ? intel.canonRules.length : 0) + refs.length) * 5)),
        styleProfile: intel.writingStyleGuide ? "Established" : "Not set",
        canonRules: Array.isArray(intel.canonRules) ? intel.canonRules.length : 0,
        references: refs.length,
        missing: [],
      },
      RQ: {
        total: queue.length, high: band("high"), strong: band("strong"),
        uncertain: band("uncertain"), weak: band("weak"),
        autoAccepted: 0, needsDecision: queue.length,
      },
      entityHealth,
    };
  }, [statsTick]);

  // Continuity warnings are populated by a real continuity check
  // (lw:continuity-check), not invented. Empty by default.
  const [warnings, setWarnings] = React.useState([]);
  React.useEffect(() => {
    const onCheck = (e) => {
      const conflicts = e?.detail?.conflicts || [];
      setWarnings(conflicts.map((c, i) => ({
        id: "cw-" + i, level: "warn",
        title: c.claim || c.reference || "Possible contradiction",
        body: c.evidence || c.claim || "", action: "Open Lore", link: { type: "lore" },
      })));
    };
    window.addEventListener("lw:continuity-check", onCheck);
    return () => window.removeEventListener("lw:continuity-check", onCheck);
  }, []);

  const ms = live?.ms || { chaptersDrafted: 0, chaptersReserved: 0, wordCount: 0, targetWordCount: 90000, activeChapterNum: null, wordsToday: 0, paceSub: "", lastChapterTitle: "—", lastSavedHuman: "no chapters yet" };
  const PI = live?.PI || { completion: 0, styleProfile: "Not set", canonRules: 0, references: 0, missing: [] };
  const RQ = live?.RQ || { total: 0, high: 0, strong: 0, uncertain: 0, weak: 0, autoAccepted: 0, needsDecision: 0 };
  const entityHealth = live?.entityHealth || [];

  // Live recent activity from AuditService — re-reads on every audit
  // event. Falls back to sample rows only when log is genuinely empty.
  const [auditTick, setAuditTick] = React.useState(0);
  React.useEffect(() => {
    const refresh = () => setAuditTick((t) => t + 1);
    window.addEventListener("lw:audit-log-updated", refresh);
    window.addEventListener("lw:audit-undo-applied", refresh);
    window.addEventListener("lw:audit-log-cleared", refresh);
    return () => {
      window.removeEventListener("lw:audit-log-updated", refresh);
      window.removeEventListener("lw:audit-undo-applied", refresh);
      window.removeEventListener("lw:audit-log-cleared", refresh);
    };
  }, []);
  const liveActivity = React.useMemo(() => {
    const Audit = (typeof window !== "undefined") ? window.LoomwrightBackend?.AuditService : null;
    if (!Audit) return null;
    const events = Audit.getRecentSync(10);
    if (!events.length) return [];
    return events.map((e) => ({
      id: e.id,
      kind: _homeKindForAction(e.action),
      text: e.label || e.action,
      when: _homeFormatRelative(e.createdAt),
      undoable: Audit.canUndo(e.id),
      _event: e,
    }));
  }, [auditTick]);
  // Live audit activity only — never fall back to demo rows (fresh
  // project shows an empty activity list, not "Created Saren of Hess").
  const activityRows = liveActivity || [];

  const totalEntities = entityHealth.reduce((s, e) => s + e.count, 0);

  // ----- Fresh-project detection -----
  // When sample data has not been loaded AND the live entity store is
  // empty, show an explicit empty-state card at the top so the user is
  // never staring at a fake-but-static "Pale Reach" dashboard. The
  // demo cards below render as inspiration; the empty-state card is
  // the actionable surface.
  const [emptyState, setEmptyState] = _hm_us(() => {
    const sampleLoaded = !!window.__LW_SAMPLE_LOADED__;
    const ES = window.LoomwrightBackend?.EntityService;
    const live = ES ? ES.listAllSync() : {};
    const hasAny = Object.values(live).some((byId) => byId && Object.keys(byId).length);
    return !sampleLoaded && !hasAny;
  });
  React.useEffect(() => {
    const recompute = () => {
      const sampleLoaded = !!window.__LW_SAMPLE_LOADED__;
      const ES = window.LoomwrightBackend?.EntityService;
      const live = ES ? ES.listAllSync() : {};
      const hasAny = Object.values(live).some((byId) => byId && Object.keys(byId).length);
      setEmptyState(!sampleLoaded && !hasAny);
    };
    window.addEventListener("lw:entity-store-updated", recompute);
    window.addEventListener("lw:project-imported", recompute);
    window.addEventListener("lw:backend-ready", recompute);
    return () => {
      window.removeEventListener("lw:entity-store-updated", recompute);
      window.removeEventListener("lw:project-imported", recompute);
      window.removeEventListener("lw:backend-ready", recompute);
    };
  }, []);

  const handleQuickLaunch = (item) => {
    if (item.kind === "route") onSetRoute && onSetRoute(item.id);
    else onOpenPanel && onOpenPanel(item.id);
  };

  const handleEntityClick = (e) => onOpenPanel && onOpenPanel(e.id);

  const handleActivityClick = (row) => {
    if (!row.link) return;
    if (row.link.type === "writers-room") onSetRoute && onSetRoute("writers-room");
    else if (row.link.type === "review") onOpenReviewQueue && onOpenReviewQueue();
    else onOpenPanel && onOpenPanel(row.link.type);
  };

  const handleWarningClick = (w) => {
    if (!w.link) return;
    if (w.link.type === "writers-room") onSetRoute && onSetRoute("writers-room");
    else onOpenPanel && onOpenPanel(w.link.type);
    onOpenContinuityWarning && onOpenContinuityWarning(w);
  };

  return (
    <div className="home paper-grain" data-ui="HomeScreen" data-route="home">
      <div className="home__inner">

        {/* Empty-state card — shown when no live records exist AND the
            sample project hasn't been loaded. The dashboard below still
            renders as design reference, but this card is the actionable
            surface so a fresh user knows what to do next. */}
        {emptyState && (
          <div className="home__empty" data-ui="HomeEmptyState" style={{
            background: "var(--paper-soft, #f6efe2)",
            border: "1px solid var(--ink-3, #bba98b)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <Icon name="feather" size={20}/>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Start your Loomwright project</h2>
            </div>
            <p style={{ margin: "0 0 16px 0", color: "var(--ink-2, #6b5a3a)" }}>
              Your project is empty. Begin by opening Writer&apos;s Room, creating your first character,
              importing data, or loading the sample project to explore Loomwright with content.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                className="home__hero-cta"
                onClick={() => onSetRoute && onSetRoute("writers-room")}
                data-callback="onOpenWriterRoom"
                data-testid="home-empty-open-writers-room"
              >
                <Icon name="feather" size={12}/>
                Open Writer&apos;s Room
              </button>
              <button
                className="home__hero-cta home__hero-cta--ghost"
                onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "cast" } }))}
                data-callback="onCreateCast"
                data-testid="home-empty-create-character"
              >
                <Icon name="plus" size={12}/>
                Create first character
              </button>
              <button
                className="home__hero-cta home__hero-cta--ghost"
                onClick={onOpenImportFlow}
                data-callback="onImportProjectData"
                data-testid="home-empty-import"
              >
                <Icon name="upload" size={12}/>
                Import JSON
              </button>
              <button
                className="home__hero-cta home__hero-cta--ghost"
                onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "references" } }))}
                data-callback="onOpenReferences"
                data-testid="home-empty-add-references"
              >
                <Icon name="book" size={12}/>
                Add references
              </button>
              <button
                className="home__hero-cta home__hero-cta--ghost"
                onClick={() => {
                  if (!window.confirm) return;
                  if (window.confirm("Load the Pale Reach sample project? Sample records will be added; your existing work is preserved.")) {
                    window.LoomwrightBackend?.SampleProjectService?.loadSample();
                  }
                }}
                data-callback="onLoadSampleProject"
                data-testid="home-empty-load-sample"
              >
                <Icon name="sparkle" size={12}/>
                Load sample project
              </button>
            </div>
          </div>
        )}

        {/* Top: project header */}
        <header className="home__hero">
          <div className="home__hero-eyebrow">
            <span>{(typeof BRAND !== "undefined" && BRAND.project.name) || "Project"}</span>
            <span className="home__hero-dot">·</span>
            <span>{(typeof BRAND !== "undefined" && BRAND.project.book) || ""}</span>
          </div>
          <h1 className="home__hero-title">Project Command Centre</h1>
          <p className="home__hero-sub">
            Manuscript, entity systems, extraction queue, and project intelligence — at a glance.
          </p>
          <div className="home__hero-meta">
            <span className="home__hero-chip">
              <span className="home__hero-chip__dot home__hero-chip__dot--ok"/>
              Last saved · {ms.lastSavedHuman}
            </span>
            <span className="home__hero-chip">
              <span className="home__hero-chip__dot home__hero-chip__dot--ok"/>
              Local-only · encrypted
            </span>
            <span className="home__hero-chip">
              Project Intelligence · {PI.completion}%
            </span>
            <button className="home__hero-cta" onClick={() => onSetRoute && onSetRoute("writers-room")} data-callback="onOpenWriterRoom">
              <Icon name="feather" size={12}/>
              Continue writing
            </button>
            <button className="home__hero-cta home__hero-cta--ghost" onClick={onOpenImportFlow} data-callback="onOpenImportFlow">
              <Icon name="plus" size={12}/>
              Import manuscript
            </button>
          </div>
        </header>

        {/* Body grid */}
        <div className="home__grid">

          {/* Manuscript Progress (large) */}
          <HomeCard
            className="home-card--manuscript"
            eyebrow="Manuscript"
            title="Progress"
            action={
              <button className="home-link" onClick={() => onSetRoute && onSetRoute("writers-room")} data-callback="onOpenWriterRoom">
                Open Writer's Room →
              </button>
            }
          >
            <div className="home-stats">
              <HomeStat label="Chapters" value={ms.chaptersDrafted} sub={"+ " + ms.chaptersReserved + " reserved"}/>
              <HomeStat label="Words"    value={ms.wordCount.toLocaleString()} sub={"of " + ms.targetWordCount.toLocaleString()}/>
              <HomeStat label="Active"   value={ms.activeChapterNum ? "Ch. " + ms.activeChapterNum : "—"} sub={ms.lastChapterTitle}/>
              <HomeStat label="Today"    value={"+" + (ms.wordsToday ?? 0).toLocaleString()} sub="words added" tone={ms.wordsToday ? "ok" : undefined}/>
            </div>
            <div style={{ marginTop: 12 }}>
              <HomeProgressBar value={ms.wordCount} max={ms.targetWordCount} label="Toward draft target" sub={ms.paceSub || ""}/>
            </div>
          </HomeCard>

          {/* Entity System Health */}
          <HomeCard
            className="home-card--entities"
            eyebrow="Entities"
            title="System health"
            action={<span className="home-card__action-sub">{totalEntities} entries</span>}
          >
            <div className="home-entity-grid">
              {entityHealth.map((e) => (
                <button
                  key={e.id}
                  className="home-entity-tile"
                  onClick={() => handleEntityClick(e)}
                  title={"Open " + e.label}
                  data-callback="onOpenPanelFromHome"
                  data-panel-kind={e.id}
                >
                  <span className="home-entity-tile__glyph" style={{ background: e.color }}>{e.glyph}</span>
                  <span className="home-entity-tile__lbl">{e.label}</span>
                  <span className="home-entity-tile__count">{e.count}</span>
                  {e.queue > 0 && <span className="home-entity-tile__queue">{e.queue}</span>}
                </button>
              ))}
            </div>
          </HomeCard>

          {/* Review Queue Summary */}
          <HomeCard
            className="home-card--review"
            eyebrow="Extraction"
            title="Review queue"
            action={
              <button className="home-link" onClick={onOpenReviewQueue} data-callback="onOpenReviewQueue">
                Open queue →
              </button>
            }
          >
            <div className="home-review">
              <div className="home-review__total">
                <div className="home-review__total-num">{RQ.total}</div>
                <div className="home-review__total-lbl">in queue</div>
              </div>
              <div className="home-review__bars">
                <div className="home-review__bar home-review__bar--high">
                  <span className="home-review__bar-lbl">High</span>
                  <span className="home-review__bar-track"><span className="home-review__bar-fill" style={{ width: (RQ.high / (RQ.total || 1) * 100) + "%" }}/></span>
                  <span className="home-review__bar-num">{RQ.high}</span>
                </div>
                <div className="home-review__bar home-review__bar--strong">
                  <span className="home-review__bar-lbl">Strong</span>
                  <span className="home-review__bar-track"><span className="home-review__bar-fill" style={{ width: (RQ.strong / (RQ.total || 1) * 100) + "%" }}/></span>
                  <span className="home-review__bar-num">{RQ.strong}</span>
                </div>
                <div className="home-review__bar home-review__bar--uncertain">
                  <span className="home-review__bar-lbl">Uncertain</span>
                  <span className="home-review__bar-track"><span className="home-review__bar-fill" style={{ width: (RQ.uncertain / (RQ.total || 1) * 100) + "%" }}/></span>
                  <span className="home-review__bar-num">{RQ.uncertain}</span>
                </div>
                <div className="home-review__bar home-review__bar--weak">
                  <span className="home-review__bar-lbl">Weak</span>
                  <span className="home-review__bar-track"><span className="home-review__bar-fill" style={{ width: (RQ.weak / (RQ.total || 1) * 100) + "%" }}/></span>
                  <span className="home-review__bar-num">{RQ.weak}</span>
                </div>
              </div>
            </div>
            <div className="home-review__foot">
              <span><b>{RQ.autoAccepted}</b> auto-accepted this session</span>
              <span><b>{RQ.needsDecision}</b> need your decision</span>
            </div>
          </HomeCard>

          {/* Project Intelligence */}
          <HomeCard
            className="home-card--pi"
            eyebrow="AI Context"
            title="Project Intelligence"
            action={
              <button className="home-link" onClick={onOpenProjectIntelligence} data-callback="onOpenProjectIntelligenceFile">
                Open file →
              </button>
            }
          >
            <div className="home-pi">
              <div className="home-pi__ring" style={{ "--pct": PI.completion }}>
                <div className="home-pi__ring-num">{PI.completion}%</div>
                <div className="home-pi__ring-lbl">complete</div>
              </div>
              <div className="home-pi__list">
                <div className="home-pi__row"><span>Style profile</span><b>{PI.styleProfile}</b></div>
                <div className="home-pi__row"><span>Canon rules</span><b>{PI.canonRules}</b></div>
                <div className="home-pi__row"><span>References</span><b>{PI.references}</b></div>
                <div className="home-pi__row home-pi__row--warn">
                  <span>Missing recommended</span>
                  <b>{PI.missing.length}</b>
                </div>
              </div>
            </div>
            {PI.missing.length > 0 && (
              <div className="home-pi__missing">
                {PI.missing.map((m, i) => (
                  <span key={i} className="home-pi__missing-chip">{m}</span>
                ))}
              </div>
            )}
          </HomeCard>

          {/* Continuity / Warnings — live (none until a continuity check runs) */}
          <HomeCard
            className="home-card--warnings"
            eyebrow="Continuity"
            title={"Warnings · " + warnings.length}
            action={<span className="home-card__action-sub">Run a continuity check</span>}
          >
            <div className="home-warnings">
              {warnings.length === 0 && (
                <div className="home-warning home-warning--info" style={{ fontStyle: "italic", opacity: 0.7 }}>
                  <div className="home-warning__body">
                    <div className="home-warning__title">No continuity warnings</div>
                    <div className="home-warning__sub">Run a continuity check in Writer's Room to surface contradictions.</div>
                  </div>
                </div>
              )}
              {warnings.map((w) => (
                <button key={w.id} className={"home-warning home-warning--" + w.level} onClick={() => handleWarningClick(w)}
                        data-callback="onOpenContinuityWarning">
                  <span className={"home-warning__dot home-warning__dot--" + w.level}/>
                  <div className="home-warning__body">
                    <div className="home-warning__title">{w.title}</div>
                    <div className="home-warning__sub">{w.body}</div>
                  </div>
                  <span className="home-warning__action">{w.action} →</span>
                </button>
              ))}
            </div>
          </HomeCard>

          {/* Recent Activity */}
          <HomeCard
            className="home-card--activity"
            eyebrow="History"
            title="Recent activity"
          >
            <ol className="home-activity" data-ui="HomeRecentActivity">
              {activityRows.length === 0 && (
                <li className="home-activity__row home-activity__row--empty">
                  <span className="home-activity__text" style={{ fontStyle: "italic", opacity: 0.6 }}>Activity will appear here as you work.</span>
                </li>
              )}
              {activityRows.map((a) => (
                <li
                  key={a.id}
                  className="home-activity__row"
                  data-callback="onOpenRecentActivityItem"
                  data-event-id={a._event?.id || a.id}
                  data-testid={"home-activity-" + a.id}
                  onClick={() => {
                    if (a._event) {
                      window.dispatchEvent(new CustomEvent("lw:open-search-result", { detail: {
                        type: a._event.targetType,
                        entityType: a._event.entityType,
                        entityId: a._event.targetType === "entity" ? a._event.targetId : null,
                        chapterId: a._event.targetType === "chapter" ? a._event.targetId : null,
                        referenceId: a._event.targetType === "reference" ? a._event.targetId : null,
                        settingsSectionId: a._event.targetType === "settings" ? a._event.targetId : null,
                        reviewItemId: a._event.targetType === "review" ? a._event.targetId : null,
                      } }));
                    } else {
                      handleActivityClick(a);
                    }
                  }}
                >
                  <span className={"home-activity__dot home-activity__dot--" + a.kind}/>
                  <span className="home-activity__text">{a.text}</span>
                  <span className="home-activity__when">{a.when}</span>
                  {a.undoable && (
                    <button
                      type="button"
                      className="home-activity__undo"
                      data-callback="onUndoAuditEvent"
                      data-event-id={a._event.id}
                      data-testid={"home-undo-" + a._event.id}
                      title="Undo this action"
                      onClick={(e) => {
                        e.stopPropagation();
                        const B = window.LoomwrightBackend;
                        if (!B?.AuditService) return;
                        B.AuditService.undo(a._event.id).catch((err) => {
                          window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: err.message || "Could not undo." } }));
                        });
                      }}
                    >
                      Undo
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </HomeCard>

          {/* Quick Launch */}
          <HomeCard
            className="home-card--quick"
            eyebrow="Jump to"
            title="Quick launch"
          >
            <div className="home-quick">
              {HOME_QUICK_LAUNCH.map((q) => (
                <button key={q.id} className="home-quick__tile" onClick={() => handleQuickLaunch(q)} data-callback="onOpenPanelFromHome">
                  <Icon name={q.icon} size={16}/>
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
          </HomeCard>

          {/* Today bridge — distinct from Today screen, gently hands off */}
          <HomeCard
            className="home-card--today-bridge"
            eyebrow="Today"
            title="What to work on next"
            action={
              <button className="home-link" onClick={() => onSetRoute && onSetRoute("today")} data-callback="onOpenTodayFromHome">
                Open Today →
              </button>
            }
          >
            <div className="home-today-bridge">
              <div className="home-today-bridge__note">
                Today is a separate action plan: prompts, dormant entities, and dangling threads — all derived from your live project.
              </div>
            </div>
          </HomeCard>

        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  HomeScreen,
  HOME_MANUSCRIPT, HOME_RECENT_ACTIVITY, HOME_WARNINGS,
  HOME_PI, HOME_REVIEW, HOME_ENTITY_HEALTH, HOME_QUICK_LAUNCH,
});
