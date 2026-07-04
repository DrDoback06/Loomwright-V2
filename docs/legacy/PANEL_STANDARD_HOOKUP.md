# Panel Standard — Hook-up Notes

## Routes (left rail)
Only **Home, Today, Writer's Room** are full-page routes. Everything
else opens as a stackable panel:

Cast · Bestiary · Atlas · Locations · Items · Classes · Races · Stats ·
Skill Trees · Relationships · Quests · Events · Timeline · Lore / Canon ·
Tangle · Speed Reader · References · Settings · Trash.

The Abilities tab is **deprecated** — it remains in the rail as a
compatibility panel that surfaces a deprecation card; see
SKILL_TREES_HOOKUP.md.

## Panel Click Protocol
- Closed panel → open it
- Already-open panel → bring to front + uncollapse (NEVER close)
- ⌘/Ctrl + closed → open AND pin
- ⌘/Ctrl + open → toggle pinned state
- Panels close ONLY via their own close button or explicit action.

## Panel Body Routing (in `panel-stack.jsx`)
```
atlas         → AtlasPanelBody
cast          → CastPanelBody
skills        → SkillsPanelBody
relationships → RelationshipsPanelBody
timeline      → TimelinePanelBody
lore          → LorePanelBody
references    → ReferencesPanelBody
classes       → ClassesPanelBody             (new — upgrades-classes-races.jsx)
races         → RacesPanelBody                (new — upgrades-classes-races.jsx)
abilities     → AbilitiesPanelBody (deprecation) (new — upgrades-classes-races.jsx)
others (bestiary, locations, items, stats, quests, events, factions)
              → EntityFrameworkPanelBody → RPG_DETAIL_RENDERERS[type]
```

## Every Entity Panel Needs
1. **Create button** — wired via global event:
   `window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type } }))`
2. **Drag handles** on cards — `EntityRosterCard` does this by default;
   bespoke bodies must do their own with the standard payload format.
3. **Status pill** on every card — `<EntityStatusPill status={entity.status}/>`.
4. **Status menu** on every dossier header — `<EntityCardChrome entity callbacks/>`.
5. **Review queue tab** in expanded mode.
6. **Cross-panel filter chip** when another panel has a focus.

## Status / Flag / Dormant System
Defined in `entity-drag.jsx` (`ENTITY_STATUSES` constant). Statuses:
Active · Important · Needs Review · Unresolved · Contradiction · Dormant
· Retired · Hidden · Draft · Archived.

Every entity dossier should expose:
- `<EntityStatusPill>` (status chip)
- `<EntityFlagButton>` (menu)
- last-mentioned chapter info
- mention-gap warning (`<MentionGapWarning>`)
- "wake / sleep" toggle (`<SleepButton>`)
- "do not suggest" toggle (in the flag menu)

## Global Entity Drag Payload
```js
// dataTransfer "application/x-loom-entity"
{ entityType, id, name, summary, sourcePanelId? }
```
Legacy `text/loomwright-entity` (`{id, name, type}`) still works for
back-compat. The `text/plain` field carries the name.

`document.body[data-ent-dragging]` is set to the dragged type while a
drag is in flight. CSS in `entity-drag.css` consumes this to light
every drop target in antique gold and pulse the manuscript edges.

## Drop Target Standard
- Drop targets use `useEntityDropTarget({ kind, accepts, onDrop })` from
  `entity-drag.jsx`.
- They mark themselves with `data-ent-drop="<kind>"` so global CSS can
  glow them when a compatible drag is in flight.
- Kinds in use: `writer-room`, `composition`, `atlas`, `timeline`,
  `cast` (equipment slots), `quest-step`, `location-tree`.

## File Map
| Concern | File |
|---|---|
| App shell + routing | `app.jsx` |
| Panel stack | `panel-stack.jsx` |
| Generic panel body | `entity-framework-host.jsx` + `entity-framework.jsx` |
| RPG detail renderers | `rpg-entities.jsx` |
| Entity Editor | `entity-editor.jsx` + `entity-editor-configs.jsx` + `entity-editor.css` |
| Composition Overlay | `composition-overlay.jsx` + `composition-overlay.css` |
| Drag/drop + status | `entity-drag.jsx` + `entity-drag.css` |
| Bespoke bodies | `upgrades-*.jsx` |
| Locations (rich panel + dossier) | `upgrades-locations.jsx` |
| Quests / Events | `upgrades-quests-events.jsx` |
| Bestiary / Factions | `upgrades-bestiary-factions.jsx` |
| Stats | `upgrades-stats.jsx` |
| Items extras | `upgrades-items.jsx` |
| Classes / Races / Abilities | `upgrades-classes-races.jsx` |
