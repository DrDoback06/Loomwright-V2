# Field Parity Pass — Plan

_Created: 2026-05-19, on branch `claude/field-parity-pass` (started from `main` post-PR-#5)._

## The rule we agreed

**Schema aspirational, display descriptive.**

1. Editor configs, JSON templates, paste/validate/save, persistence,
   import, export — **support the full required-field list** per type,
   even for fields no panel currently displays.
2. Panel display — **only verify parity for fields a panel already
   displays or has a designed slot for**. No new UI sections, no panel
   redesign.
3. **Severe bug** (must fix): panel displays a field that the editor
   can't save → the Bestiary `threatLevel` pattern.
4. **Acceptable**: editor/JSON supports a field that no panel displays
   → record as "schema-supported, not yet displayed".
5. **Preserve unknown/deeper fields** on save / import / export. An
   entity round-trips correctly even if Loomwright doesn't yet
   understand every key.
6. **No brand-new product surface** for not-yet-displayed fields.

## Coverage depth

| Priority 8 — deep fix + JSON round-trip + e2e | Audit-only + smoke check |
|---|---|
| Cast | Classes |
| Items | Races / Species |
| Locations | Skills / Skill Trees |
| Quests | Relationships |
| Events | Timeline |
| Stats | Lore / Canon |
| Bestiary | |
| References | |

## Source-of-truth architecture (what we're working with)

- **`entity-editor-configs.jsx`** declares the config for Locations,
  Items, Classes, Races, Stats, Quests, Events, Skills + the generic
  fallback. Registered into `window.ENTITY_EDITOR_CONFIGS` at module
  load.
- **`entity-editor-configs-extended.jsx`** declares Cast, Bestiary,
  Lore, References, Factions, Relationships, Timeline. Registers into
  the same `window.ENTITY_EDITOR_CONFIGS` object. **Also exports**
  `eeFieldHint(field)` and `eeJsonTemplate(type)` — `eeJsonTemplate`
  walks the config sections/fields and emits one key per `field.id`.
- **`entity-editor.jsx`** consumes `ENTITY_EDITOR_CONFIGS[type]` to
  render the editor. Each config field becomes an editor input.
- **`backend-services.jsx EntityService.save(type, fields, opts)`**
  takes the `fields` blob and writes it under
  `KEYS.entities[type][id]`. Whatever the editor produces is what
  persists.
- **Panels**: bespoke renderers (`upgrades-*.jsx`, `cast.jsx`,
  `relationships.jsx`, `timeline.jsx`, `lore-references.jsx`) read
  entity data and render specific fields.

**Implication.** Because editor configs and JSON templates are driven
by the same registry, adding a field to the config gives us: editor
input ✓, JSON template entry ✓, save/persistence ✓ (the editor's
output is what's stored), export ✓ (export writes the entity), import
✓ (import sets the entity). **The aspirational schema work is
mostly: add missing fields to the right config section.**

The descriptive panel work is: find places where a panel renders a
field that the config doesn't have, and add the missing config entry.

The unknown-field preservation work is: ensure
`EntityService.save / update` doesn't drop fields it doesn't
understand. Today `save()` writes the full `fields` blob, which means
unknown fields survive. We'll add a defensive test to lock that in.

## Per-type plan

For each entity type, the same execution shape:

1. **Read the existing config.** Catalogue the field IDs.
2. **Read the panel/dossier renderer.** Catalogue field IDs it reads.
3. **Compare against the brief's required-field list.**
4. **Classify each field** into one of three buckets:
   - **A. Visible/display parity** — panel displays it; editor must
     support it.
   - **B. Schema-supported aspirational** — editor/JSON supports it;
     no panel slot today; we still add it to the schema if it fits
     cleanly in an existing section.
   - **C. Unsupported/future** — not added in this pass (e.g. would
     require new UI sections).
5. **Surgical fixes** to the config: add missing fields in the right
   section, with sensible default values, no UI redesign.
6. **For priority-8 types**: add a smoke fixture that creates an
   entity with rich fields, persists, reloads, asserts every visible
   + aspirational field round-trips. Add JSON round-trip assertions.
7. **For audit-only types**: a single smoke check that a basic create
   → save → reload works.

## Priority-8 specific notes (informed by inspection)

### Cast (`EE_CAST` in extended configs)

- Already has Identity, Voice/Personality, Story Role, Equipment,
  Relationships, Timeline/Locations sections (per `FIELD_PARITY_AUDIT.md`).
- **Aspirational additions to verify**: `aiInterviewProfile`,
  `writingInstructions` (likely already in an "AI Interview" section
  but verify field IDs). `currentLocationId`, `homeLocationId`,
  `travelHistory` consistency check.
- **Visible/display parity**: panel reads from `cast.jsx`'s
  hard-coded `CAST_SAMPLE` shape today — confirm that schema-saved
  fields don't break it.

### Bestiary (`EE_BESTIARY`)

- Per existing `FIELD_PARITY_AUDIT.md`: threatLevel was missing,
  added. Verify it's still there.
- Add: `relatedRaceSpecies`, `relatedFactions`, `chapterAppearances`
  if missing.

### Locations (`EE_LOCATION` in main configs)

- Already has `parentId`, `coords`, `routes`, linked entities,
  tracking, status sections.
- Aspirational additions: `childLocationIds` (computed from parents),
  `dangerLevel` (already there), `factionsPresent` (already there as
  `factions`).
- Check: panel render path in `upgrades-locations.jsx` reads from
  `LOCATIONS_DATA` (demo) vs. saved entity data.

### Items (`EE_ITEM`)

- Already has Type, Equipment Slot, Owner, Effects, Properties,
  Tracking sections.
- Aspirational additions: `ownershipHistory`,
  `tradeTransferHistory`, `compatibleClasses`, `compatibleRaces`,
  `linkedStats`, `linkedSkills` — verify against existing config.

### Quests (`EE_QUEST`)

- Has Steps, Branches, Outcomes per existing structure.
- Verify the step shape includes `id`, `title`, `description`,
  `status`, `actorId`, `locationId`, `itemIds`, `eventId`,
  `sourceMentionId`, `completedAt`.

### Events (`EE_EVENT`)

- Has Type, Participants, Cause/Outcome, Consequences.
- Aspirational: `relationshipChanges`, `characterStateChanges`,
  `locationChanges`, `itemStateChanges`, `statChanges`. Likely many
  missing; add the ones that have natural slots.

### Stats (`EE_STAT`)

- Has Value/Display, Applies-To, Phrase-Rules.
- Check phrase-rule shape: `phrase / pattern`, `matchType`,
  `effectType`, `value`, `confidenceDefault`, `targetStat`,
  `appliesToEntityType`, `exampleSentence`, `active`.

### Bestiary — already covered above.

### References (`EE_REFERENCE`)

- Has Title, Kind, URL, Content, Linked Entities, Tags, Status.
- Aspirational: `isStyleInfluence`, `isCanonSource`, `isResearchNote`,
  `includedInAIContext`. Verify.

## Audit-only types (6)

For each: read config, write parity table into
`FIELD_PARITY_AUDIT_CURRENT.md`, and add a single smoke check that
create → save → reload preserves a representative field. No deep fix
work unless the audit surfaces a severe gap (panel displays a field
the editor can't save). If one does, it gets fixed.

## Tests to add

### Smoke (in `scripts/smoke-services.js`)

A new `runFieldParityFixtures()` section after the existing
extraction-fixtures block:

- **Per priority type** (8 fixtures): build a "rich" entity with
  every visible + aspirational field populated, `EntityService.save`,
  reload via `listSync`, assert every field round-trips.
- **Unknown-field preservation** (1 fixture): save an entity with an
  `extra.future` field that the config doesn't know; reload; assert
  `extra.future` is preserved.
- **JSON template completeness** (8 assertions): `eeJsonTemplate(type)`
  must include every required-field key.
- **Audit-only types** (6 smoke checks): one round-trip per type to
  prove the schema doesn't drop their fields.

### E2E (new spec `tests/e2e/08-field-parity.spec.js`)

One test per priority-8 type (8 tests total):
1. Save a rich entity of that type via the service.
2. Reload page (`openAppPreserveState`).
3. Assert all rich fields are present on the persisted record.
4. Export JSON via `EntityService.getSync` → serialise.
5. Save a second entity by passing the serialised JSON back through
   `EntityService.save`.
6. Assert the second entity contains the same fields (round-trip).

## Deliverables

- `FIELD_PARITY_PLAN.md` — this file. Committed first.
- `FIELD_PARITY_AUDIT_CURRENT.md` — three-bucket parity tables per
  type, all 14.
- `ENTITY_EDITOR_JSON_TEMPLATES_CURRENT.md` — example blank template
  + example filled instance for the 8 priority types.
- Surgical config edits to `entity-editor-configs.jsx` and
  `entity-editor-configs-extended.jsx` where gaps exist.
- New smoke fixtures + assertions.
- New e2e spec.
- Updates to `PRODUCT_COMPLETION_AUDIT.md` and `FINAL_QA_REPORT.md`.

## Strict out-of-scope (do not touch)

- No extraction logic changes (would re-open Pass 1 scope).
- No workspace persistence overhaul.
- No full project import/export work (entity-level only).
- No Speed Reader work.
- No search/indexing work.
- No audit log / undo work.
- No production build pipeline.
- No multi-provider AI routing.
- **No UI redesign.**
- **No panel rebuild.**
- No new bespoke editor configs beyond the 14 already registered.

## Commit plan

1. `FIELD_PARITY_PLAN.md` (this commit, no code).
2. `FIELD_PARITY_AUDIT_CURRENT.md` (audit doc, no code).
3. Config additions for the priority-8 types where the audit surfaces
   gaps.
4. Audit-only type smoke checks + any severe-gap fixes.
5. Smoke harness additions (round-trip + JSON-template completeness +
   unknown-field preservation).
6. `tests/e2e/08-field-parity.spec.js` + `playwright.config.js`
   wiring if needed.
7. `ENTITY_EDITOR_JSON_TEMPLATES_CURRENT.md`.
8. `PRODUCT_COMPLETION_AUDIT.md` + `FINAL_QA_REPORT.md` updates.

Each step verified with `npm run validate` + `npm run test:smoke`
before moving on. Full `test:e2e` at the end.
