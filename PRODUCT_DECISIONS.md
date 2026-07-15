# Loomwright V2 — Locked Product Direction

_Status: accepted product brief_  
_Source: user decisions supplied after `APP_COMPLETION_AUDIT.md`_  
_Implementation rule: innovate and extend the existing application; do not recreate it as a disconnected replacement._

## Product identity

Loomwright is one commercial product with two first-class modes:

1. **Author Mode** — an independent writing environment that turns manuscripts into a living, traceable story model.
2. **Dungeon Master Mode** — campaign preparation and live-play tools using the same entities, history, permissions, knowledge, world state, maps, sessions, encounters, and AI context.

The underlying product is a **fictional-universe engine**. One universe may contain multiple books, series, campaigns, timelines, maps, sessions, and alternate branches. Projects can be created and switched, and shared entities may span several books or campaigns.

The application should not force rigid project templates. Guided starting modes may configure useful defaults, tutorials, and terminology, but every system remains available inside one project.

## Guiding implementation principles

- Preserve and strengthen working code and visual ideas rather than discarding them.
- A manuscript, entity, event, source, relationship, map object, and project-intelligence record must belong to one canonical story graph.
- Every important assertion retains provenance: chapter, passage, reference, session, contributor, extraction run, and confidence.
- Meaningful extracted changes pass through an impact-aware review flow.
- High-confidence additions may be applied automatically, but must remain visible, editable, and instantly reversible.
- No production surface silently substitutes sample content.
- Empty states are honest and useful.
- Local/free analysis should do as much as possible; AI augments depth rather than being required for basic tracking.
- Home and Today are project-intelligence surfaces, not decorative dashboards.
- Cloud, accounts, collaboration, and commercial billing are required product directions, but local application completeness comes first.

## Story truth and conflict handling

When manuscript evidence, entity data, references, sessions, or canon disagree, Loomwright does not silently choose a winner. It creates a **Conflict Case** that contains:

- every conflicting claim;
- direct links to the source passages and references;
- involved and indirectly affected entities;
- prior accepted values and change history;
- confidence and canon level;
- proposed resolutions;
- a spiderweb impact preview of what each resolution would alter.

Truth levels include at minimum:

- hard canon;
- soft canon;
- rumour;
- character belief;
- secret truth;
- disputed;
- draft/non-canon;
- alternate-branch truth.

Character knowledge is separate from objective truth. A character can believe something false, know only part of a fact, hide a truth, or act on evidence unavailable to others.

## Historical world state

Loomwright will support deterministic state views at meaningful story points:

- book and chapter;
- scene;
- event;
- fictional date;
- campaign session;
- user-created snapshot;
- alternate branch.

The preferred implementation is an event-and-delta history over stable entities, with materialised snapshots for performance. Current entity values remain convenient latest-state views, while typed changes preserve ownership, location, status, relationship markers, stats, quest progress, knowledge, faction membership, injuries, equipment, and other historical state.

Reordering manuscript structure must not corrupt fictional chronology. Narrative order and in-world order are stored separately. Retcons trigger downstream impact analysis and identify later state that may no longer be valid.

Users can create sandbox branches or alternate endings, compare outcomes, and commit or discard a branch without corrupting the accepted timeline.

## Entity model

Users can create entities through several equal pathways:

1. manually;
2. extracted from prose, references, images, or session transcripts;
3. suggested from gaps and patterns in the existing project;
4. generated locally by Idea Forge;
5. generated/enhanced with AI;
6. imported from another project or library;
7. promoted from Tangle, a quest step, event consequence, map object, or session note.

Custom entity types and custom fields are supported through schema definitions rather than code changes. Fields may be simple, linked, historical, calculated, private, conditional, or permission-controlled.

Every meaningful entity change records contributor, timestamp, source, previous value, reason, confidence, branch, and affected links. Deletion and merging always produce an impact preview and preserve history. Users can revert safely.

Aliases and titles may be time-dependent.

## Extraction and tracking priorities

Extraction and automatic tracking are the highest implementation priority.

The system should detect and track:

- characters, groups, factions, species, classes and creatures;
- locations and nested places;
- objects, ownership, transfers, losses, damage and use;
- events, causes, consequences and callbacks;
- story threads, quests, goals, promises, mysteries and unresolved questions;
- relationships, multiple simultaneous markers, directional feelings and changes;
- travel and routes;
- stats, conditions, injuries, resources and status changes;
- canon facts, beliefs, rumours, motives, secrets and contradictions;
- motifs, themes, repeated language and narrative callbacks;
- character knowledge and viewpoint changes.

Explicit facts and deeper inferences are stored separately. Local rules handle clear evidence and recurring patterns. AI-enhanced extraction handles implication, motive, deception, attraction, subtext, thematic relationships, and complex cross-chapter synthesis.

All extraction outputs include source evidence, model/rule provenance, confidence, cost where relevant, proposed mutations, and impact analysis.

## Review and impact system

The review queue becomes an **Impact Review Centre**. A proposed change shows:

- the source text and surrounding context;
- existing state and proposed state;
- related entities and evidence;
- every linked record likely to change;
- chapters, scenes, sessions, maps, timelines, quests and relationships affected;
- continuity risks and possible plot holes;
- accept, edit, merge, deny, postpone, branch, and revert actions.

Bulk actions remain available, but high-impact changes require deliberate confirmation.

## Relationships

Relationships may be:

- directional;
- between two entities or a group;
- composed of multiple simultaneous markers;
- public, secret, private to a contributor, or player-hidden;
- measured with custom dimensions;
- evidenced by manuscript quotations and events;
- viewed and compared over time.

Strength, trust and conflict remain useful defaults, not fixed limits. Other dimensions can include affection, fear, loyalty, debt, attraction, suspicion, authority, dependence, respect, resentment, knowledge, and leverage.

Extraction can create evidence and provisional markers, then the user completes or corrects the relationship through review.

## Story threads, quests and events

A neutral **Story Thread** concept covers plot threads, promises, mysteries, objectives, character goals, campaign quests and unresolved questions. RPG quest features are enabled when relevant.

Events can atomically propose linked changes to characters, relationships, objects, locations, stats, factions and story threads. Consequences are always reviewable before becoming accepted state.

Events support uncertain and contradictory dates, flashbacks, flash-forwards, parallel chronology, fictional calendars, and branch-specific outcomes.

Quest/thread steps can promote into events and may branch, fail, recur, remain hidden, carry rewards, link encounters, or expose different player/public views.

## Atlas and world construction

A project may contain unlimited maps and nested spatial views: world, continent, region, settlement, building, room, dungeon, encounter map and abstract diagram.

Maps may use uploaded images, vector/SVG layers, generated canvases or nested location diagrams. Newly extracted locations enter an automatic staging tray until placed or attached to a parent.

Travel is extracted from prose and session records. Character routes and positions can be viewed by chapter, event, date, session and alternate branch. Optional systems include distance, terrain, travel time, transport, route feasibility, fog of war and DM/player visibility.

## Tangle

Users may create unlimited Tangle boards. Tangle provides freeform and automatic layouts for plot, chronology, hierarchy, relationships, acts, mysteries and campaign planning.

Nodes are live views of canonical entities. Entity content is edited in the entity system and reflected everywhere. Tangle can also contain notes, quotations, images, attachments, frames and collapsible groups.

Promoting a cluster creates or links canonical entities without destroying the planning board.

## Writer's Room

The Writer's Room will evolve into an independent Word-like writing application. A structured editor architecture is permitted and preferred where it improves reliability.

Target capabilities include:

- chapters and structured scenes;
- rich formatting, headings, quotes and scene breaks;
- footnotes, references and inline entity links;
- exact-range comments, suggestions and track changes;
- contributor colours, initials, authorship and revision history;
- find/replace, spelling, grammar and thesaurus support;
- stable live entity decoration while typing;
- automatic save, undo/redo and version restore;
- manuscript, outline, notes and other documents in tabs;
- large-manuscript performance;
- image support;
- broad import and export.

Narrative order and timeline order remain independent so scene rearrangement does not rewrite fictional chronology accidentally.

## Home and Today

Home is the command centre. Today is the active project coach.

Together they should surface:

- story and extraction coverage;
- high-impact review decisions;
- continuity risks and contradictions;
- dormant characters and threads;
- underdeveloped but important entities;
- unplaced locations and broken links;
- session recaps and “previously on” summaries;
- plot opportunities, callbacks and motif suggestions;
- character perspective and knowledge gaps;
- recommended next writing, research, review and worldbuilding actions;
- Idea Forge seeds connected to the existing project.

Insights must be traceable to real project data and clearly labelled when inferred or AI-generated.

## Dungeon Master direction

DM Mode eventually includes campaign/session dashboards, encounters, initiative, dice, player characters, NPCs, creatures, conditions, inventory, loot, maps, fog of war, hidden/public information, player portals, recaps, branching canon and session transcripts.

Session transcripts can become reviewable events, relationship changes, quest progress, item transfers, discoveries, injuries and canon updates.

AI character embodiment uses only what that character knows, believes, remembers, hides, and is linked to at the selected point in time. It must not leak DM-only or future knowledge into player-facing interactions.

The system remains ruleset-neutral at its core, with optional adapters/templates for specific tabletop systems.

## Collaboration and commercial direction

Future commercial infrastructure includes:

- accounts and multiple projects;
- encrypted cloud sync with offline operation;
- project sharing and collaboration;
- Owner, Co-author, Editor, DM, Player and Viewer permissions;
- contributor colours, initials, authorship trails and change comparison;
- managed AI credits alongside bring-your-own-key providers;
- web, installable desktop/PWA and full mobile applications;
- tutorials, guided tours and contextual help for every major feature.

## Import, export and publishing

Planned import includes plain text, Markdown, DOCX, HTML, EPUB, Scrivener, Fountain, PDF and images where useful.

Planned export includes project archives, DOCX, PDF, EPUB, Markdown, HTML, Fountain/screenplay formats and publishing-oriented presets. Publishing helpers should target workflows such as Amazon/KDP and serial platforms such as Royal Road while clearly separating formatting assistance from submission or account actions.

## Delivery order

1. Extraction depth, automatic tracking and Impact Review.
2. Entity presentation, live dossiers, Home/Today intelligence and entity injection.
3. Relationships, timeline, historical world state and Writer's Room.
4. Atlas and travel.
5. Tangle.
6. Dungeon Master mode.
7. Collaboration, cloud, mobile/desktop packaging and commercial credit systems.

Each feature extends the existing services and interaction model, receives rendered DOM acceptance tests, and is considered complete only when it persists, reloads, cross-links, exports/imports and presents honest user-facing state.
