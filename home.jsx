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
const HomeScreen = ({
  onOpenPanel, onSetRoute, onOpenReviewQueue,
  onOpenProjectIntelligence, onOpenContinuityWarning,
  onOpenRecentEntity, onOpenImportFlow,
}) => {
  const ms = HOME_MANUSCRIPT;
  const PI = HOME_PI;
  const RQ = HOME_REVIEW;

  const totalEntities = HOME_ENTITY_HEALTH.reduce((s, e) => s + e.count, 0);

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
              <HomeStat label="Active"   value={"Ch. " + 7} sub={ms.lastChapterTitle}/>
              <HomeStat label="Today"    value={"+1,204"} sub="words added" tone="ok"/>
            </div>
            <div style={{ marginTop: 12 }}>
              <HomeProgressBar value={ms.wordCount} max={ms.targetWordCount} label="Toward draft target" sub="Steady pace · ~7 weeks remaining at current cadence"/>
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
              {HOME_ENTITY_HEALTH.map((e) => (
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
                  <span className="home-review__bar-track"><span className="home-review__bar-fill" style={{ width: (RQ.high / RQ.total * 100) + "%" }}/></span>
                  <span className="home-review__bar-num">{RQ.high}</span>
                </div>
                <div className="home-review__bar home-review__bar--strong">
                  <span className="home-review__bar-lbl">Strong</span>
                  <span className="home-review__bar-track"><span className="home-review__bar-fill" style={{ width: (RQ.strong / RQ.total * 100) + "%" }}/></span>
                  <span className="home-review__bar-num">{RQ.strong}</span>
                </div>
                <div className="home-review__bar home-review__bar--uncertain">
                  <span className="home-review__bar-lbl">Uncertain</span>
                  <span className="home-review__bar-track"><span className="home-review__bar-fill" style={{ width: (RQ.uncertain / RQ.total * 100) + "%" }}/></span>
                  <span className="home-review__bar-num">{RQ.uncertain}</span>
                </div>
                <div className="home-review__bar home-review__bar--weak">
                  <span className="home-review__bar-lbl">Weak</span>
                  <span className="home-review__bar-track"><span className="home-review__bar-fill" style={{ width: (RQ.weak / RQ.total * 100) + "%" }}/></span>
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

          {/* Continuity / Warnings */}
          <HomeCard
            className="home-card--warnings"
            eyebrow="Continuity"
            title={"Warnings · " + HOME_WARNINGS.length}
            action={<span className="home-card__action-sub">Click to triage</span>}
          >
            <div className="home-warnings">
              {HOME_WARNINGS.map((w) => (
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
            <ol className="home-activity">
              {HOME_RECENT_ACTIVITY.map((a) => (
                <li key={a.id} className="home-activity__row" onClick={() => handleActivityClick(a)} data-callback="onOpenRecentEntity">
                  <span className={"home-activity__dot home-activity__dot--" + a.kind}/>
                  <span className="home-activity__text">{a.text}</span>
                  <span className="home-activity__when">{a.when}</span>
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
                Today is a separate action plan: prompts, dormant entities, and dangling threads to address now.
              </div>
              <div className="home-today-bridge__preview">
                <span className="home-today-bridge__chip"><Icon name="feather" size={11}/>Open Ch. 8 in Brec's voice</span>
                <span className="home-today-bridge__chip"><Icon name="scroll" size={11}/>Saren's Bargain · 2 dangling steps</span>
                <span className="home-today-bridge__chip"><Icon name="user" size={11}/>Captain Brec · last seen Ch. 7</span>
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
