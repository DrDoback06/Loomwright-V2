# HANDOFF — App-Wide "Create Anything" Generation System

**Branch:** `claude/app-completion-handoff-7wabte` (continues `claude/entity-creation-generation-vafhf4`) · **Status:** **G1–G8 AND X1–X6 (Extraction 2.0) COMPLETE & tested** (full suite green: lint · tsc · build · vitest · Playwright desktop+mobile — last run **154 e2e passed / 127 unit**). The app-wide generation system and the Story Intelligence engine both shipped.
**For:** one agent/session continuing sequentially. Read this file top to bottom before touching code. The approved plan lives in the repo owner's session notes; this document supersedes it as the source of truth for remaining work.

> **Completion log (branch `claude/app-completion-handoff-7wabte`):**
> - **G4** — items pack registered; `bestiary.ts` + `factions.ts` written (8 archetypes each) + coherence unit tests; shared `article` a/an helper. All seven core types now have deep packs.
> - **G6** — RelationshipGraph ghost bonds; TangleSurface staged overlay ("✨ Generate board…" / "✨ Add generated cards…"); roster "✨ Generate relationships"; Paste-tab cast/location/tree context checkboxes; e2e.
> - **G7** — `buildChapter` engine + chapter wire schema/parse; Writer's Room "✨ Generate chapter…" + staged preview; AI "Draft prose for each beat" opt-in; e2e (beats → manuscript paragraphs).
> - **G8** — generation history (Dexie **v7** `generations` table, cap 25, dialog panel + Re-stage/Copy seed); drawer 🔒 field locks; save-accepted-as-template toast action (toast gained `actions[]`); duplicate-guard badge on staged ghosts. e2e for each.
> - **X1** — `StoryDelta` model + `EntityFieldPatch` (replace/append); `applyBundle` extended with patch semantics (grouped, live-snapshot, undo restore); `src/services/intelligence/` (StoryDelta, applyDelta); Dexie **v8** `suggestions` table + repo. Unit fixtures.
> - **X2** — offline propagation rules (`intelligence/propagate`): ownership/transfer (+ conflict flag), item-loss, travel, location nesting (parentId inference), relationships, quest-progress, and the offline skill-learned scan (rich pack skill + character link + tree/sibling suggestions). Golden fixtures + detector→propagate→apply pipeline test.
> - **X3** — smart review board: `ReviewSurface` upgraded in place with a grouped-cascade **Board** view beside the kept **Flat** list; before→after diffs, ⚑ conflict flags, per-group include toggles, Accept-all → one `applyDelta` → one Undo. e2e drives the whole detector→board→undo path incl. the conflict flag.
> - **X4** — offline suggestions engine (`intelligence/suggest`: relationship arcs, quest outcomes, skill siblings — each with a payload delta) + volume setting; per-dossier ✨ **Suggestions inbox** (Accept applies the payload, Dismiss removes); review-board "✨ Suggest threads". e2e.
> - **X5** — **Import & Extract** surface (renamed from AI Handoff): whole-book offline chunked intake (`intelligence/intake`, progress); world digest (`intelligence/digest`, lean/standard/full) + mega-prompt (`intelligence/megaprompt`) with a one-time privacy notice; reply import routes facts → Review, suggestions → inboxes. e2e.
> - **X6** — in-app **AI enrichment** on Import & Extract (mega-prompt via `complete()`, privacy-guarded, imports facts + suggestions); "one engine, every input" — chapter Save & Extract, whole-book paste, mega-prompt reply, and in-app AI all converge on the same review board → `applyDelta` → one Undo. e2e (mocked).
> - **X-review** — adversarial code-review pass over the Story Intelligence engine caught 7 real correctness bugs the milestone tests missed (empty-field append seeding, pronoun-giver false ownership conflict, quest status casing, cross-chunk change/quote union, mega-prompt `about` matching, suggestion skip-states, merge/alias folding). All fixed with regression tests (`intelligence.spec.ts`, `propagation.spec.ts`). Also fixed two pre-existing e2e strict-mode collisions where `getByLabel('<optional field>')` matched the field's new 🎲/🔒 controls (labelled "Reroll/Lock <field>") — tests now use exact matching.
> - **Verification** — every milestone committed + pushed after `npm run lint` + `npx tsc --noEmit` + `npm run build` + `npx vitest run` + full Playwright (desktop + mobile) green.

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

**G1–G8 AND X1–X6 are COMPLETE and verified** on branch `claude/app-completion-handoff-7wabte` (committed + pushed per milestone). The generation system is done (all 16 types generate offline, 7 with deep packs; skill trees / tangle boards / relationship sets / questlines / chapters stage-and-accept with one Undo; JSON round-trip + in-app AI). Story Intelligence (Extraction 2.0) is done: the offline propagation engine turns extraction into consequences (ownership, travel, nesting, relationships, quests, skill-learning), the smart grouped-cascade review board accepts a whole delta as one Undo with conflict flags, the offline suggestions engine feeds per-dossier inboxes, and the Import & Extract surface onboards a whole book offline or via a world-digest mega-prompt (external AI or in-app). Full suite green.

**No open milestones remain in this document.** Candidate follow-ups (out of scope here): the "restore lost functionality" family in §8 (bespoke per-type workspaces, richer dossiers, Project Intelligence store, Settings sections); flipping the review board's default view from Flat → Board once any remaining flat-view-dependent flows migrate; deepening AI enrichment (per-beat prose, novel arcs) beyond the current facts+suggestions round-trip.

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
