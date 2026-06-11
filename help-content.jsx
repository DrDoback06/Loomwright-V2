// =====================================================================
// help-content.jsx — the help/tour registry.
//
// window.HELP_CONTENT maps a surface id to its help entry:
//   "route:<routeId>"        — full routes (home / today / writers-room)
//   "panel:<kind>"           — docked panels (cast, items, tangle…)
//   "workspace:<workspaceId>"— full-screen workspaces (cast-dossier…)
//
// Every entry: { title, intro, controls: [{ selector, label, desc }],
//                tour: [{ selector, title, body }] }
//
// Selectors are the REAL data-ui / data-callback / class hooks the app
// renders, so help can highlight the actual control (and the tour fails
// loudly in tests if the UI drifts). Deterministic, zero-token.
// =====================================================================

(function buildHelpContent() {
  // Controls shared by every docked panel's header.
  const PANEL_CHROME_CONTROLS = [
    { selector: "[data-callback='onCreateFromPanelHeader']", label: "+ Create", desc: "Create a new record of this panel's type in the full editor." },
    { selector: "[data-callback='onOpenPanelWorkspace']", label: "Open workspace", desc: "Open the full-screen editor for this tab, focused on the selected entry." },
    { selector: "[data-callback='onLockSelection']", label: "Lock selection", desc: "Keep the selected entry selected as you move between tabs (and across reloads). Locked entries appear as chips in the lock tray." },
    { selector: "[data-callback='onPinPanel']", label: "Pin", desc: "Anchor this panel next to the manuscript so other panels never push it away." },
    { selector: "[data-callback='onExpandPanel']", label: "Widen", desc: "Toggle a wider layout for this panel." },
    { selector: "[data-callback='onClosePanel']", label: "Close", desc: "Close the panel. Reopen it any time from the left rail." },
  ];
  const FILTER_CHIP = { selector: ".pstk__filter-chip", label: "Filtered-by chip", desc: "Shows when another panel's selection is filtering this one. Click to clear the cross-tab filter." };

  const panel = (title, intro, controls = [], tour = []) => ({
    title, intro,
    controls: [...controls, ...PANEL_CHROME_CONTROLS, FILTER_CHIP],
    tour,
  });

  const HELP_CONTENT = {
    // ----- routes ------------------------------------------------------
    "route:home": {
      title: "Home",
      intro: "Your project at a glance — live manuscript progress, entity health, the review queue, code-first insights, and recent activity. Every number comes from your real data; nothing here is a mock.",
      controls: [
        { selector: "[data-callback='onOpenWriterRoom']", label: "Open Writer's Room", desc: "Jump to the manuscript." },
        { selector: "[data-testid='home-insights']", label: "Needs attention", desc: "The top insights from the zero-token editor engine: contradictions, stalled threads, orphans. Click one to fix it in the entity editor." },
        { selector: "[data-ui='HomeRecentActivity']", label: "Recent activity", desc: "The audit trail — click a row to reopen what changed." },
      ],
      tour: [
        { selector: ".home-card--manuscript", title: "Live progress", body: "Chapters, words, and today's output — computed from your manuscript, not estimates." },
        { selector: ".home-card--entities", title: "Entity health", body: "Counts per tab plus how many candidates wait in review." },
        { selector: "[data-testid='home-insights']", title: "Needs attention", body: "The code-first editor flags contradictions, stale threads, and orphans here. AI is optional — these are computed from your text." },
      ],
    },
    "route:today": {
      title: "Today",
      intro: "An editor reading over your shoulder: writing prompts, unfinished quests, dangling threads, continuity warnings, callbacks worth weaving back in, and project-intelligence gaps — all computed locally from your project, with dismissible cards.",
      controls: [
        { selector: ".today__filter", label: "Section filters", desc: "Focus one kind of suggestion: threads, continuity, callbacks, intel gaps…" },
        { selector: "[data-callback='onDismissTodaySuggestion']", label: "Dismiss (×)", desc: "Hide a suggestion you've handled. Dismissals persist." },
        { selector: "[data-callback='onOpenRelatedTab']", label: "Entity chips", desc: "Open the related record in its panel." },
      ],
      tour: [
        { selector: ".today__filter", title: "Filter the desk", body: "Each chip is one kind of insight. 'Continuity' holds contradictions found by scanning your chapters — zero AI tokens." },
        { selector: ".today__card", title: "Actionable cards", body: "Every card names the record, the evidence, and an action. The × dismisses it for good." },
      ],
    },
    "route:writers-room": {
      title: "Writer's Room",
      intro: "Draft chapters, and let extraction turn prose into records. Save & Extract scans the chapter offline (12 detectors — names, travel, transfers, dialogue, allegiances…); accepted candidates land in their tabs. Right-click or long-press selected text for the adaptive wheel.",
      controls: [
        { selector: "[data-testid='wr-extract-chapter']", label: "Run extraction", desc: "Scan this chapter for entities, relationships, and state changes. Works fully offline; AI deepens it when configured." },
        { selector: "[data-ui='RightMargin']", label: "Extraction margin", desc: "New candidates appear here after extraction; accept or dismiss inline." },
        { selector: "[data-testid='wr-fst-extract']", label: "Selection → Extract", desc: "Select prose, then scan just that selection." },
        { selector: "[data-ui='AIWriterEntries']", label: "AI Writer shortcuts", desc: "Revise / Continue / Write chapter — opens the AI Writer panel in that mode. Without a provider you still get a local draft brief." },
      ],
      tour: [
        { selector: "[data-ui='ManuscriptCanvas']", title: "The manuscript", body: "Type here. Known entities are highlighted; double-click one to open its record." },
        { selector: "[data-testid='wr-extract-chapter']", title: "Save & Extract", body: "One click scans the chapter into candidates — offline, private, deterministic." },
        { selector: "[data-ui='RightMargin']", title: "Review in the margin", body: "Each candidate shows its evidence quote. Accept it and the record appears in its tab and full editor." },
      ],
    },

    // ----- entity panels ------------------------------------------------
    "panel:cast": panel(
      "Cast",
      "Your characters, live from the store. Click a row for the dossier; Ctrl/Cmd-click two rows and 'View relationship' shows the bond between them (meters, evidence, shared chapters). Lock someone to keep them selected across tabs.",
      [
        { selector: ".cast-row", label: "Character rows", desc: "Click to open the dossier. Ctrl/Cmd-click to multi-select for merge, tag, delete — or the two-person relationship view." },
        { selector: "[data-callback='onViewPairRelationship']", label: "View relationship", desc: "With exactly two selected: their recorded bond, trust/conflict meters, co-mention quotes, and a create CTA if no bond exists." },
        { selector: ".cast__subtab", label: "Browse / Suggested", desc: "Suggested lists live extraction candidates for cast." },
      ],
      [
        { selector: ".cast-row", title: "The roster", body: "Live records — select one and every other panel can filter by it." },
        { selector: "[data-callback='onLockSelection']", title: "Lock", body: "Keeps this character selected when you switch tabs — chips in the lock tray bring them back anywhere." },
        { selector: "[data-callback='onOpenPanelWorkspace']", title: "Full dossier", body: "The full-screen dossier opens on YOUR selected character, with every schema field." },
      ]
    ),
    "panel:bestiary": panel("Bestiary", "Creatures and fauna. Rows are live records; the field guide workspace shows habitats, traits, and encounter timelines from manuscript mentions."),
    "panel:atlas": panel(
      "Atlas",
      "The living map. Selecting a location broadcasts it to other tabs (Cast and Items can filter by place); the full Atlas Editor adds layers, routes, placement, and the atlas queue.",
      [{ selector: "[data-callback='onOpenAtlasFullScreen']", label: "Open editor", desc: "Full-screen map editing: place locations, draw routes, toggle layers." }]
    ),
    "panel:locations": panel("Locations", "The registry behind the map — hierarchy, who's been where, items found there. 'Show on Atlas' centres the map on the selection."),
    "panel:items": panel(
      "Items",
      "Artefacts and gear with real ownership: assign or transfer owners (logged to the trade history), equip/unequip, drop, and upgrade — each button acts on the live record.",
      [
        { selector: "[data-callback='onAssignItemOwner']", label: "Assign owner", desc: "Pick the holder; transfers are logged so the insight engine can spot possession conflicts." },
        { selector: "[data-callback='onEquipItem']", label: "Equip", desc: "Marks the item equipped on its current owner (it appears in their dossier's equipment slots)." },
      ]
    ),
    "panel:classes": panel("Classes", "Archetypes your cast inherit from — default stats, starting gear, allowed skills. 'Duplicate' clones a class as a starting point."),
    "panel:races": panel("Races & Species", "Peoples and ancestries — traits, innate skills, weaknesses, origins, and which cast belong to each."),
    "panel:stats": panel("Stats", "Universal stats plus their extraction phrase rules. The Stat Lab workspace lets you test a sentence against the rules before saving."),
    "panel:skillTrees": panel("Skill Trees", "Progression canvases that arrange ability records into trees. Open the full editor to drag nodes and draw prerequisites."),
    "panel:abilities": panel(
      "Abilities",
      "The catalogue of individual powers (skills + legacy abilities) — distinct from Skill Trees, which arrange them. Filter by type, edit effects and requirements, or hop into the tree editor focused on the selected ability.",
      [
        { selector: "[data-callback='onCreateAbility']", label: "Create ability", desc: "New power record in the skills editor." },
        { selector: "[data-callback='onOpenSkillTreeEditor']", label: "Tree", desc: "Open the full-screen tree editor focused on this ability's node." },
      ]
    ),
    "panel:relationships": panel(
      "Relationships",
      "Bonds between cast: single view (one character's web), compare (two people — driven automatically when you pick a pair in Cast), network, timeline, and the review queue for extracted bonds.",
      [{ selector: ".rel-bar__mode", label: "View modes", desc: "Single / Compare / Network / Timeline / Review. Compare lights up when a pair is focused from the Cast panel." }]
    ),
    "panel:quests": panel("Quests", "Threads in motion — steps, branches, participants. Quests gone quiet show up on Today as stalled threads."),
    "panel:events": panel("Events", "Discrete happenings with causes and consequences. Extraction's chain detector links cause → effect when your prose states it."),
    "panel:timeline": panel("Timeline", "Events in book order or chronology, filterable by character, place, quest, or faction — and by whatever entity another panel has focused."),
    "panel:lore": panel("Lore / Canon", "World rules with hard/soft bands and evidence. Hard canon feeds AI constraints; contradictions flag on Today."),
    "panel:references": panel("References", "External sources and research. Toggle a reference into the AI context or mark it as a style influence."),
    "panel:tangle": panel(
      "Tangle",
      "A free canvas for non-linear thinking: boards of cards and labelled edges, bindable to real entities. Everything persists locally.",
      [{ selector: "[data-callback='onOpenTangleCanvas']", label: "Open canvas", desc: "Full-screen board with drag, connect, and entity binding." }]
    ),
    "panel:speedReader": panel(
      "Speed Reader",
      "Read your manuscript at pace (RSVP) to catch inconsistencies — flag a moment without stopping the flow.",
      [{ selector: "[data-callback='onOpenPanelWorkspace']", label: "Open reader", desc: "The full-screen reader with speed, progress, and flags." }]
    ),
    "panel:randomTables": panel("Random Tables", "Roll-able generators (names, weather, complications). Build your own tables; rolls avoid repeats until a table exhausts."),
    "panel:aiWriter": panel(
      "AI Writer",
      "Mode-based drafting (revise / continue / write chapter…) with your project's context riding along. No provider configured? Generate still produces a local draft brief you can use or paste elsewhere.",
      [
        { selector: "[data-testid='aiw-generate']", label: "Generate", desc: "Draft with your provider — or assemble the local brief when none is configured." },
        { selector: ".aiw__drop", label: "Context chips", desc: "Drag entities here to put them in the prompt." },
      ]
    ),
    "panel:review": panel(
      "Review Queue",
      "Every extraction candidate waits here with its evidence quote and confidence band. Accept, edit, merge, or deny — singly or in bulk.",
      [{ selector: "[data-callback='onAcceptQueueItem']", label: "Accept", desc: "Apply the candidate to the live store — it appears in its tab immediately." }]
    ),
    "panel:trash": panel("Trash", "Deleted records rest here for 30 days. Restore brings everything (links included) back; purge is permanent."),
    "panel:today": panel("Today (panel)", "The compact Today desk — same live insight cards as the Today route, beside your manuscript."),
    "panel:recent": panel("Recent", "Your latest touched records, for quick hops."),
    "panel:refs": panel("Active References", "The references currently flagged into your AI context and style influence — a quick toggle surface beside the manuscript."),
    "panel:notifs": panel("Notifications", "Continuity warnings and job results surface here as they happen."),

    // ----- full workspaces ----------------------------------------------
    "workspace:cast-dossier": {
      title: "Cast Dossier",
      intro: "The full-screen character file: live biography, persona, equipment slots (drop items from the vault to equip them — it persists), relationships, stats, involvement, and source quotes. The Full record section at the bottom renders every populated schema field; each card's Edit jumps to that editor section.",
      controls: [
        { selector: ".fws-roster__row", label: "Roster", desc: "Live cast list — opens focused on the row you selected in the panel." },
        { selector: ".fws-slot", label: "Equipment slots", desc: "Drop an item from the Item Vault to equip it on this character (writes owner + slot to the item)." },
        { selector: "[data-ui='FullRecordSection']", label: "Full record", desc: "Every populated field, grouped by schema section, each with an Edit shortcut." },
        { selector: "[data-callback='onExitPanelWorkspace']", label: "Exit", desc: "Back to the panel stack (Esc works too)." },
      ],
      tour: [
        { selector: ".fws-roster__row", title: "Live roster", body: "No demo names — these are your records, and the workspace opened on your panel selection." },
        { selector: "[data-ui='FullRecordSection']", title: "The whole record", body: "Everything the schema knows, with per-section Edit buttons into the entity editor." },
      ],
    },
    "workspace:bestiary-field-guide": { title: "Bestiary Field Guide", intro: "Creature dossiers with habitats, traits, and an encounter timeline built from manuscript mentions.", controls: [], tour: [] },
    "workspace:quest-log": { title: "Quest Log", intro: "Steps with live done-counts, branches and outcomes, participants/items/locations links, and source quotes. '+ Add step' opens the editor at the structure section.", controls: [], tour: [] },
    "workspace:event-ledger": { title: "Event Ledger", intro: "Cause → outcome → long-term consequence per event, plus structured state changes and source quotes.", controls: [], tour: [] },
    "workspace:timeline-workspace": { title: "Timeline Workspace", intro: "Your events on a track — book order, chronological, or per character/location/quest/faction/item with a focus picker. Click a node to edit the event.", controls: [], tour: [] },
    "workspace:canon-vault": { title: "Canon Vault", intro: "Hard/soft canon with evidence and AI guidance. Contradicted facts carry a warning badge.", controls: [], tour: [] },
    "workspace:location-registry": { title: "Location Registry", intro: "The wiki behind the Atlas: hierarchy tree, who's been here, items found, factions present, events, and placement status.", controls: [], tour: [] },
    "workspace:item-vault": { title: "Item Vault", intro: "Ownership history, effects, quest links, and a mention scrubber across chapters. Drag an item to the Cast Dossier to equip it.", controls: [], tour: [] },
    "workspace:class-builder": { title: "Class Builder", intro: "Default stats, starting equipment, allowed skills, and the cast assigned to each class.", controls: [], tour: [] },
    "workspace:species-registry": { title: "Species Registry", intro: "Traits, innate skills, weaknesses, origins, and linked cast per species.", controls: [], tour: [] },
    "workspace:stat-lab": { title: "Stat Lab", intro: "Extraction phrase rules per stat with a live test box — paste a sentence and see which rules fire before you save them.", controls: [{ selector: ".fws-phrase-test__input", label: "Test phrase", desc: "Type a manuscript sentence; matching rules light up with their effects." }], tour: [] },
    "workspace:faction-registry": { title: "Faction Registry", intro: "Leaders, members (including everyone sworn via extraction), territory, allies and enemies.", controls: [], tour: [] },
    "workspace:research-library": { title: "Research Library", intro: "References with AI-context and style-influence toggles, linkable to entities; also the home of your onboarding answers.", controls: [], tour: [] },
    "workspace:control-centre": { title: "Control Centre (Settings)", intro: "Workspace, privacy, AI providers and routing, extraction tuning (per-detector confidence), project intelligence, import/export, and keyboard shortcuts.", controls: [], tour: [] },
    "workspace:trash-manager": { title: "Trash Manager", intro: "Everything deleted in the last 30 days, restorable with links intact.", controls: [], tour: [] },
    "workspace:relationship-map": { title: "Relationship Workspace", intro: "The full relationships surface: single/compare/network/timeline views over live bonds.", controls: [], tour: [] },
    "workspace:tangle-canvas": { title: "Tangle Canvas", intro: "Full-screen non-linear board: drag cards, draw labelled edges, bind cards to real entities. Persists locally.", controls: [], tour: [] },
    "workspace:speed-reader": { title: "Speed Reader", intro: "RSVP reading of your chapters with speed control and inconsistency flags.", controls: [], tour: [] },

    // ----- overlays ------------------------------------------------------
    "overlay:palette": {
      title: "Command Palette",
      intro: "⌘/Ctrl-P anywhere. Search entities, chapters, references, settings and actions — or run navigation commands (Open Tangle, Open Atlas…).",
      controls: [{ selector: "[data-ui='CommandPalette'] input", label: "Search", desc: "Type to search everything local; Enter runs the highlighted row." }],
      tour: [],
    },
    "overlay:wheel": {
      title: "Adaptive Wheel",
      intro: "Right-click (or long-press) for the radial menu — context-aware actions like extracting the selection or creating an entity from it.",
      controls: [],
      tour: [],
    },
  };

  window.HELP_CONTENT = HELP_CONTENT;
})();
