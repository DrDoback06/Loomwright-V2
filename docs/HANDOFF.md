# HANDOFF — App-Wide "Create Anything" Generation System

**Branch:** `claude/entity-creation-generation-vafhf4` · **Status:** G1–G3 complete & tested; G4/G5 mostly done; G6 half-done; G7/G8 not started.
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
