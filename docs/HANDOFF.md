# HANDOFF — App-Wide "Create Anything" Generation System

**Branch:** `claude/writing-extraction-ai-capability-ht7duk` · **Status:** **§12 (offline depth + free-tier AI parity) SHIPPED.** Previously: **X1–X6 (Extraction 2.0, §10) BUILT AND TESTED — see §11.** Generation milestones G1–G3 complete & tested; G4/G5 mostly done; G6 half-done; G7/G8 not started (X1–X6 were brought forward ahead of them at the repo owner's request).
**For:** one agent/session continuing sequentially. Read this file top to bottom before touching code. The approved plan lives in the repo owner's session notes; this document supersedes it as the source of truth for remaining work.

---

## 1. What this feature is

The user asked for an app-wide creation system where **anything** — all 16 codex entity types, whole skill trees, tree branches, tangle boards, relationship sets, questlines, chapters — can be created four ways:

1. **Manual** — the existing config-driven editor drawer (untouched, zero regression).
2. **Random** — offline themed generator (theme + free-text hint, e.g. "sorcerer skill tree"), all fields filled coherently, rerollable with seeds.
3. **AI (in-app, BYOK)** — user describes what they want; the configured provider returns wire JSON; result previews; user edits and accepts.
4. **JSON round-trip** — from any create menu, copy a tailored prompt to an external AI (ChatGPT/Claude/etc.), paste the JSON reply back; every field across every editor tab auto-populates. Also restores the legacy per-entity JSON copy/paste that the rebuild dropped.

User-confirmed decisions: BYOK + external round-trip (no server); deep random packs for cast/skills/quests/items/locations/bestiary/factions with config-driven light coverage elsewhere; chapters = scaffold by default with opt-in AI prose; scope includes deepening the surfaces generation feeds (skill-tree auto-layout/branch colors done) but NOT broader legacy restoration (separate future task — see §8).

## 2. Core architecture (all in `src/services/generate/`)

**One currency: the `GenerationBundle`** (`types.ts`). Random, AI, and Paste all produce a bundle: `{ id, projectId, request, mode, seed?, entities: BundleEntityDraft[], graphs: BundleGraphDraft[], chapters: BundleChapterDraft[], links[], warnings[] }`. Drafts carry bundle-local ids remapped to real ids on accept. Preview/accept/undo are therefore written once:

- `apply.ts` — `applyBundle(bundle)`: one Dexie transaction (create entities; merge into `existingEntityId` rows for duplicate-name matches; create/append graph docs; create chapters; create links) + ONE reversible audit entry `generate.apply`. `src/db/repos/undo.ts` has the matching case — one Undo reverts the entire bundle.
- `spec.ts` — derives field specs, wire JSON examples, prompt guidance lines, and random fill targets by walking `src/domain/entity-configs/*` (the machine-readable per-type editor configs). All 16 types covered automatically. Exports the shared `nameFieldIdOf` (quests/events/lore/references/timeline use `title`; relationships derive name from `from → to`).
- `coerce.ts` — tolerant wire→form coercion per FieldKind. **Names, not ids, on the wire**: related fields travel as name strings, resolved against existing entities (`findKnownEntityMention`, threshold 0.85) → sibling drafts in the same bundle → dropped with a warning. Exact same-type name match sets `existingEntityId` (duplicate guard → merge, never a dupe row). Accepts flat legacy JSON, `title`↔`name` swaps, `{STR:14}` stat maps, `"3/4"` dual-numbers, yes/no toggles.
- `wire.ts` — `buildGenerationPrompt(request, ctx)` (kind-aware: entities / skilltree / skilltree-branch / questline; existing tree serialized as label+tier adjacency; known names capped 40/type) and `parseWireBundle(text, request, ctx, mode)` (tolerant: wire bundle, bare object, bare array, `{entities:[...]}`, type-keyed payloads, ```json fences; tree payloads → graph drafts; questline payloads → linked drafts). **Models never emit coordinates** — `layout.ts` computes all positions.
- `layout.ts` — pure DAG auto-layout (tier = longest path, branches → columns, deterministic jitter, disconnected components side by side). Also powers the Skill Trees "Auto-arrange" button.
- `serialize.ts` — `entityToWireJson` for dossier "Copy as JSON" / "Copy AI prompt" (refs → names, ids never leak).
- `staging.ts` — `runRandomGeneration(request, projectId)` (loads context; the staged bar's Reroll is this same call), `routeForBundle`, `stagedIdsOf`.
- `known.ts` — `loadKnownEntities(projectId)` (the coercion/prompt context).
- `random/` — `rng.ts` (seeded mulberry32; seed stored on bundle → deterministic tests + exact reroll), `engine.ts` (`generateRandomBundle` — kinds: entity, entity-batch, skilltree, questline, relationship-set, tangle; plus `generateSkillTreeBranchBundle`, `rollField`, `rollEmptyFields`), `topology.ts` (tree DAG + branch chains), `packs/` (see §4).

**UI:**
- `src/stores/generation.ts` — `dialog` target + `staged: GenerationBundle | null` (memory only; Dexie untouched until Accept).
- `src/features/generate/CreateAnythingDialog.tsx` — the four-tab dialog (Manual | Random | AI | Paste JSON), mounted in `App.tsx`. `deliver()` routes: single plain entity → prefilled editor drawer (`openCreate(type, initialForm, generation)` — Save = accept); anything bigger → `stage()` + `setRoute` to its home surface.
- `StagedBundleBar.tsx` — global floating Accept all / 🎲 Reroll (random mode only) / Discard bar with warnings disclosure.
- `useStagedGraph.ts` — merges staged graph drafts into canvas surfaces; pre-accept node drags write back into the staged draft.
- `AiTab.tsx` — provider gate (`resolveProvider` null → Settings link), `PrivacyConfirm.tsx` (shared with ComposePanel), `complete(config, {system, prompt, maxTokens: 4000})`, parse → deliver; parse failure shows the raw reply + Retry.
- `NodeGraphCanvas.tsx` — additive `stagedIds` (dashed ghost styling, staggered pop-in animation) + `fitKey` (fit-to-view trigger); `useCanvas.ts` gained `fitTo`.
- Entry points shipped: roster ✨ split button (all 16 types), palette "Create <type>…"/"Generate <type>… ✨" commands, Skill Trees "✨ Generate tree/branch…", quests dialog "Questline" toggle, relationships dialog "A set" toggle, dossier Copy-as-JSON/Copy-AI-prompt, drawer Paste JSON + per-field 🎲 dice + Fill empty fields + Reroll all.

## 3. Commit history on this branch

| Commit | Contents | State |
|---|---|---|
| `G1:` | Foundations + JSON round-trip (types/spec/coerce/serialize/apply, undo case, dialog Manual+Paste, split button, palette, dossier copy actions, drawer paste). Also fixed a real pre-existing bug: cast's `title` (honorific) field id collided with the identity column and silently never saved — renamed to `honorific`. | ✅ tested |
| `G2:` | Random core (rng, 5 theme lexicons, generic filler for all 16 types, Random tab, drawer dice/fill/reroll). | ✅ tested |
| `G3:` | Skill trees end-to-end (skills pack, topology, layout, staged ghost preview, StagedBundleBar, tree surface upgrades: Auto-arrange/Fit/branch legend+colors). | ✅ tested |
| `WIP G4/G5/G6:` | AI tab + wire tree/questline parsing (G5 ~done), cast/quests/locations packs + questline + roster ghosts (G4 ~done), relationship-set/tangle engine builders + dialog wiring (G6 engine done, surface UI NOT done). | ⚠️ compiles, unit tests green, but see §5 |

Verification state at handoff: `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npx vitest run` **95/95** ✅ · last FULL e2e run (before the WIP commit's final edits): **120 passed, 8 skipped**; the 24 specs in `tests/e2e/16-generate.spec.ts` were green including the mocked-AI and questline flows. **Re-run the full suite before your first commit** — the G6 dialog wiring landed after that run.

## 4. Content packs (`src/services/generate/random/packs/`)

`index.ts` holds the `Archetype`/`TypePack` interfaces, hint→archetype matcher (`matchArchetype`), theme resolver, and the registry. A registered pack drives its type everywhere (Random tab, dice, batches, compound builders); unregistered types fall back to the config-driven `generic.ts`.

| Pack | Status | Archetypes |
|---|---|---|
| `skills.ts` | ✅ registered (also aliased to `abilities`) | sorcery, poison, flame, shadow, blade, holy, wilds, storm, tech, mindcraft |
| `cast.ts` | ✅ registered | rogue, noble, veteran, scholar, zealot, fixer, hunter, seer |
| `quests.ts` | ✅ registered | heist, escort, rescue, investigation, delivery, revenge, siege, pilgrimage |
| `locations.ts` | ✅ registered | 8 archetypes (agent-authored, lint/tsc clean) |
| `items.ts` | ❌ **TODO** | suggested: weapon, armor, relic, tool, consumable, trinket, document, cursed |
| `bestiary.ts` | ❌ **TODO** | suggested: apex predator, swarm, undead, construct, spirit, aberration, mount, trickster |
| `factions.ts` | ❌ **TODO** | suggested: thieves guild, noble house, religious order, merchant company, rebel cell, knightly order, cult, scholars |

**How to write a pack** (follow `skills.ts` as the reference — structure, comment density, quality):
1. Read the type's config (`src/domain/entity-configs/<type>.ts`) — every `fields` key you emit MUST be a real field id with the exact FieldKind shape (pills/select values must be copied verbatim from the config's option lists; chips/row-list → `string[]`; stat-grid → `{name,value}[]` strings; related → `EntityRef` from `ctx.known` of the right type or omit; never fill `image`/`phrase-tester`/identity ids inside `fields`).
2. 6–10 `Archetype`s with rich lexicon pools (8+ entries per main slot), 5–10 hint `keywords`, thoughtful `themes` (`'any'` if genre-neutral).
3. One `generate(rng, arch, ctx)` composing every field from the archetype's lexicon via template forms; `import type { Archetype, TypePack } from './index'` (type-only import — value imports would cycle); names from `lexicon.ts` helpers (`itemName`, `creatureName`, `factionName`).
4. Register in `index.ts` (`registerPack(xPack)` at the bottom).
5. Build enforces `noUnusedLocals/noUnusedParameters` — prefix unused params `_`.

## 5. EXACT remaining work, in order

### Step 1 — finish G4 packs (~M)
Write + register `items.ts`, `bestiary.ts`, `factions.ts` per §4. Field contracts: items has itemType/rarity/condition/status/slot pills, modifiers/affixes/passive/active/triggered row-lists; bestiary has category/threatLevel/disposition pills, regions/abilities/weaknesses chips, habitat/diet text, behaviour/lifecycle prose; factions has kind pills, goals/methods chips, leader/headquarters related, ideology/structure prose. Add a coherence unit test (fixed seed → snapshot-ish assertions) per pack in `tests/unit/generate.spec.ts` (`generate/random engine` describe block already asserts every type yields valid drafts — the packs automatically inherit that).

### Step 2 — finish G6 surface UI (~M)
The engine builders and dialog toggles already exist and are committed. Missing:
1. **`RelationshipGraph.tsx` ghost edges**: read `useGenerationStore(s => s.staged)`; map staged `relationships`-type drafts into the derivation (pseudo-entities `{id: draft.localId, fields: {from,to,bondType}}`), pass `stagedIds` (draft localIds) to `NodeGraphCanvas` so staged bonds render dashed. Cast endpoints are real refs so nodes just appear.
2. **`TangleSurface.tsx`**: mirror what `SkillTreesSurface.tsx` does (it is the template — diff it against G3's commit): `const overlay = useStagedGraph('tangle')`; virtual new board takes over the canvas (picker shows "✨ name (staged)", editing controls hidden); `overlay.merge(board.id, board.cards, board.edges)` for add-to-board drafts; `onMoveNode` routes staged ids to `overlay.moveStagedNode`; sidebar buttons "✨ Generate board…" (`openGenerate({kind:'tangle'})`) and, with a board active, "✨ Add generated cards…" (`{kind:'tangle', targetGraphId: board.id}`).
3. **Relationships graph-view button**: in `EntityRosterSurface.tsx`'s alt-view header (the `view !== 'list'` branch), add "✨ Generate relationships" → `openGenerate({kind:'relationship-set', entityType:'relationships'})` for `graphCapable`.
4. **Paste-tab context checkboxes** (planned, optional-but-promised): in `PasteTab`'s copy-prompt row, checkboxes to include cast names / location names / the existing tree in the copied prompt. `buildGenerationPrompt` already embeds known names; gate the `knownNamesBlock` content on these choices (thread an options param through).
5. E2E: relationship set staged in graph + accepted; tangle board generated + accepted (extend `tests/e2e/16-generate.spec.ts`; boot helpers in `tests/e2e/helpers.ts`).

### Step 3 — G7 chapters (~M)
1. Engine: `case 'chapter'` in `generateRandomBundle` — one `BundleChapterDraft { localId, title, summary, beats[5-9], linkedEntityLocalIds }`; compose beats from quest-style grammar + `contextRefs`. `apply.ts` ALREADY writes chapter bundles (TipTap doc from summary+beats/prose, ordered after existing chapters) and undo already removes them — tested in unit `generate/apply`.
2. Wire: add a `chapter` schema to `buildGenerationPrompt` (`{kind:'chapter', title, summary, beats:[], prose:[]}`), and a `parseChapterPayload` in `wire.ts` (mirror `parseQuestlinePayload`).
3. UI: Writer's Room chapter strip "✨ Generate chapter…" → `openGenerate({kind:'chapter'})`; dialog subject/kind wiring (mirror how `tangle` was added — `isFixedKind`, subject string, Random+AI+Paste tabs); AI tab opt-in "Draft prose for each beat" checkbox → one `complete()` call per ~3 beats appended into `draft.prose` (privacy-guarded — reuse `PrivacyConfirm`); Writer's Room routing already works via `routeForBundle` (`chapters.length → 'writers-room'`).
4. Chapter bundles need a preview: simplest compliant approach is the StagedBundleBar alone (it works on every surface); a ghost chapter tab in Writer's Room is a nice-to-have.
5. E2E: generated chapter opens in Writer's Room with beats as paragraphs.

### Step 4 — G8 polish (~M)
1. **Generation history**: Dexie **version 7** in `src/db/schema.ts` — table `generations: 'id, projectId, [projectId+createdAt]'` storing the last 25 accepted/staged bundles + seeds per project (follow the additive-migration pattern of versions 2–6). Small history panel in the dialog (per-kind or global) with "Re-stage" (`stage(bundle)` again) and "Copy seed".
2. **Field locks**: 🔒 toggle beside the drawer dice (state: `Set<fieldId>` in the drawer); "Reroll all" and "Fill empty fields" skip locked ids.
3. **Save accepted bundle as template**: after `applyBundle`, offer a toast action for single-type bundles → `saveEntityTemplate` (exists in `src/services/templates.ts`) per created entity, or board template for tangles (`saveBoardTemplate`).
4. **Duplicate-guard badges**: `EntityBundlePreview` already shows "updates existing"; surface the same badge on staged roster ghost cards.
5. Every new control: SURFACE_CHECKLIST row + spec (see §6).

### Step 5 — final sweep
Full e2e suite, update `docs/rebuild/SURFACE_CHECKLIST.md` (G1–G3 sections exist; add G4–G8), a manual hero-flow check (see §7), final commit + push.

### Step 6 — Extraction 2.0 (the next milestone family)
After G8 ships, start §10. It is the user's core product vision — read it in full.

## 6. Non-negotiable repo conventions

- **"No dead buttons"**: every rendered control must genuinely work AND have a row in `docs/rebuild/SURFACE_CHECKLIST.md` naming the spec that proves it (`README.md` + `docs/rebuild/ARCHITECTURE.md` are the law here).
- Per milestone: `npm run lint` + `npx tsc --noEmit` + `npx vitest run` + `CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test` all green, then commit + push to THIS branch (never another).
- The production build (`tsc -b`) enforces `noUnusedLocals`/`noUnusedParameters` — plain `tsc --noEmit` does NOT catch these, the Playwright webServer build will. Run `npm run build` if e2e fails with "webServer exit code 2".
- e2e runs BOTH desktop-chromium and mobile-chromium projects — new UI must work on mobile (nav helper `openNav` in `tests/e2e/helpers.ts` handles the Browse/More sheets).
- Zero new runtime dependencies. TS strict. `lw-*` CSS class conventions (all styles in `src/styles/components.css`). AI e2e mocks provider HTTP via `page.route` — never real keys.
- Roster-card accessible names start with avatar initials — match with `/Name/` regex, never `/^Name/`. Toasts render outside dialogs — assert with `page.getByText`, not scoped to the drawer. Playwright `getByLabel` substring-matches — the drawer dice buttons (`aria-label="Reroll X"`) collide with field labels; use `{ exact: true }`.

## 7. How to verify the hero flows by hand

`npm run dev` → create a blank project → Skill Trees → "✨ Generate tree…" → Random tab, theme "High fantasy", hint "sorcerer", 12 skills → Roll it. Ghost constellation pops in with staggered animation; drag a node; Accept all; check Skills roster has 12 rich entries; toast Undo reverts everything. Then Cast → ✨ → Paste JSON tab → "Copy prompt for external AI" → run it through any chat AI → paste the reply → drawer fills across every tab. AI tab: add a key in Settings (or point Ollama at localhost) and repeat in-app.

## 8. Project-wide context (beyond this branch)

- The repo is a **modular rebuild** (`src/`) of a legacy single-file app (`/legacy`, reference only — its callback system is banned by eslint). Stack: Vite + React 19 + TS strict, Zustand (UI state), Dexie/IndexedDB (all data, project-scoped), TipTap manuscript, d3-force, PWA. Docs: `docs/rebuild/ARCHITECTURE.md` (rules), `docs/rebuild/SURFACE_CHECKLIST.md` (control inventory), `docs/legacy/*` (the legacy prototype's own specs — `FIELD_PARITY_AUDIT_CURRENT.md` etc.).
- **A feature-parity audit against legacy was done for this task.** Editor field depth survived the rebuild (Cast ≈59/64 fields, Items 43/43), but these were LOST and are candidates for a follow-up task the user already signalled interest in ("restore lost functionality" — explicitly deferred out of this branch's scope): ~17 bespoke per-type workspaces (Quest Log, Item Vault, Stat Lab, Cast Dossier, Research Library…), rich per-type dossiers (locations hierarchy tree, mentions sparklines), Project Intelligence store, most Settings sections (14 → 4), panel stacking, Atlas manual route drawing/focus mode. The generation branch already restored per-entity JSON paste and deepened Skill Trees (auto-arrange, groups, fit).
- Known pre-existing quirks worth knowing: entity `fields` is an untyped bag (widgets tolerate legacy shapes); per-field `required` flags are declared but only the name is enforced on save; `db.auditLog` ring-buffers at 500 entries/project.

## 9. Session/task list state

Task tracker at handoff: G1–G3 completed; #4 (G4) in progress — items/bestiary/factions packs remain; #5 (G5) effectively done but unverified by a post-WIP full e2e run; #6 (G6) engine done, surface UI remains; #7 (G7 chapters) and #8 (G8 polish) not started. Follow §5 order.

---

## 10. EXTRACTION 2.0 — Story Intelligence (next milestone family, X1–X6)

### The vision (user's words, distilled)

"A dungeon master's dream." The author writes a chapter — in the app, or by running our **mega-prompt** through their own LLM subscription (keeping costs on their existing plan) — pastes once, presses ONE button, and the app extracts **everything** and understands the **consequences**, across every tab:

- A character learns a skill → the skill is logged as a rich entity, added to THAT character's skills, placed on (or suggested for) the right **skill tree** — and the app suggests what else the skill could grow into.
- The party reaches a new town in a known region → the location is created **nested under the right parent** in the hierarchy.
- An item changes hands → **current ownership** updates, history appends.
- And the app **thinks forward**: suggested quest outcomes, story arcs, and which other characters could be involved based on the relationship web.

Maximum smarts **offline with no AI keys**; AI (in-app keys or the paste round-trip) layers the genuinely creative reasoning on top.

### Decisions locked with the user (do not re-litigate)

| Question | Decision |
|---|---|
| Priority | AFTER the generation milestones (G4–G8) ship |
| Confirmation flow | **Smart review board**: one paste → grouped relational cascades → per-group toggles → one "Accept all" → ONE Undo |
| Offline/AI split | **Max offline** — all tracking/propagation/placement offline, plus offline suggestions powered by the content packs & relationship web; AI enriches (prose-quality expansions, novel arcs) |
| Mega-prompt | Carries a **full world digest** (entities + key fields, location hierarchy, tree structures, ownerships, relationship web); reply schema returns **facts AND suggestions**; our engine verifies/merges |
| Suggestions | Own lane on the review board AND a persistent per-entity **Suggestions inbox** (dossier chips); volume slider (quiet/balanced/abundant) beside the existing extraction sliders; dismiss = gone, accept = real data |
| Conflicts/ambiguity | **Best guess + flag**: confidence-scored so Accept-all always works; conflicted items get visual flags + one-click correction pickers; contradictions show explicit before→after |
| Own chapters | **One engine, every input** — Save & Extract in the Writer's Room produces the same board as a paste, fully offline |
| Skill expansion depth | ALL THREE: rich skill sheet (from pack archetype) + tree placement & sibling skills + ripple effects (linked stats, class fit, synergistic items, other characters who could learn it via relationships) |
| Paste size | **Up to a whole book**: auto-chunk (`chunkText(5000, 500)` exists), progress indicator, cross-chunk dedupe, ONE merged review board — whole-manuscript onboarding is a headline feature |
| Suggestion voice | **Concrete and ready-to-accept**: every suggestion (mechanical AND story) is a finished, specific artifact — 'Venom Strike II — the coating spreads to thrown weapons (cost: 2 doses)' — with one Accept button. A co-DM handing you finished cards, not open questions |
| Digest privacy | **Inform once + depth control**: a one-time notice the first time a full-world digest is copied (what it contains, that it goes wherever pasted), plus the always-visible lean/standard/full depth selector. No repeated friction |
| Mobile | **Full parity, adapted layout**: the grouped cascade board works one-column on phones (groups as expandable cards) with Accept all, flags, AND correction pickers usable — per the repo's mobile e2e rule. A DM at the table pastes from their phone |
| Board & paste home | User-confirmed: the smart board **upgrades ReviewSurface in place** (route `review`, flat list kept as a toggle during transition); paste box + mega-prompt copy live on the Handoff surface renamed **"Import & Extract"** |
| Priority | Re-confirmed after the spec was written: generation milestones (G4–G8) finish first |
| Remaining details | Implementer's judgement, marked as such below |

### Product principle (user-mandated — applies to ALL future features)

**Offline smarts are free forever; AI enriches.** Every tracking/propagation/placement feature MUST work with zero AI keys. Every AI-powered feature MUST degrade gracefully to the copy/paste round-trip so authors can spend their existing LLM subscription instead of ours. Keep this line crisp in every design decision.

### Architecture — build on what already exists

New module `src/services/intelligence/`. The generation system was built to be this engine's chassis — reuse aggressively:

- **`StoryDelta`** — the output currency, a superset of `GenerationBundle`: entity **creates** (BundleEntityDraft), entity **UPDATE PATCHES** (field-level, each with `before`→`after` and a confidence band), graph placements (tree node adds), hierarchy placements (`locations.parentId` sets), links, and `suggestions[]`. **Accept = an extended `applyBundle`** — the transaction + single-`generate.apply`-style audit entry + one-Undo machinery already exists in `src/services/generate/apply.ts`; extend it with replace-style field patches (ownership) alongside the current merge semantics.
- **Propagation rules** (offline, deterministic) — a rule registry consuming the EXISTING 12 detectors' output (`src/services/extraction/detectors.ts`) plus entity semantics:
  - `skill-learned(char, skill)` → ensure skill entity exists (rich sheet via `matchArchetype` + the skills pack), add to the character's skill links, propose tree/branch placement by matching the archetype against existing trees' `group` names, propose sibling/next-tier skills.
  - `item-transfer(item, from, to)` → set `fields.currentOwner`, append `ownershipHistory`, conflict-flag if the recorded owner ≠ `from`.
  - `travel(char, place)` → update `currentLocation` + `travelHistory`; NEW place → infer `parentId` from containment cues in the sentence ("a town in the Vraska region") → fuzzy match known parents (`findKnownEntityMention`) → else a flagged suggestion with a picker.
  - relationship signals → create/update relationship entities (valence/intensity nudges shown as before→after).
  - `quest-progress` → advance StepRows; completion → outcome suggestions.
- **Suggestion engines** (offline): content-pack expansions (the archetype lexicons make surprisingly good offline creativity); relationship-web arc candidates (graph traversal: shared factions, rival bonds, unresolved quests touching the same cast); quest-outcome grammars (quests pack). Volume slider gates how many fire.
- **Suggestions inbox**: new Dexie table `suggestions` (`id, projectId, [projectId+status], targetRef, kind, payload, source: 'local'|'ai'|'handoff', status: 'pending'|'accepted'|'dismissed', createdAt`). Dossiers (`EntityDetail.tsx`) render pending chips for their entity; accepting a payload-carrying suggestion stages a mini StoryDelta.
- **World digest + mega-prompt**: `buildWorldDigest(projectId, depth)` — compact structured digest; the prompt asks for a StoryDelta-shaped JSON reply (facts + suggestions), reusing the wire conventions (names never ids — `parseWireBundle`'s coercion path in `src/services/generate/wire.ts` / `coerce.ts` is the verifier). Every external claim is confidence-checked against the offline engine before landing on the board.
- **The board**: upgrade `src/features/review/ReviewSurface.tsx` in place (route `review` stays) — group candidates by subject entity, render cascades as connected changes ("Vex learned Venom Strike → +skill → Serpent Path ▸ Toxins → 2 sibling suggestions"), reuse confidence bands, flags with pickers, Accept-all bar mirroring `StagedBundleBar`.
- **Whole-book intake**: chunk → per-chunk extraction → merge deltas (dedupe via known-index + the sibling-draft machinery in `coerceEntityList`) → one board. Progress UI like deep-extraction's.

### Milestones

| # | Milestone | Contents |
|---|---|---|
| **X1** | StoryDelta + applyDelta | Model, update-patch semantics in apply, `suggestions` table (next Dexie version), undo case, unit fixtures |
| **X2** | Propagation rules | The offline rule registry fed by existing detectors; golden fixtures per rule (ownership, travel/nesting, skill-learning, relationships, quest progress) |
| **X3** | Smart review board | ReviewSurface upgraded: grouped cascades, conflict pickers, before→after diffs, Accept all + one Undo; e2e |
| **X4** | Suggestions | Offline generators (packs + relationship web + outcome grammars), inbox table + dossier chips + volume slider; e2e |
| **X5** | Mega-prompt round-trip | World digest builder + depth handling, facts+suggestions reply parsing/verification, whole-book chunked intake with merged board; e2e with canned replies |
| **X6** | One engine, every input + AI enrichment | Save & Extract produces StoryDelta; in-app AI enrichment through `complete()` with the digest prompt (privacy-guarded); polish, SURFACE_CHECKLIST, docs |

### Implementer's-judgement calls (revisit freely; the first two above were since user-confirmed)

- Copying the digest to the clipboard is user-initiated and needs no per-copy guard (the one-time notice covers it); **in-app** AI calls keep the existing `PrivacyConfirm` gate. Digest targets ≤ ~8k tokens at full depth; over budget it auto-degrades (summaries → names-only) and says so in the prompt header.
- Suggestion records cap at ~200/project (oldest dismissed first) to keep the inbox honest.


---

## 11. Extraction 2.0 — SHIPPED (X1–X6)

Built on branch `claude/writing-extraction-review-84loqt`, ahead of G4–G8 at the
repo owner's request ("the full one-button vision"). Everything below works with
**zero AI keys**; AI only ever adds to a result the offline engine already produced.

| # | Milestone | State | Where |
|---|---|---|---|
| X1 | StoryDelta + applyDelta | ✅ | `src/services/intelligence/types.ts`, `apply.ts`; Dexie v8; undo case `intelligence.apply` |
| X2 | Offline propagation rules | ✅ | `src/services/intelligence/rules.ts`, `engine.ts`; signals in `extraction/detectors.ts` |
| X3 | Smart cascade review board | ✅ | `src/features/review/CascadeBoard.tsx`, `src/stores/intelligence.ts` |
| X4 | Suggestions + inbox | ✅ | `src/services/intelligence/suggestions.ts`, `src/db/repos/suggestions.ts`, `src/features/codex/SuggestionChips.tsx` |
| X5 | Mega-prompt round-trip + whole-book intake | ✅ | `src/services/intelligence/digest.ts`, `session.ts`, `src/features/handoff/HandoffSurface.tsx` |
| X6 | One engine every input + AI enrichment | ✅ | `src/services/intelligence/enrich.ts`; Save & Extract in `WritersRoom.tsx` |

### The load-bearing design decisions

- **`StoryDelta` is a superset of `GenerationBundle`.** The generation system was
  built as this engine's chassis and is reused, not duplicated — same draft shape,
  same coercion, same packs. The one thing it lacked was field-level patches: a
  whole-bag field merge cannot express "the owner changed from Marrow to Vex",
  because the spread silently keeps whichever value wins. `DeltaPatch` carries an
  explicit before/after and a `replace|append` mode.
- **Detectors emit typed `ExtractionSignal`s.** They always knew who did what to
  whom, but flattened it into a prose summary and an unordered `relatedEntityIds`.
  Keeping the roles is what makes the continuity flag possible: you can only say
  "the recorded owner is not who handed it over" if you know which participant was
  the giver.
- **Every unit carries a `unitId`; groups reference them.** A per-group toggle on
  the board becomes one `enabledUnitIds` filter at apply time — no parallel state.
- **One snapshot per entity, on first touch.** Several patches in one cascade can
  hit the same row; snapshotting once is what makes a single Undo restore the true
  original rather than the state between two patches.
- **External claims run through the SAME rules.** `parseDeltaReply` resolves a
  pasted (or in-app) AI reply to real entities by name, converts it into the exact
  signal shape the local detectors emit, and feeds it to `runPropagation`. A model
  cannot make the app write anything the offline engine would not have written —
  it can only point at what to look at.
- **Offline wins collisions.** `mergeDeltas` keeps the locally-derived patch when
  both passes found the same field, because it came from a deterministic rule
  reading the actual prose.

### Two detector corrections made along the way

- `detectTravel` took the first known location anywhere in its 160-char window, so
  *"reached Ashen Ford, a town in the Vraska region"* moved the character to Vraska
  and lost the town entirely. Destination now resolves by proximity to the verb.
- Its `suggestedChanges.location` is a bare id under a field id `cast` does not
  have (the real field is `currentLocation`, an `EntityRef`). The golden fixtures
  pin that key as the legacy contract, so it stays as-is; the signal carries the
  correct write. **Do not "fix" it in the detector — fixture 05 asserts it.**

### Schema additions

- Dexie **version 8**: `suggestions` table (`id, projectId, [projectId+status],
  [projectId+createdAt], targetEntityId`).
- `items` config gains `ownershipHistory` (row-list) — the spec calls for appending
  chain of custody and there was nowhere to put it.

### Verification

`npx tsc --noEmit` ✅ · `tsc -b` (the build; catches `noUnusedLocals` that
`--noEmit` does not) ✅ · `npm run lint` ✅ · `npx vitest run` **149** ✅ ·
`tests/e2e/18-story-intelligence.spec.ts` **4/4 on BOTH desktop and mobile** ✅

### What is deliberately NOT done

- **Quest-progress propagation.** The `questProgression` detector does not yet emit
  a signal — it reports a quest *exists*, not that a step advanced, so there is no
  step-level information to propagate. Needs a step-aware detector first.
- **Giver inventory pruning.** An item transfer appends to the receiver's
  inventory but does not remove it from the giver's; `DeltaPatch` has no `remove`
  mode. Add one before claiming inventory is authoritative.
- G4–G8 remain as described in §5.


---

## 12. Offline depth + free-tier AI parity — SHIPPED

Built on branch `claude/writing-extraction-ai-capability-ht7duk`, answering the
repo owner's brief: *the app should do the bulk of the work itself, especially
extraction; and a free-tier key should follow Opus-5-level instructions well
enough to get the same result.*

### The three things that capped the offline engine

All three showed as one symptom — paste a book into a new project, get
"nothing trackable found" back while the engine held a chapter full of people.

1. **Typing was first-cue-wins.** `assessCandidateQuality` is an ordered chain
   of early returns, so a single `"handed the blade to Vex"` outranked three
   sentences Vex was the subject of and filed the protagonist under Locations.
   `extraction/role-evidence.ts` now weighs cues across every occurrence; the
   cues a person and a place share must win that vote before they may decide.
2. **One pass, so the codex could not bootstrap itself.** Detectors bind verbs
   to *known* entities, and discovery ran beside them without ever feeding
   them. `runLocalExtraction` now runs a second detector pass with pass-1
   discoveries standing in as provisional entities (`prov:` ids), and the
   propagation rules resolve either kind of participant via `RuleTarget`.
3. **Propagation skipped signal-less candidates** — i.e. every discovery — and
   the paste path only ever built a delta. `ruleEntityIntroduced` turns them
   into create units, filed into the cascade that depends on them (so a toggle
   stays coherent) or rolled up per type.

Measured on four sentences with an empty codex: **1 cascade before, 4 after**.

### Also closed

- Item detectors can name an item the codex has never seen (`findUnknownItemName`),
  mirroring what the skill detector already did for techniques.
- A name typed two ways in one run defers to the detector that bound it to a
  verb (`arbitrateTypes`) — "Venom Strike" was becoming a character.
- `DeltaPatch` gained `remove`; a transfer takes the item off the giver.
- Quest progress: `detectQuestProgress` + `ruleQuestProgress` + offline
  outcome cards. (This was the "deliberately NOT done" item in §11.)
- Detector verb lists are extensible per project — "nicked" is ordinary English.
- New places were created with `kind: 'Settlement'`, which is not one of the
  locations config's options.
- `itemsPack` had been written, exported and never registered since G4; every
  generated item fell through to the generic filler. Registered, plus new
  `bestiary.ts` and `factions.ts`. `tests/unit/packs.spec.ts` now walks every
  pack against the real config — `entity.fields` is untyped, so nothing else
  stopped a pack writing an unknown field id or an out-of-list pill value.
- Provisional ids were leaking into `db.candidates`, where `existingEntityId`
  means a row you can update.
- Audit `at` is monotonic; two entries in one millisecond sorted arbitrarily,
  so Undo could offer the wrong action.

### Free-tier parity

**The premise:** the gap between a frontier model and a free one is rarely
reasoning about fiction. It is compliance — a large model treats "return only
JSON" as a constraint and infers the rest of the contract; a small one treats
it as a suggestion and guesses at everything unstated. So nothing is unstated.

- `services/ai/providers.ts` — JSON enforced at the API level per provider
  (`response_format`, `responseMimeType`, Ollama `format`, Anthropic assistant
  prefill), `temperature`, and truncation surfaced from every provider's own
  stop reason. OpenAI-compatible calls retry once without `response_format`
  when a model rejects it, because OpenRouter fronts hundreds that do.
  New presets: Groq, Together, DeepSeek, Mistral, each flagged for free tier.
- `services/ai/json.ts` — one JSON path with local mending (trailing commas,
  smart quotes) and **one repair round-trip**. A truncated reply is reported,
  never re-asked: it would truncate in the same place.
- `services/ai/prompts/` — role line, hard output contract restated at the
  tail, config-derived field guidance, **one worked example with real
  content**, a negative example, and an explicit omission rule. `tierForModel`
  reads the size out of the model id and narrows the *scope* of the job
  (fewer categories, smaller chunks, leaner digest) rather than its quality.
- `services/ai/canon.ts` — canon travels out with the writing brief (who owns
  what, who is where, who is bonded to whom) and the generated draft is read
  back by the same offline engine before Insert. Contradictions, changes and
  new names are shown. Costs nothing, needs no key.
- The Compose brief gained tense, POV discipline, dialogue rules, a word
  target, anti-patterns, and the author's own measured `StyleProfile`.

### Verification

`npx tsc --noEmit` ✅ · `npm run build` (`tsc -b`) ✅ · `npm run lint` ✅ ·
`npx vitest run` **215** ✅ · full Playwright suite **140 passed, 10 skipped,
0 failed** on BOTH desktop and mobile ✅

### Still open

- The flat review queue and the cascade board both render findings from the
  same extraction. That was fine when cascades were rare; now that discovery
  reaches the board, the two lanes overlap and the flat list should probably
  become the "everything else" lane rather than a parallel view.
- `buildExtractionPrompt` derives its field guidance by hand rather than from
  `promptFieldLines(type)`. The generation prompts already do it properly;
  unifying them would let the extraction schema follow the configs too.
- Suggestion volume is read for cascades but not yet for quest outcomes at the
  per-surface level.

---

## 13. Studio redesign N1–N5b — SHIPPED (branch `claude/novelcrafter-analysis-ui-redesign-5b8jva`)

Full spec: `docs/REDESIGN_PLAN.md`. Live state: `docs/AGENT_QUEUE.md`.

**N1 Studio design system** — `studio-dark` (new default) + `studio-light` OKLCH
themes, a revised shared token scale, `lib/motion.ts`, and a Tweaks panel driving
theme / density / typeface / prose measure / motion / focus. Tweaks live in
localStorage, not Dexie, because `index.html` must read them before first paint.

**N2 Four destinations** — Write · Plan · Codex · Insights · Worlds, everything
else behind ⌘K with `>` `@` `#` `/` modes. `setRoute` normalises legacy route
ids into destination + sub-view, so ~100 call sites needed no edit.

**N3 Acts › Chapters › Scenes** — Dexie v9. Prose moved down to `Scene`;
`chapterRollup()` reassembles a chapter from its scenes, which is why extraction,
search, the world bible and the speed reader needed no changes. First prose
history in the app's life: interval / pre-ai / pre-import snapshots, the last two
never pruned, restore itself snapshotted.

**N4 Plan** — Outline · Board · Matrix · Timeline over one query. Matrix cells
render three sources, and the faint one is **what extraction found in the prose**,
promoted to a fact with a click. No competitor can draw that column.

**N5a Scene beats** — an instruction that lives in the prose, survives its own
expansion, and is invisible to word count, extraction and exports by construction
(it carries no `pid`, so `paragraphsFromDoc` never sees it). Offline it copies a
prompt and takes a paste.

**N5b AI visibility, acts, sections, rewrite, focus** — the milestone's throughline
is **making AI-visibility real at both scales**, because an audit found the N3
"Let AI read this scene" checkbox had *zero readers*: a privacy promise the app
did not keep.

- `chapterRollup` is the choke point. A hidden scene contributes its `doc` and its
  `wordCount` but not its paragraphs — the array every AI path reads.
- Sections carry **independent** `hiddenFromAi` / `hiddenFromWordCount`. One
  document now yields two lists (`deriveScene`), so `countWords(scene.paragraphs)`
  legitimately disagrees with `scene.wordCount`. **Anything that wants paragraph
  *ids* — occurrence re-anchoring, the Matrix's paragraph→scene map — reads the
  unfiltered document.** Filtering happens once, at derivation, for text only.
- Local search filters by nothing; the speed reader filters by word count only.
  Hiding a scene from a model is not hiding it from its author.
- Acts became reachable (they had CRUD and no UI since N3); the rewrite bubble
  landed with a prompt that demands every proper noun and fact survive; focus mode
  finally reads the preference N1 stored and nothing consumed.

Six dead controls across N1–N4 traced to one cause — a spec that asserts the
*write* and never the *effect* — and `docs/AGENT_RUNBOOK.md` §4 now forbids it.

### Verification

`npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ ·
`npx vitest run` **279** ✅ · full Playwright suite **232 passed, 10 skipped,
0 failed** on BOTH desktop and mobile ✅
