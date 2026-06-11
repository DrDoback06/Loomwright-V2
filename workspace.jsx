// =====================================================================
// workspace.jsx — Route-aware demo workspace placeholder
// =====================================================================

const ROUTE_META = {
  "home":         { eyebrow: "Workspace",        title: "Welcome back",                 sub: "Your manuscript, archive, and review queue, all in one paper-and-ink workspace.", icon: "home" },
  "today":        { eyebrow: "Today",            title: "What needs you today",         sub: "A daily plan: chapters to draft, items to review, and threads still loose.",       icon: "sun" },
  "writers-room": { eyebrow: "Manuscript",       title: "Writer's Room",                sub: "Chapter editor, margin reviews, and live extraction live here.",                  icon: "feather" },
  "cast":         { eyebrow: "Entities · Cast",  title: "Cast",                         sub: "Characters, voices, dossiers. Color-coded violet across the manuscript.",         entity: "cast" },
  "bestiary":     { eyebrow: "Entities",         title: "Bestiary",                     sub: "Creatures, monsters, fauna. Rust-red across mentions.",                           entity: "bestiary" },
  "atlas":        { eyebrow: "Entities",         title: "Atlas",                        sub: "Maps, regions, and the bones of geography.",                                      entity: "atlas" },
  "locations":    { eyebrow: "Entities",         title: "Locations",                    sub: "Specific places — castles, taverns, glades. Moss-green across mentions.",         entity: "locations" },
  "items":        { eyebrow: "Entities",         title: "Items",                        sub: "Artefacts, weapons, relics. Gold across mentions.",                               entity: "items" },
  "classes":      { eyebrow: "Entities",         title: "Classes",                      sub: "Archetypes, professions, schools.",                                               entity: "classes" },
  "races":        { eyebrow: "Entities",         title: "Races",                        sub: "Peoples, species, lineages.",                                                     entity: "races" },
  "stats":        { eyebrow: "Entities",         title: "Stats",                        sub: "Quantities the world tracks — for characters, items, factions.",                  entity: "stats" },
  "abilities":    { eyebrow: "Entities",         title: "Abilities",                    sub: "Powers, signature moves, gifts.",                                                 entity: "abilities" },
  "skillTrees":   { eyebrow: "Entities",         title: "Skill Trees",                  sub: "Progressions and branchings of ability.",                                          entity: "skillTrees" },
  "relationships":{ eyebrow: "Entities",         title: "Relationships",                sub: "Bonds, rivalries, debts — the graph between Cast.",                                entity: "relationships" },
  "quests":       { eyebrow: "Entities",         title: "Quests",                       sub: "Goals, arcs, threads in motion.",                                                  entity: "quests" },
  "events":       { eyebrow: "Entities",         title: "Events",                       sub: "Discrete things that happened — battles, meetings, deaths.",                       entity: "events" },
  "timeline":     { eyebrow: "Entities",         title: "Timeline",                     sub: "Time, ordered. Eras, days, hours.",                                                entity: "timeline" },
  "lore":         { eyebrow: "Entities",         title: "Lore / Canon",                 sub: "Facts you've ratified about the world.",                                          entity: "lore" },
  "tangle":       { eyebrow: "Tools",            title: "Tangle",                       sub: "A canvas for non-linear thinking.",                                               icon: "knot" },
  "speedReader":  { eyebrow: "Tools",            title: "Speed Reader",                 sub: "Read your manuscript at pace; flag inconsistencies.",                              icon: "eye" },
  "references":   { eyebrow: "Tools",            title: "References",                   sub: "External sources, mood boards, archive uploads.",                                  entity: "references" },
  "trash":        { eyebrow: "System",           title: "Trash",                        sub: "Deleted entities sit here for 30 days before they vanish.",                        icon: "trash" },
  "settings":     { eyebrow: "System",           title: "Settings",                     sub: "Workspace, privacy, AI behaviour, theme.",                                          icon: "gear" },
};

const Workspace = ({ routeId, demoState, onOpenAdaptiveWheel, onOpenPanel, onCreateEntity }) => {
  const m = ROUTE_META[routeId] || ROUTE_META.home;
  const t = m.entity ? ENTITY_TYPES[m.entity] : null;

  const handleContextMenu = (e) => {
    e.preventDefault();
    onOpenAdaptiveWheel({ x: e.clientX, y: e.clientY, contextLabel: m.title });
  };

  // Long-press support
  const longPressRef = React.useRef(null);
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const x = e.clientX, y = e.clientY;
    longPressRef.current = setTimeout(() => {
      onOpenAdaptiveWheel({ x, y, contextLabel: m.title });
    }, 480);
  };
  const cancelLongPress = () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } };

  const renderBody = () => {
    if (demoState === "empty") {
      return (
        <EmptyState
          icon={m.icon || (t ? "stack" : "paper")}
          title={"No " + (m.title.toLowerCase()) + " yet"}
          body="This panel will fill once you draft, extract, or import."
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="primary" size="sm" icon="plus" onClick={() => onCreateEntity && onCreateEntity(m.entity)} data-callback="onCreateEntity">Create</Btn>
              <Btn variant="outline" size="sm" icon="sparkle" data-callback="onSaveAndExtract">Extract</Btn>
            </div>
          }
        />
      );
    }
    if (demoState === "loading") return <LoadingState title="Drawing the page…" lines={5}/>;
    if (demoState === "error")   return <ErrorState title="Couldn't open this room" body="Local index didn't respond. Your manuscript is safe."/>;
    if (demoState === "partial") {
      return (
        <div className="workspace__placeholders">
          <div className="placeholder-card">
            <div className="placeholder-card__title">In progress</div>
            <div className="placeholder-card__body">Some data has loaded. Other shelves are still arriving.</div>
            <div className="placeholder-card__meta">
              {t && <EntityTypeBadge type={m.entity} size="xs"/>}
              <span className="chip chip--info"><span className="chip__dot chip__dot--pulse"/>Loading 3 of 12</span>
            </div>
          </div>
          <LoadingState title="" lines={4}/>
        </div>
      );
    }
    return (
      <div className="workspace__placeholders">
        <div className="placeholder-card">
          <div className="placeholder-card__title">{m.entity ? "List" : "Overview"} placeholder</div>
          <div className="placeholder-card__body">
            This route's primary surface plugs in here. The shell, header, panels, status strip, and command palette already work.
          </div>
          <div className="placeholder-card__meta">
            {t && <EntityTypeBadge type={m.entity} size="xs"/>}
            <span className="chip chip--neutral">Hook: onOpenPanel</span>
          </div>
        </div>
        <div className="placeholder-card">
          <div className="placeholder-card__title">Detail placeholder</div>
          <div className="placeholder-card__body">
            Selecting a row from the list opens a SlidingPanel from the right. Multiple panels stack as overlapping archive cards.
          </div>
          <div className="placeholder-card__meta">
            <span className="chip chip--neutral">Hook: onSelectEntity</span>
            <Btn variant="outline" size="sm" icon="panel-right" data-callback="onOpenPanel" onClick={() => onOpenPanel && onOpenPanel("demo", { from: "workspace" })}>Open panel</Btn>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="workspace paper-grain"
      data-ui="Workspace"
      data-route={routeId}
      onContextMenu={handleContextMenu}
      onPointerDown={onPointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
    >
      <div className="workspace__inner">
        <article className="workspace__paper">
          <div className="workspace__crumb">
            <span>{BRAND.project.name}</span>
            <span className="workspace__crumb__sep">/</span>
            <span>{m.eyebrow}</span>
            {t && (<><span className="workspace__crumb__sep">/</span><EntityTypeBadge type={m.entity} size="xs"/></>)}
            {m.soon && <><span className="workspace__crumb__sep">/</span><span className="leftrail__soon">Coming soon</span></>}
          </div>
          <h1 className="workspace__title">{m.title}</h1>
          <p className="workspace__sub">{m.sub}</p>
          <div className="workspace__hr">
            <span className="workspace__hr__line"/>
            <span className="workspace__hr__glyph">❦</span>
            <span className="workspace__hr__line"/>
          </div>
          {renderBody()}
        </article>
      </div>
    </div>
  );
};

window.Workspace = Workspace;
window.ROUTE_META = ROUTE_META;
