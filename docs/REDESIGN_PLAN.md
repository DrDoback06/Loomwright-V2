# Loomwright V2 — Novelcrafter Analysis, Studio Redesign & Autonomous Build Plan

**Branch:** `claude/novelcrafter-analysis-ui-redesign-5b8jva`
**Audience:** Fable, executing milestone by milestone, unattended, on an hourly cron.
**Relationship to existing docs:** `docs/HANDOFF.md` §5 (G6–G8) survives intact as milestone **N14**.

---

## Context

Loomwright V2 is a local-first writing and worldbuilding app: a TipTap manuscript (the
Writer's Room) fused with a 16-type typed codex, fed by an extraction pipeline that mines the
codex *out of* the prose and propagates the consequences — ownership transfers, travel with
location nesting, skill acquisition with skill-tree placement, relationship valence shifts,
quest-step advances — as a reviewable cascade with one Accept and one Undo. That engine
(`src/services/intelligence/`) has no equivalent in any competitor, novelcrafter included.

Novelcrafter solves the *other* half of the same problem, and solves it better than we do. It
is prose-first: a hand-maintained **Codex** whose entries are detected in the scene you are
writing and injected into every AI call; **scene beats** that expand to prose inline;
**Progressions** that gate codex facts to the point in the story where they became true; a
**Chat** with selectable story context; **Grid / Matrix / Outline** planning views over
scene-level metadata; and a **user-authorable prompt language**. Its authoring loop is tight,
its structure is visible, and its UI is calm.

We have the engine. We do not have the loop, the structure, or the calm:

- **No scenes.** The hierarchy is Project → Chapter → Paragraph. `Chapter` is atomic, so there
  is nothing to put on a board, nothing to colour a matrix by, and nothing to compute pacing
  or POV balance from.
- **No chat, no inline AI, no typed `@` mentions, no user-authored prompts, no scene
  summaries.** All AI drafting is a one-shot side panel (`ComposePanel`); codex links in prose
  are extraction-derived and always one run behind.
- **No per-entity AI-context control.** Everything the model is told is decided by
  `focusStore` and drag-dropped chips. The author cannot see or shape it.
- **29 nav items** in one left rail (13 routes + 16 entity types), no URL routing, no back
  button; a warm parchment/antique-gold language that is characterful but heavy at density.
- **No derived insight from the richest entity graph in the market.** We know who owns what,
  who is where, who is bonded to whom, and which chapter every mention lives in — and we never
  once say "Ruth has not appeared since chapter 9."

Meanwhile novelcrafter's own users name its weaknesses precisely, and every one of them is a
place we are already structurally stronger (§1.4).

**Outcome of this plan:** Loomwright keeps its engine and data model, gains novelcrafter's
authoring loop, context control and structural views, gets a Modern-Dark-Studio visual system
on a five-destination IA, and then takes the white space nobody occupies — **live, clickable
story-health analysis and a gentle nudge inbox** (Plottr is manual structure; Fictionary is
batch retrospective analysis; Sudowrite is generation with no structural feedback).

Two laws hold throughout, unchanged:

> **Offline smarts are free forever; AI enriches.** Every tracking / propagation / placement /
> analysis feature MUST work with zero AI keys. Every AI feature MUST degrade to the
> copy/paste round-trip.

> **No dead buttons.** Every rendered control genuinely works AND has a row in
> `docs/rebuild/SURFACE_CHECKLIST.md`. Zero new runtime dependencies. TypeScript strict.

---

## Part 1 — Novelcrafter vs Loomwright

### 1.1 Head-to-head

| Capability | Novelcrafter (mechanism) | Loomwright today | Verdict | Milestone |
|---|---|---|---|---|
| **Reference store** | Codex: 6 freeform types (character/location/object/lore/subplot/other); Description is the AI-visible field; **Notes/Research explicitly never sent** | 16 typed configs, ~59 fields on cast / 43 on items; the config *is* the AI schema, the paste parser and the random generator | **Ours, decisively** | keep |
| **Custom fields** | "Codex Details" — user-defined rich-text / quick-fact / tag / reference boxes, **each individually flaggable as not-seen-by-AI** | Fixed per-type field sets, all equally visible to AI | **Theirs on the AI gate**, ours on depth → take the per-field gate only | **N7** |
| **Entry → AI context** | Per entry: **Always include / Include when detected / Never**. Detection matches name + aliases, auto-plural, with **case-sensitive matching** and an **exclusions list** to kill false positives | `focusStore.focusedByType` + `lock` + dragged chips. No scanning, no per-entity policy, no exclusions | **Theirs. Take wholesale** | **N7** |
| **Progressions / Additions** | Codex addenda anchored to a scene position; the AI sees them **only for scenes at or after that anchor**. Two modes: *Addition* and *Replacement* | None. An entity's fields are timeless — writing chapter 2 sees chapter 40's facts | **Theirs, and it's their best idea.** Ours becomes better because extraction can generate them automatically | **N8** |
| **Long-book memory** | Per-scene **summaries** (AI, 80/120/300 words) + `storySoFar()` assembling all prior summaries, optionally POV- or act-filtered | Nothing. Whole-chapter text or nothing | **Theirs** | **N8** |
| **Scene beats → prose** | `/` slash menu → Scene Beat / Continue Writing; ≈500 words per beat, 6+ per scene; Apply / Retry / Discard / Section; `[bracketed]` stage directions | `BundleChapterDraft.beats: string[]` exists, `apply.ts` can write it, **nothing produces one**; ComposePanel is a modal one-shot | **Theirs.** We have the plumbing and no product | **N5** |
| **Inline text AI** | Text-replacement prompts on a selection (≥4 words): **Expand / Rephrase / Shorten**, each with a tweak panel and word target | None | **Theirs** | **N5** |
| **Editor blocks** | **Sections** (colourable, flaggable hidden-from-AI and hidden-from-word-count); `/note` = yellow section with both off; highlighters mapped onto a story-timeline rail | Paragraph notes in a margin rail | **Theirs** | **N5** |
| **Typed `@` mentions** | Names/aliases auto-underline as you type; click → preview card | Extraction-derived `Occurrence` decorations, one run behind | **Theirs** — and ours complements it; keep both | **N6** |
| **Manuscript structure** | Act › Chapter › Scene; scene carries summary, POV, labels, word count, **"is visible" AI toggle**, attached codex entries, revision history | Flat chapters: title, order, doc, wordCount | **Theirs. The keystone** | **N3** |
| **Revision history** | Auto every 3 min, each new revision overwriting the previous within that interval; separate histories for scene summaries and codex descriptions; scenes **archived, never deleted** | None. `saveChapterDoc` writes no audit entry — overwriting a chapter is unrecoverable | **Theirs** | **N3** |
| **Planning views** | Grid (default) · **Matrix** · Outline. Matrix = scenes × a switchable "Show" axis (POV / labels / codex types), cell filled if the entry appears in the **scene summary**, the **scene contents**, or was **manually assigned** | None. Atlas/Tangle/Skill-Trees are worldbuilding canvases, not manuscript planning | **Theirs** | **N4** |
| **Prompt authoring** | Full template language: C-style `{codex.characters()}`, `{storySoFar()}`, `{input("genre")}`, `{local()}`; Components, Inputs, Presets, **Model Banks**, Personas; clipboard import/export | Hardcoded in `src/services/ai/prompts/` | **Theirs** | **N10** |
| **Chat** | Threads; `+ Context` picks novel/outline/acts/chapters/scenes/snippets/codex-by-type-or-tag; personas; **Extract** turns a reply into codex entries / summaries / beats | None | **Theirs** — but our Extract is far stronger (see below) | **N9** |
| **Extraction prose → codex** | Chat "Extract" only: a model proposes entries from one reply, user confirms | 12 detectors + offline NER + bootstrap second pass, 16 golden fixtures, whole-book chunked intake | **Ours, uniquely** | keep |
| **Relational propagation** | None | `intelligence/rules.ts`: ownership, travel + parent inference, skill→tree placement, relationship valence, quest steps, with before→after diffs, conflict pickers, one Undo | **Ours, uniquely** | keep |
| **Providers** | OpenAI, Gemini, Mistral, OpenRouter, OpenAI-compatible. **No direct Anthropic** | 9 providers incl. direct Anthropic and Ollama, with API-level JSON enforcement and free-tier parity engineering | **Ours** | keep |
| **Offline** | None (planned) | Everything works with zero keys | **Ours** | keep |
| **Story analysis** | Review page: total word count, character distribution. No pacing/tension/arc charts | None | **Nobody's — take it** | **N11** |
| **Nudges** | None | Per-entity suggestion chips (pack expansions, relationship-web arcs, quest outcomes) | **Ours, half-built** → extend to story level | **N12** |
| **Word tracking** | Word counts only. **No streaks, no goals, no session stats, no charts** | `insights.ts`: today's baseline only | **Neither. Cheap win** | **N13** |
| **Navigation** | 4 modes (Plan/Write/Chat/Review), small and calm. **No command palette** | 29 rail items, no URL routing, no back | **Theirs on calm, ours on the palette** | **N2** |
| **Undo / audit** | Editor undo + revision history | 500-entry reversible audit log; one Undo reverts an entire generation or intelligence apply | **Ours** | keep |
| **Mobile** | Browser-only, "not optimised" | Every e2e spec runs desktop **and** mobile-chromium; new UI must pass both | **Ours** | keep |

### 1.2 The five mechanisms to copy exactly

1. **Per-entity AI-context policy: Always / Detected / Never — plus tracking controls.**
   Detection matches name + aliases with automatic plural handling, and two escape valves that
   solve the false-positive problem we also have (our `arbitrateTypes` fights the same battle):
   **case-sensitive matching** and a per-entity **exclusions list**. This is the whole
   difference between a codex that helps and a codex that poisons the prompt.

2. **Progressions — codex facts anchored to a point in the story.** An addition attached at
   scene 30 is invisible to the AI when you draft scene 12. This is the correct model of a
   novel and nobody else has it. **Our version is strictly better**, because extraction already
   knows the chapter every fact came from: we can *generate* progressions automatically from a
   Save & Extract, rather than asking the author to hand-author them.

3. **Scene summaries + `storySoFar()`.** The scalable answer to long-book context: summarise
   each scene (80/120/300 words), then feed the ordered summaries — optionally POV- or
   act-filtered — instead of raw prose. Cheap, and it is why novelcrafter holds continuity at
   150k words.

4. **Beats as document nodes, not a modal.** A beat lives in the prose, survives expansion,
   and can be re-rolled. Plus `[bracketed]` stage directions inline, and Apply / Retry /
   Discard / Section on every generation.

5. **One dataset, many views.** Grid, Matrix and Outline are three projections of the same
   scene rows. Add Board and Timeline and it covers Scrivener, Plottr and Notion at once.

### 1.3 What we must NOT copy

- The **freeform codex**. Our typed configs are worth more than the flexibility.
- The **"you maintain the codex by hand"** model — extraction is our reason to exist.
- **Cloud / accounts / collaboration.** Local-first is law.
- **Their onboarding.** See below.

### 1.4 Their friction is our advantage — design the redesign around this

Novelcrafter's own users name four complaints. Each is a place we already win, and the
redesign must make the win *visible*:

| Their complaint | Our answer, and where it must show |
|---|---|
| **#1: setup friction** — "create an account, choose a provider, go to their website, add a payment method, generate a key, copy it back" before *any* AI works | Everything works offline with zero keys. **The first-run experience must prove this in 30 seconds**: paste a chapter, press one button, watch the codex build itself. No key, no account. (N2 empty states + the existing `OnboardingWizard`) |
| **Codex is "powerful but a time sink"** — fully manual entry, "exhausting" | Extraction *is* the codex. The Matrix must render extraction-derived cells at 55% opacity so the author literally sees the app filling the grid in for them (N4) |
| **Learning curve "more akin to Photoshop"** | Five destinations, progressive disclosure, a command palette they don't have, and nudges that teach by doing (N2, N12) |
| **No analytics of any kind** | Story health charts and momentum are pure upside — an entire category they have conceded (N11, N13) |

---

## Part 2 — The Studio design system (N1)

### 2.1 The key architectural insight

`src/styles/tokens.css` already defines **semantic** tokens (`--bg-*`, `--ink-*`, `--line-*`,
`--accent-*`, `--shadow-*`), and both existing themes are nothing but redefinitions of that
set under a `[data-theme]` selector. **All 3,785 lines of `components.css` consume the
semantic layer, never raw colours.**

Therefore a complete visual overhaul is *a new theme block plus a token-scale revision* — not
a component rewrite. Add `studio-dark` and `studio-light`, revise the shared scales, and every
existing surface is redesigned for free. Structural work (N2–N4) is separate and additive.

**Fable: do not fork `components.css`. Do not introduce a second class prefix. Never delete a
token id** — `components.css` references them ~1,900 times. Re-point values, alias legacy
names, add new ones.

### 2.2 `tokens.css` — replace the shared scale block

```css
:root {
  /* Type stacks — ids unchanged so every existing rule keeps working.
     Studio leads with the sans; the serif is reserved for prose. */
  --font-display: "Inter Tight Variable", "Inter Tight", "Inter", system-ui, sans-serif;
  --font-serif:   "Source Serif 4 Variable", "Source Serif 4", Georgia, serif;
  --font-sans:    "Inter Tight Variable", "Inter Tight", "Inter", -apple-system, system-ui, sans-serif;
  --font-mono:    "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Menlo, monospace;

  /* Type sizes — ids preserved, values re-tuned to a 4px rhythm */
  --fs-3xs: 10px; --fs-2xs: 11px; --fs-xs: 12px; --fs-sm: 13px; --fs-md: 14px;
  --fs-lg: 16px;  --fs-xl: 20px;  --fs-2xl: 24px; --fs-3xl: 32px;
  --fs-4xl: 40px; --fs-5xl: 52px;

  --lh-tight: 1.25; --lh-snug: 1.4; --lh-normal: 1.5; --lh-prose: 1.7;
  --tr-eyebrow: 0.06em; --tr-tight: -0.01em; --tr-tighter: -0.02em;

  /* Weights — the "Linear look" lives in the intermediate variable weights */
  --fw-body: 400; --fw-med: 510; --fw-semi: 590; --fw-bold: 680;

  /* Spacing — 4px base. Legacy odd ids kept for back-compat; NEW rules use
     only 0/2/4/6/8/9/10/11/12/13/14/15. */
  --sp-0: 0px;  --sp-1: 2px;  --sp-2: 4px;  --sp-3: 6px;  --sp-4: 8px;
  --sp-5: 10px; --sp-6: 12px; --sp-7: 14px; --sp-8: 16px; --sp-9: 20px;
  --sp-10: 24px; --sp-11: 32px; --sp-12: 40px; --sp-13: 48px; --sp-14: 64px;
  --sp-15: 80px;

  /* Radii — nested rule: inner = outer − padding */
  --r-1: 3px; --r-2: 4px; --r-3: 6px; --r-4: 8px; --r-5: 10px; --r-6: 12px;
  --r-7: 16px; --r-pill: 999px;

  --density-row: 32px; --density-pad: 12px; --density-gap: 8px; --density-control: 32px;

  --topbar-h: 44px; --statusbar-h: 28px;
  --leftrail-w-collapsed: 56px; --leftrail-w-expanded: 232px;
  --rightrail-w: 48px;
  --panel-w-default: 340px; --panel-w-expanded: 520px;
  --measure: 34em;              /* prose line length ≈ 66ch — user-adjustable */

  /* Motion — an easing LANGUAGE: one curve per intent */
  --motion-instant: 90ms; --motion-fast: 140ms; --motion-base: 200ms; --motion-slow: 320ms;
  --ease-enter:  cubic-bezier(0, 0, 0.2, 1);        /* decelerate: appearing */
  --ease-exit:   cubic-bezier(0.4, 0, 1, 1);        /* accelerate: leaving   */
  --ease-move:   cubic-bezier(0.4, 0, 0.2, 1);      /* standard: reorder     */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* CELEBRATION ONLY      */
  --ease-out: var(--ease-enter);                    /* legacy aliases — keep */
  --ease-in-out: var(--ease-move);

  /* z-ladder — unchanged; it is already the single source of truth */
}
```

### 2.3 The Studio themes — append to `tokens.css`

OKLCH throughout: one neutral hue family (265) with a violet accent (300). Lightness follows
the Tailwind-v4 ladder so tints stay perceptually even.

```css
/* =====================================================================
   STUDIO-DARK — the new default. Deep neutral, one vivid accent.
   Elevation comes from surface lightness + a 1px top highlight, because
   shadows barely read on dark.
   ===================================================================== */
[data-theme="studio-dark"] {
  --bg-deep:    oklch(13.5% .008 265);
  --bg-app:     oklch(16.5% .008 265);
  --bg-paper:   oklch(19.5% .009 265);
  --bg-paper-2: oklch(22.5% .010 265);
  --bg-elev:    oklch(26.0% .011 265);
  --bg-sunken:  oklch(12.0% .007 265);
  --bg-tint:    oklch(72% .19 300 / .08);

  --ink-1: oklch(97% .004 265);
  --ink-2: oklch(84% .007 265);
  --ink-3: oklch(68% .009 265);
  --ink-4: oklch(55% .010 265);
  --ink-5: oklch(43% .010 265);
  --ink-on-accent: oklch(17% .02 300);

  --line-1: oklch(100% 0 0 / .06);
  --line-2: oklch(100% 0 0 / .10);
  --line-3: oklch(100% 0 0 / .16);
  --line-strong: oklch(100% 0 0 / .30);
  --line-highlight: oklch(100% 0 0 / .07);

  --accent:      oklch(72% .19 300);
  --accent-deep: oklch(80% .17 300);
  --accent-soft: oklch(72% .19 300 / .16);
  --accent-on:   oklch(17% .02 300);

  --focus-ring: 0 0 0 2px var(--bg-app), 0 0 0 4px var(--accent);

  --shadow-1: 0 1px 2px oklch(0% 0 0 / .40);
  --shadow-2: 0 2px 4px oklch(0% 0 0 / .36), 0 6px 16px -6px oklch(0% 0 0 / .44);
  --shadow-3: 0 4px 10px oklch(0% 0 0 / .40), 0 18px 40px -12px oklch(0% 0 0 / .52);
  --shadow-4: 0 6px 14px oklch(0% 0 0 / .44), 0 36px 80px -24px oklch(0% 0 0 / .62);
  --shadow-stamp: inset 0 1px 0 var(--line-highlight), inset 0 0 0 1px var(--line-1);

  --paper-grain: none;                    /* Studio is flat: no texture layer */
  --select-bg: oklch(72% .19 300 / .28);
  --select-fg: var(--ink-1);

  /* Semantic states — NEW ids, used by health charts, nudges, bands */
  --ok:   oklch(72% .16 155);
  --warn: oklch(78% .15 78);
  --risk: oklch(66% .19 25);
  --info: oklch(72% .14 235);
}

/* =====================================================================
   STUDIO-LIGHT — same system, inverted. A clean studio, not a parchment.
   ===================================================================== */
[data-theme="studio-light"] {
  --bg-deep:    oklch(95.5% .004 265);
  --bg-app:     oklch(98.0% .003 265);
  --bg-paper:   oklch(100%  0 0);
  --bg-paper-2: oklch(99.0% .002 265);
  --bg-elev:    oklch(100%  0 0);
  --bg-sunken:  oklch(96.5% .004 265);
  --bg-tint:    oklch(56% .19 300 / .06);

  --ink-1: oklch(22% .012 265);
  --ink-2: oklch(38% .012 265);
  --ink-3: oklch(52% .011 265);
  --ink-4: oklch(64% .010 265);
  --ink-5: oklch(76% .008 265);
  --ink-on-accent: oklch(99% .002 300);

  --line-1: oklch(22% .012 265 / .08);
  --line-2: oklch(22% .012 265 / .13);
  --line-3: oklch(22% .012 265 / .20);
  --line-strong: oklch(22% .012 265 / .42);
  --line-highlight: oklch(100% 0 0 / .80);

  --accent:      oklch(56% .19 300);
  --accent-deep: oklch(46% .18 300);
  --accent-soft: oklch(56% .19 300 / .12);
  --accent-on:   oklch(99% .002 300);

  --focus-ring: 0 0 0 2px var(--bg-app), 0 0 0 4px var(--accent);

  --shadow-1: 0 1px 2px oklch(22% .01 265 / .06), 0 1px 1px oklch(22% .01 265 / .04);
  --shadow-2: 0 2px 4px oklch(22% .01 265 / .06), 0 4px 8px oklch(22% .01 265 / .05);
  --shadow-3: 0 2px 4px oklch(22% .01 265 / .05), 0 8px 16px oklch(22% .01 265 / .06),
              0 16px 32px oklch(22% .01 265 / .05);
  --shadow-4: 0 4px 8px oklch(22% .01 265 / .05), 0 12px 24px oklch(22% .01 265 / .06),
              0 32px 56px oklch(22% .01 265 / .07);
  --shadow-stamp: inset 0 0 0 1px var(--line-1);

  --paper-grain: none;
  --select-bg: oklch(56% .19 300 / .18);
  --select-fg: var(--ink-1);

  --ok:   oklch(56% .15 155);
  --warn: oklch(62% .15 65);
  --risk: oklch(55% .21 25);
  --info: oklch(56% .15 235);
}
```

`src/stores/ui.ts`:

```ts
export type Theme = 'studio-dark' | 'studio-light' | 'parchment-light' | 'midnight-ink';
const DEFAULT_THEME: Theme = 'studio-dark';
```

`toggleTheme()` cycles within the active family (studio-dark ↔ studio-light; parchment ↔
midnight), with the four-way picker in Tweaks. A stored legacy value is left untouched — a
user who chose parchment keeps parchment.

### 2.4 Reduced motion — `base.css` + `src/lib/motion.ts`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
  /* Reduce ≠ remove: keep opacity transitions so state changes stay legible. */
  .lw-fade, [data-motion="fade"] { transition: opacity 120ms linear !important; }
}
```

```ts
// src/lib/motion.ts — NEW
/** True when the OS or the in-app Tweaks setting asks for less movement.
 * Every celebration, spring and confetti path must consult this. */
export function prefersReducedMotion(): boolean {
  const pref = document.documentElement.dataset.motionPref;
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

### 2.5 Tweaks panel — makes the dead tokens live

`data-density` (spacious/default/compact) and `data-typeset` (literary/archive/workhorse)
already exist in CSS with **no UI at all**. N1 ships a **Tweaks** section in Settings driving:
theme (4), density (3), typeset (3), prose measure (`--measure`, 28–44em), motion
(system/full/reduce), and focus granularity (line/sentence/paragraph — consumed in N5).
Persist to `db.uiState` under `${projectId}:tweaks`; apply as `data-*` on `<html>` in
`main.tsx` beside `data-theme`. A `SURFACE_CHECKLIST.md` row per control.

### 2.6 Conventions for all new UI

| Thing | Spec |
|---|---|
| List row | `--density-row` tall; padding `0 var(--sp-6)` |
| Card | `--r-4`, `var(--bg-paper-2)`, `1px solid var(--line-1)`, `var(--shadow-stamp)` |
| Modal / palette | `--r-6`, `var(--bg-elev)`, `var(--shadow-4)`, backdrop `oklch(0% 0 0 / .45)` + `blur(8px)` |
| Eyebrow | `--fs-2xs`, `--fw-semi`, uppercase, `--tr-eyebrow`, `var(--ink-4)` |
| Any number | `font-variant-numeric: tabular-nums` |
| Enter | `var(--motion-base) var(--ease-enter)`, opacity + `translateY(4px)` |
| Exit | `var(--motion-fast) var(--ease-exit)` |
| Celebration | `var(--motion-base) var(--ease-spring)` **and** gated on `prefersReducedMotion()` |
| Focus | `:focus-visible { box-shadow: var(--focus-ring) }` — never bare `outline: none` |
| Icons | 14 / 16 / 20 only |
| Colour | never the sole encoding — pair with a glyph or label |

---

## Part 3 — Five-destination IA (N2)

```
✎  Write      Writer's Room: scenes, beats, context rail, chat dock, notes.
▦  Plan       Outline · Board · Matrix · Timeline. One dataset, four views.
◈  Codex      16 entity types as a filter strip. Roster ‖ dossier ‖ suggestions.
◔  Insights   Story health, nudges, review queue, momentum, activity.
◇  Worlds     Atlas · Tangle · Skill Trees.
⌘K            Everything else: Random Tables, Speed Reader, Templates,
              Import & Extract, Settings, Trash, Help, every Create/Generate.
```

Nothing is deleted; nothing becomes unreachable. Tools move from a permanent rail slot to the
palette plus a **Tools** section in Settings — progressive disclosure's escape-hatch rule
(defer, never hide).

```ts
// src/stores/ui.ts
export type RouteId =
  | 'write' | 'plan' | 'codex' | 'insights' | 'worlds'
  // legacy ids stay valid; they resolve to a destination + sub-view
  | 'home' | 'today' | 'writers-room' | 'atlas' | 'tangle' | 'skill-trees'
  | 'review' | 'handoff' | 'settings' | 'trash'
  | 'random-tables' | 'speed-reader' | 'templates';

/** Every existing setRoute() call keeps working; the rail lights the
 * destination that owns the legacy route. */
export const ROUTE_ALIAS: Partial<Record<RouteId, { dest: RouteId; view?: string }>> = {
  'writers-room': { dest: 'write' },
  home:           { dest: 'insights', view: 'overview' },
  today:          { dest: 'insights', view: 'today' },
  review:         { dest: 'insights', view: 'review' },
  atlas:          { dest: 'worlds', view: 'atlas' },
  tangle:         { dest: 'worlds', view: 'tangle' },
  'skill-trees':  { dest: 'worlds', view: 'trees' },
};
```

`MainSurface` resolves the alias, then switches. `LeftRail.NAV_ENTRIES` shrinks to five; the
entity-type list becomes a horizontal filter strip inside `CodexSurface` (glyph + colour +
count, `--density-row` tall, scrollable — already the right shape for mobile). `MobileNav`
becomes exactly the five destinations, retiring the Browse/More sheets (keep the `openNav`
helper in `tests/e2e/helpers.ts`, simplify its body, so existing specs still compile).

**Command palette upgrade, same milestone.** Mode prefixes, and the shortcut always rendered
right-aligned on each row — that is how users learn the keyboard path without a tour.

| Prefix | Scope |
|---|---|
| *(none)* | recents first, then fuzzy over everything |
| `>` | commands |
| `@` | codex entities |
| `#` | scenes & chapters |
| `/` | AI actions, scoped to the selection when the editor has one |

Backspace at position 0 exits a mode. Row 40px, width 640px, top offset 15vh, paint < 50ms
(the minisearch index is already in memory).

**First-run empty states (the answer to novelcrafter's #1 complaint).** Every destination's
empty state offers exactly one action, and Write's is: *"Paste a chapter — we'll build the
codex for you. No AI key needed."* wired to the existing offline extraction path.

---

## Part 4 — Structure: Acts › Chapters › Scenes (N3)

The keystone. N4, N5, N8, N11 and N12 are impossible without it.

### 4.1 Dexie **version 9** — additive, `src/db/schema.ts`

```ts
this.version(9).stores({
  acts:   'id, projectId, [projectId+order]',
  scenes: 'id, projectId, chapterId, [projectId+order], [projectId+chapterId], [projectId+status], [projectId+pov]',
  sceneSnapshots: 'id, projectId, sceneId, [projectId+sceneId], [sceneId+createdAt]',
}).upgrade(async (tx) => {
  // Every existing chapter becomes exactly one scene carrying its doc.
  // The chapter keeps `doc` untouched for one release, so a rollback can
  // never lose text.
  const chapters = await tx.table('chapters').toArray();
  await tx.table('scenes').bulkAdd(chapters.map((c, i) => ({
    id: `sc_${c.id}`, projectId: c.projectId, chapterId: c.id,
    title: c.title, order: 0, globalOrder: i,
    doc: c.doc, paragraphs: c.paragraphs ?? [], wordCount: c.wordCount ?? 0,
    summary: '', summaryUpdatedAt: 0,
    status: (c.wordCount ?? 0) > 0 ? 'draft' : 'outline',
    pov: null, povType: null,
    characterIds: [], locationId: null, attachedRefs: [],
    labels: [], targetWords: null, aiVisible: true,
    createdAt: c.createdAt, updatedAt: c.updatedAt,
  })));
});
```

### 4.2 Types — `src/db/types.ts`

```ts
export type SceneStatus = 'outline' | 'draft' | 'revised' | 'final';

export interface Act {
  id: string; projectId: string; title: string; order: number;
  summary: string; colour?: string;
  createdAt: number; updatedAt: number;
}

export interface Scene {
  id: string; projectId: string; chapterId: string;
  title: string;
  order: number;          // within the chapter
  /** Order across the whole manuscript — the x-axis of every planning view.
   * Recomputed by resequenceScenes() after any structural change. */
  globalOrder: number;

  /** TipTap JSON — the source of truth, moved down from Chapter. */
  doc: unknown;
  /** Derived on save; the extraction substrate (same contract as Chapter). */
  paragraphs: { id: string; text: string }[];
  wordCount: number;

  /* --- planning metadata: the columns every view reads --- */
  /** The long-book memory unit. Fed to storySoFar() (N8). */
  summary: string;
  summaryUpdatedAt: number;
  status: SceneStatus;
  pov: string | null;                    // cast entity id
  povType: 'first' | 'third-limited' | 'third-omniscient' | 'second' | null;
  characterIds: string[];                // author-asserted presence
  locationId: string | null;
  /** Novelcrafter's "+ Codex": entries force-included in this scene's context. */
  attachedRefs: EntityRef[];
  labels: string[];                      // user-defined; the Matrix colour source
  targetWords: number | null;
  /** Novelcrafter's "is visible": exclude this scene from all AI context. */
  aiVisible: boolean;

  createdAt: number; updatedAt: number;
}

/** Prose version history — the thing we currently have none of. */
export interface SceneSnapshot {
  id: string; projectId: string; sceneId: string;
  doc: unknown; wordCount: number;
  label: string;
  reason: 'manual' | 'interval' | 'pre-ai' | 'pre-import';
  createdAt: number;
}
```

`Chapter` gains `actId: string | null` and keeps `doc` / `paragraphs` / `wordCount` as
**derived read-only rollups** recomputed by `chapterRollup(chapterId)` on scene save — so
extraction, search, world-bible export and the speed reader keep working untouched.

### 4.3 `src/db/repos/scenes.ts` — mirror `chapters.ts` (the reference for order + trash + audit)

```ts
export async function createScene(projectId: string, chapterId: string, after?: string): Promise<Scene>
export async function saveSceneDoc(sceneId: string, doc: unknown, paragraphs: {id:string;text:string}[]): Promise<void>
export async function updateSceneMeta(sceneId: string, patch: Partial<Scene>): Promise<void>
export async function moveScene(sceneId: string, toChapterId: string, toIndex: number): Promise<void>
export async function deleteSceneToTrash(sceneId: string): Promise<void>   // reuses trash.ts
export async function resequenceScenes(projectId: string): Promise<void>
export async function snapshotScene(sceneId: string, reason: SceneSnapshot['reason'], label?: string): Promise<void>
export async function restoreSnapshot(snapshotId: string): Promise<void>   // audited + reversible
```

**Snapshot policy** (novelcrafter's, improved): one `interval` snapshot per 3-minute window,
each overwriting the previous within that window; **always** snapshot before an AI insertion
(`pre-ai`) or an import (`pre-import`); keep the last 20 per scene plus one per calendar day.
This closes the scariest gap in the app today — overwriting a chapter is currently
unrecoverable.

### 4.4 Ripple — every place that says "chapter" today

| File | Change |
|---|---|
| `services/extraction/session.ts`, `chapter-awareness.ts` | Read scenes; `Occurrence.chapterId` stays (scenes roll up), gains `sceneId?: string` |
| `services/intelligence/engine.ts` | Accept `sceneId?` alongside `chapterId?`; grouping unchanged |
| `services/search.ts` | Index scenes, not chapters |
| `archive/project.ts` | Export/import `acts`, `scenes`, `sceneSnapshots`; bump to `loomwright-project-v3` and **accept v2** by running the same split on import |
| `archive/world-bible.ts` | Outline renders Act → Chapter → Scene |
| `services/manuscript-import.ts` | Split on `⁂` / `***` / `#` into scenes as well as chapters |
| `services/generate/apply.ts` | `BundleChapterDraft` writes a chapter + one scene, with each beat as a `sceneBeat` node — which finally makes G7 coherent |

---

## Part 5 — Plan: one dataset, four views (N4)

New surface `src/features/plan/`. All four views read the same `useLiveQuery` over `scenes` +
`acts` and write through `scenes.ts`. **No view owns state.**

```
src/features/plan/
  PlanSurface.tsx    view switcher + shared filter bar (act, POV, status, label, search)
  OutlineView.tsx    Act ▸ Chapter ▸ Scene tree; inline rename; drag to reorder;
                     per-level word counts; click → open in Write
  BoardView.tsx      Kanban. Columns = status by default, switchable to Act or POV.
                     Cards: title, summary, wordCount, POV chip, label dots.
                     Drag → updateSceneMeta / moveScene.
  MatrixView.tsx     THE grid (see below)
  TimelineView.tsx   reuse features/codex/TimelineView.tsx; overlay scenes on the
                     existing timeline entity track
  usePlanData.ts     the single shared query + derived indexes
```

**Matrix.** Rows = scenes in `globalOrder`. Columns = a switchable **Show** axis: POV ·
Labels · Status · any codex type (cast / locations / factions / quests). Sticky header and
sticky first column; arrow-key cell navigation; `Show → POV` lets you change a scene's POV
with one click, exactly as novelcrafter does.

A cell is filled when **any** of three things is true — and *which* one is visible:

| Source | Render |
|---|---|
| Author asserted it (`characterIds` / `locationId` / `labels` / `attachedRefs`) | solid entity colour |
| It appears in the scene **summary** | solid, hairline underline |
| **Extraction recorded an `Occurrence`** in that scene | **55% opacity + hairline** — click to promote to author-asserted |

That third row is the differentiator. Novelcrafter's Matrix shows what *you* typed;
**ours shows what the engine found, and lets you accept it with a click.** No competitor can
do this, because no competitor extracts.

Mobile: Outline and Board are the phone views; Matrix collapses to one expandable card per
scene. E2E must pass on both projects.

---

## Part 6 — The authoring loop

### 6.1 N5 — Scene beats, inline AI, sections, focus mode

**Beats are a TipTap node, not a panel.** `src/features/writers-room/scene-beat.ts`:

```ts
import { Node, mergeAttributes } from '@tiptap/core';

/** A beat is an instruction that lives in the prose. It survives expansion:
 * generated paragraphs are inserted AFTER the node and the node collapses to a
 * thin, re-expandable header, so a beat can always be re-rolled. */
export const SceneBeat = Node.create({
  name: 'sceneBeat',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes: () => ({
    beatId: { default: null },
    mode:   { default: 'prose' },   // prose | dialogue | description | action | transition
    words:  { default: 400 },
    state:  { default: 'pending' }, // pending | expanding | expanded
    expandedParagraphIds: { default: [] as string[] },
  }),
  parseHTML: () => [{ tag: 'div[data-scene-beat]' }],
  renderHTML: ({ HTMLAttributes }) =>
    ['div', mergeAttributes(HTMLAttributes, { 'data-scene-beat': '', class: 'lw-beat' }), 0],
  addInputRules() { /* `/beat ` at the start of an empty paragraph converts it */ },
  addKeyboardShortcuts() {
    return {
      'Mod-Enter':    () => this.editor.commands.expandBeatAtCursor(),
      'Mod-Shift-b':  () => this.editor.commands.insertSceneBeat(),
    };
  },
});
```

Post-generation controls mirror novelcrafter's four: **Apply · Retry · Discard · As section**.
`[bracketed]` text inside a beat or the prose is passed through as stage direction and
explicitly labelled as such in the prompt.

```ts
// src/services/ai/prompts/beat.ts — NEW, built on the existing prompts/prose.ts
export function buildBeatPrompt(input: {
  beat: string;
  mode: BeatMode;
  targetWords: number;
  scene: Scene;
  context: SceneContext;        // N7
  storySoFar: string;           // N8
  style: StyleProfile | null;   // services/style-analysis.ts
  precedingProse: string;       // last ~600 words before the beat
}): { system: string; prompt: string }
```

`expandBeat()`: `snapshotScene(sceneId, 'pre-ai')` → `complete(config, …)` →
`checkDraftAgainstCanon(draft, world)` (already exists in `services/ai/canon.ts`) → insert
paragraphs after the node → `state: 'expanded'`. Canon issues render as inline chips under
the prose, reusing `lw-compose__issue--*`.

**Offline path (mandatory):** with no key, Expand copies a fully-formed prompt and opens a
paste box — the same round-trip as `PasteTab`. A beat is never a dead button.

**Inline text replacement** (their feature, ≥4 words selected): **Expand · Rephrase ·
Shorten**, each with a tweak panel (word target; for Rephrase: change POV, change tense,
convert to dialogue). Implemented as a selection bubble menu that routes through the prompt
library (N10) so the actions are user-editable from day one.

**Sections** — a `section` TipTap node: colourable, with `hiddenFromAi` and
`hiddenFromWordCount` flags. `/note` inserts a yellow section with both flags on. Both flags
are honoured by `buildSceneContext()` and by the word-count derivation.

**Focus mode** — chrome fades to `opacity: 0` after 3s of sustained typing (restored on
`mousemove`/`Escape`); sentence/line/paragraph dimming per the Tweaks setting; typewriter
scrolling pinning the caret at 45% viewport height. All three gated on
`prefersReducedMotion()`.

`ComposePanel` stays for whole-scene drafting; its brief builder becomes shared code with
`buildBeatPrompt`.

### 6.2 N6 — Typed `@` mentions

A ProseMirror suggestion plugin built on `@tiptap/pm` (**already a dependency — no new runtime
dep**). Trigger `@` → inline popup over the minisearch index → select → insert a `mention`
mark carrying `entityId`/`entityType`, and immediately write an `Occurrence` with
`source: 'typed'`. Clicking a mention opens a preview card (theirs) as well as the dossier
(ours).

This makes typed and extracted mentions the *same substrate*: the Matrix, the context engine,
character-recency analysis and the highlight decorations all read `occurrences`.
`MentionHighlights` keeps rendering extraction-derived hits at lower emphasis; typed ones
render solid. Add `Occurrence.source?: 'extraction' | 'typed'`.

### 6.3 N7 — The Context Engine (the thing novelcrafter is genuinely best at)

Three parts: a **per-entity policy**, **tracking controls**, and an **assembler the author can
see**.

**(a) Per-entity policy.** Every entity gains, in `Entity.fields` (untyped bag — no schema
version needed) a reserved `__ai` block, and the editor drawer gains an **AI** section:

```ts
export interface EntityAiPolicy {
  context: 'always' | 'detected' | 'never';   // default 'detected'
  caseSensitive: boolean;                     // kills "Red"/"Will"/"May" false positives
  exclusions: string[];                       // e.g. ["don't"] for a character named Don
  /** Field ids never sent to a model — their "Notes/Research" idea, per-field.
   * Default-populate with appearance-ish fields, because models latch onto
   * vivid physical details and repeat them. */
  hiddenFieldIds: string[];
}
```

**(b) Tracking controls** feed straight into `services/extraction/known-index.ts` —
`findKnownEntityMention` learns `caseSensitive` and `exclusions`, which improves *extraction
accuracy* at the same time. One control, two wins.

**(c) The assembler** — new `src/services/context/`:

```ts
// scene-context.ts
export interface ContextItem {
  ref: EntityRef;
  lane: 'always' | 'detected' | 'excluded';
  reason: string;      // "POV character", "named in this scene", "attached to scene", "pinned"
  tokens: number;
  digest: string;      // the text actually sent, minus hiddenFieldIds
  score: number;
}
export interface SceneContext {
  items: ContextItem[];
  budget: number;                    // TIER_BUDGET from services/ai/prompts/index.ts
  used: number;
  droppedForBudget: EntityRef[];
  text: string;                      // the assembled block
}

/** Assemble what the AI will be told about this scene, and why. Deterministic
 * and offline. `always` = policy:'always' + POV + scene.attachedRefs + focus lock.
 * `detected` = name/alias matches in the scene text using the SAME matcher
 * extraction uses, ranked by (mentions × recency-in-scene × type weight) and
 * truncated to fit the budget. Scenes with aiVisible:false and sections with
 * hiddenFromAi are excluded from the scan and the payload. */
export async function buildSceneContext(
  projectId: string,
  scene: Scene,
  opts?: { depth?: 'lean' | 'standard' | 'full'; pinned?: EntityRef[] },
): Promise<SceneContext>
```

Reuse, do not rewrite: `extraction/known-index.ts` (matching),
`intelligence/digest.ts` (per-entity digests + depth handling),
`ai/prompts/index.ts` `TIER_BUDGET` (budget).

**UI — `src/features/writers-room/ContextRail.tsx`.** A collapsible rail in Write showing the
three lanes as chip groups, a live budget bar (`used / budget`, tinted `--ok`/`--warn`/
`--risk`), drag a chip between lanes, click a chip to read its exact digest, and a **Preview**
disclosure rendering the fully assembled prompt (their Preview tab — but always visible, and
with a budget bar they do not have).

This is the most trust-building screen in the app: *the author can see exactly what the model
is told.* `ComposePanel`, `AiTab`, beats and chat all switch to `buildSceneContext()`.
`focusStore` remains the cross-surface selection mechanism and becomes one `always` input.

### 6.4 N8 — Progressions and story memory

Two mechanisms, one milestone, because they are both "what did the AI know, and when".

**Progressions.** Dexie **version 10**:

```ts
this.version(10).stores({
  progressions: 'id, projectId, entityId, [projectId+entityId], [projectId+globalOrder]',
});
```

```ts
export interface Progression {
  id: string; projectId: string; entityId: string;
  /** Anchored to a point in the manuscript; invisible to any scene before it. */
  sceneId: string; globalOrder: number;
  mode: 'addition' | 'replacement';
  /** For 'replacement', which field it overrides; null = free prose addendum. */
  fieldId: string | null;
  text: string;
  /** 'extracted' rows were generated by Save & Extract and can be reviewed. */
  source: 'manual' | 'extracted' | 'ai';
  confidence: number;
  createdAt: number;
}

/** The entity as it was true at this point in the story. Additions layer on;
 * replacements override; anything anchored later is invisible. */
export function entityAtScene(entity: Entity, progs: Progression[], globalOrder: number): Entity
```

`buildSceneContext()` calls `entityAtScene()` for every item, so drafting chapter 12 can never
leak chapter 40's facts. Authoring: `/progress` in the editor picks an entity and writes a
progression anchored at the caret's scene (their `/` and `>>` affordances).

**Our multiplier:** `intelligence/rules.ts` already knows *which chapter* every propagated fact
came from. Extend `applyDelta` so that a field patch also writes a `Progression` with
`source: 'extracted'` at the originating scene. **A Save & Extract now builds the story's
timeline of truth automatically** — the feature novelcrafter asks its users to hand-author,
generated as a side effect of writing. This is the single strongest idea in this plan.

**Story memory.** Scene summaries (already on the `Scene` row from N3) plus:

```ts
// src/services/context/story-so-far.ts
/** Ordered prior-scene summaries — the scalable answer to long-book context.
 * Optionally filtered to one POV or one act, and truncated to the tier budget
 * newest-first (recent context matters more than the opening). */
export function storySoFar(scenes: Scene[], upTo: number, opts?: {
  pov?: string; actId?: string; budgetChars?: number;
}): string
export function storyToCome(scenes: Scene[], from: number, opts?: {...}): string
```

`summarizeScene(sceneId, length: 80 | 120 | 300)` calls `complete()` with a summary prompt
from the library. **Offline fallback (mandatory and genuinely good):** an extractive
summariser built from what we already have — the scene's top-ranked `Occurrence` entities plus
its highest-signal sentences (reuse `services/extraction/quality.ts` scoring). Never a dead
button, never a required key.

A scene whose prose changed after `summaryUpdatedAt` shows a "summary is stale" chip — a
deterministic nudge (N12), not a toast.

### 6.5 N9 — Chat

Dexie **version 11**:

```ts
this.version(11).stores({
  chatThreads:  'id, projectId, [projectId+updatedAt], sceneId',
  chatMessages: 'id, threadId, [threadId+createdAt]',
});
```

```ts
export type ChatMode = 'brainstorm' | 'ask-the-codex' | 'editor' | 'continuity' | 'free';
export interface ChatThread {
  id: string; projectId: string; sceneId: string | null;
  title: string; mode: ChatMode;
  pinnedRefs: EntityRef[];
  /** Their "knowledge cutoff": how many prior message pairs travel. */
  memoryPairs: number;                     // default 14
  createdAt: number; updatedAt: number;
}
export interface ChatMessage {
  id: string; threadId: string; role: 'user' | 'assistant';
  text: string;
  contextSummary?: string;                 // what was sent — auditability
  createdAt: number;
}
```

`src/features/chat/ChatDock.tsx` — a right-dock panel using the existing `PanelDock` z-layer
and width tokens. Each mode is a system prompt in `services/ai/prompts/chat.ts` (and therefore
user-editable from N10). Context comes from N7 and renders as removable chips above the
composer, with the same `+ Context` breadth they offer (whole novel / outline / act / chapter
/ scenes / codex by type or tag).

Every assistant message gets **Insert into scene** (snapshot-then-insert) and **Send to
codex** — which routes the text through `parseDeltaReply`, so a chat answer becomes *verified,
propagated, undoable data*. Novelcrafter's Extract proposes entries; ours runs the same
offline rules that guard every other input, so a model cannot make the app write anything the
engine would not have written on its own.

Offline: chat is disabled behind an honest empty state offering "Copy this conversation as a
prompt". Never a dead control.

### 6.6 N10 — Prompt library

Dexie **version 12**: `promptTemplates: 'id, projectId, [projectId+kind], builtin'`.

```ts
export interface PromptTemplate {
  id: string; projectId: string | null;        // null = builtin/global
  name: string;
  kind: 'beat' | 'chat' | 'compose' | 'rewrite' | 'summarize' | 'extract' | 'generate';
  system: string; body: string;                // {{variables}} and {function()} calls
  inputs: PromptInput[];                       // rendered before sending
  models: string[];                            // their "model bank"
  defaultModel?: string; temperature?: number; maxTokens?: number;
  builtin: 0 | 1;                              // builtins are copy-on-write
  createdAt: number; updatedAt: number;
}
export interface PromptInput {
  name: string; label: string;
  kind: 'text' | 'textarea' | 'dropdown' | 'number' | 'context';
  options?: string[]; default?: string;
}
```

Resolver in `src/services/prompts/resolve.ts` — case-insensitive, non-chaining, C-style, the
same shape as theirs so their community prompts are portable:

```
{scene.title} {scene.summary} {scene.labels} {selection} {precedingProse}
{beat} {targetWords} {style} {context}
{storySoFar()} {storySoFar(pov)} {storyToCome()}
{codex.all} {codex.cast()} {codex.locations()} {codex.get("Vex")} {withRelations(x)}
{input("genre")} {local()}
```

Seed the library by **exporting the existing hardcoded prompts** from
`services/ai/prompts/{prose,extraction,delta}.ts` as builtins, so it ships full rather than
empty and editing one is a fork rather than a blank page. Surface: Settings ▸ Prompts (list,
edit, duplicate, reset-to-builtin, **test-run against the current scene showing the fully
resolved text**), plus clipboard import/export so prompts are shareable exactly as theirs are.
Every AI entry point gains a small prompt picker.

---

## Part 7 — Our edge: story health and gentle nudges

### 7.1 N11 — Story health (offline, deterministic, live)

New `src/services/health/`. Every analyzer is pure, synchronous and DB-free (takes scenes +
occurrences + entities + progressions), so it unit-tests with fixtures exactly like
`extraction/engine.ts`.

```ts
// src/services/health/types.ts
export interface HealthInput {
  scenes: Scene[]; acts: Act[]; chapters: Chapter[];
  occurrences: Occurrence[]; entities: Entity[];
}
export interface SeriesPoint { sceneId: string; label: string; value: number; x: number }
export interface HealthReport {
  pacing:      SeriesPoint[];   // words per scene
  tension:     SeriesPoint[];   // 1..10, offline heuristic; AI may refine
  povBalance:  { entityId: string; name: string; scenes: number; words: number; pct: number }[];
  screenTime:  { entityId: string; name: string; scenes: number; pct: number;
                 lastSceneIndex: number; gapScenes: number }[];
  locationSpread: { entityId: string; name: string; scenes: number }[];
  arc:         { point: ArcPoint; expectedPct: number; actualPct: number | null; sceneId: string | null }[];
  threads:     { entityId: string; name: string; kind: 'quest' | 'relationship' | 'lore';
                 openedSceneIndex: number; lastTouchedIndex: number; resolved: boolean }[];
  totals:      { scenes: number; words: number; avgSceneWords: number; medianSceneWords: number };
}
export type ArcPoint = 'inciting' | 'plot-point-1' | 'midpoint' | 'plot-point-2' | 'climax';
export const ARC_EXPECTED: Record<ArcPoint, number> = {
  inciting: 0.12, 'plot-point-1': 0.25, midpoint: 0.50, 'plot-point-2': 0.75, climax: 0.90,
};
```

Offline tension heuristic — no key, no cost, built from signals the codebase already produces:

```ts
// src/services/health/tension.ts
/** A deterministic proxy for scene intensity. Not a substitute for a reader's
 * judgement — a shape to look at. Every term derives from data we already hold,
 * so it costs nothing and works in a project with no AI key. */
export function tensionScore(scene: Scene, occ: Occurrence[], ents: Map<string, Entity>): number {
  const text = scene.paragraphs.map((p) => p.text).join(' ');
  const words = Math.max(1, scene.wordCount);
  const dialogueRatio  = (text.match(/[“"']/g)?.length ?? 0) / words * 100;
  const shortSentences = ratioOfSentencesUnder(text, 8);          // clipped = urgent
  const conflictVerbs  = countLexicon(text, CONFLICT_VERBS) / words * 1000;
  const stakesNouns    = countLexicon(text, STAKES_NOUNS)  / words * 1000;
  const questTouches   = occ.filter((o) => ents.get(o.entityId ?? '')?.type === 'quests').length;
  const castDensity    = new Set(occ.filter((o) => ents.get(o.entityId ?? '')?.type === 'cast')
                                    .map((o) => o.entityId)).size;
  return clamp1to10(
    2.0 +
    1.6 * norm(conflictVerbs,  0,   14) +
    1.4 * norm(stakesNouns,    0,   10) +
    1.2 * norm(shortSentences, 0.1, 0.5) +
    0.9 * norm(dialogueRatio,  0,   12) +
    0.7 * norm(questTouches,   0,    6) +
    0.6 * norm(castDensity,    1,    5)
  );
}
```

With a key, an optional **Refine with AI** re-scores tension in one batched call and stores
`tensionAi?: number` on the scene. Offline stays the default; the chart states its source.

**Surface — `src/features/insights/`**, absorbing `HomePage`, `TodaySurface` and
`ReviewSurface` as sub-views:

```
InsightsSurface.tsx  sub-nav: Overview · Story health · Nudges · Review · Activity
HealthCharts.tsx     pure-SVG, no library (zero-new-deps):
                       · Pacing      bar per scene, height = words, tint = status
                       · Tension     line + area, arc points marked at expected %
                       · POV balance stacked bar, one segment per POV character
                       · Screen time horizontal bars + a "last seen" gap column
                       · Locations   dot strip
                     EVERY bar/point is a button → open that scene in Write.
                     Each chart has a "View as data" disclosure rendering a real
                     <table> — charts are pure-visual information and need the
                     non-visual fallback.
MomentumPanel.tsx    N13
```

Charts follow the house dataviz rules: tabular numerals on axes, colour never the only
encoding, `--ok`/`--warn`/`--risk` for state (never a rainbow), opacity-only entry animation
under reduced motion, `aria-label` per series.

### 7.2 N12 — The nudge inbox

**Architecture decision: nudges are a *pull* surface — a badged inbox, never toasts.** The
failure mode of a story-health feature is nagging a novelist about their own novel, and the
motivation literature is unambiguous that controlling, unsolicited prompts on an intrinsically
motivated activity reduce the activity.

Dexie **version 13**:

```ts
this.version(13).stores({
  nudges: 'id, projectId, [projectId+status], [projectId+kind], [projectId+createdAt], anchorId',
});
```

```ts
export type NudgeKind =
  | 'character-absent'    // "Ruth last appeared 11 scenes ago"
  | 'pov-imbalance'       // "82% of scenes are Vex's POV"
  | 'thread-dangling'     // an open quest/relationship untouched for N scenes
  | 'arc-drift'           // midpoint sits at 63%, expected 50%
  | 'pacing-flat'         // 6 consecutive scenes within ±8% word count
  | 'scene-thin'          // no summary, no POV, or no tension change
  | 'summary-stale'       // prose changed after the summary was written (N8)
  | 'codex-stale'         // 12 mentions, summary still empty
  | 'continuity-flag'     // an unresolved conflict from an intelligence apply
  | 'promise-unpaid';     // lore/quest introduced early, never resolved

export interface Nudge {
  id: string; projectId: string;
  kind: NudgeKind;
  severity: 'info' | 'suggest' | 'warn';
  title: string;      // "Ruth has been off-page for 11 scenes"
  detail: string;     // one concrete sentence
  why: string;        // the rule that fired, in plain words — powers "why am I seeing this"
  anchorId: string | null;
  anchorKind: 'scene' | 'entity' | 'story';
  /** Concrete and ready-to-accept — the house style for every suggestion. */
  action?: { label: string;
             kind: 'open-scene' | 'open-entity' | 'stage-delta' | 'insert-beat';
             payload: unknown };
  status: 'pending' | 'snoozed' | 'dismissed' | 'done';
  snoozedUntilSceneCount?: number;   // "after 5 more scenes" beats a date
  mutedKind?: boolean;
  source: 'local' | 'ai';
  createdAt: number;
}
```

Rules live in `src/services/health/nudges.ts` as a flat registry of pure functions each
returning `Nudge[]` — copy the shape of `intelligence/rules.ts`. Golden fixtures per rule,
mirroring `tests/fixtures/extraction/`.

**Discipline, enforced in code and not by convention:**

- Computed **on session start and on explicit "Analyse"** only — never on keystroke. A
  suggestion that appears mid-sentence is an interruption however pretty it is.
- **Cap 5 pending per session**, ranked by severity × staleness; the rest queue silently.
- **Three dismissal tiers on every row:** *Dismiss* · *Snooze* (until N more scenes) · *Never
  show this kind* (writes `mutedKind`, listed and reversible in Settings).
- **"Why am I seeing this?"** `ⓘ` on every row, rendering `why` verbatim in a popover.
- Deterministic nudges (counts, gaps, ratios) render as neutral chips; AI-sourced ones carry
  an explicit "suggestion" affordance and 👍/👎.
- Rail badge is a **6px dot**, not a number, unless every pending item is individually
  actionable.
- The existing per-entity `SuggestionChips.tsx` stays; nudges are the story-level lane.

### 7.3 N13 — Momentum (informational, never punitive)

Dexie **version 14**: `writingSessions: 'id, projectId, [projectId+day], startedAt'`.

```ts
export interface WritingSession {
  id: string; projectId: string;
  day: string;                    // 'YYYY-MM-DD' — reuse insights.ts todayKey()
  startedAt: number; endedAt: number;
  wordsAdded: number; wordsDeleted: number;
  scenesTouched: string[]; scenesCompleted: string[];
}
```

Constraints, taken directly from the overjustification and streak-creep evidence:

- **Celebrate artefacts, not compliance.** A 200ms spring + colour fill when a scene reaches
  `final` or an arc thread resolves. Nothing fires for "you wrote today".
- **No resettable streak counter.** Show **"12 of the last 14 days"** — a rolling ratio cannot
  be broken, so it cannot trigger the abstinence-violation quit that kills streak users.
- **Never notify on a missed day.** There is no notification path for absence at all.
- Progress rings encode **remaining work** (scenes unwritten toward a target), not habit.
- The daily bar chart is informational: hover shows the number, no colour judgement.
- **Max one large celebration per session**; everything else is a 150ms tick. All gated on
  `prefersReducedMotion()`.

---

## Part 8 — Finish the existing debt (N14)

From `docs/HANDOFF.md` §5, now unblocked and in places simplified by N3–N5:

1. **G6 surface UI** — `RelationshipGraph.tsx` ghost edges; `TangleSurface.tsx` staged overlay
   (mirror `SkillTreesSurface.tsx`, the reference implementation); "✨ Generate relationships"
   in the roster alt-view header; Paste-tab context checkboxes.
2. **G7 → scene generation** — `case 'scene'` in `generateRandomBundle`, `parseScenePayload`
   in `wire.ts`, "✨ Generate scene…" in Write. `BundleChapterDraft.beats` finally has a
   consumer: each beat becomes a `sceneBeat` node ready to expand (N5).
3. **G8 polish** — Dexie v15 `generations` history + re-stage/copy-seed, drawer field locks,
   save-accepted-bundle-as-template, duplicate-guard badges on ghost cards.
4. **Review-lane merge** (HANDOFF §12 "Still open") — make the flat queue the "everything
   else" lane beneath the cascade board rather than a parallel view.
5. **Unify extraction field guidance** — `buildExtractionPrompt` should derive from
   `promptFieldLines(type)` as the generation prompts already do.

---

## Part 9 — The autonomous hourly agent

You chose an **in-session hourly cron**. Its real limits, and the design that survives them:
it fires only while this session is alive and idle, recurring jobs auto-expire after 7 days,
and if the container is reclaimed the schedule dies with it. **Mitigation: all state lives in
the repo, never in the session**, so a new session — or a human — resumes mid-milestone by
reading two files. (If you later want unattended completion across days, the same two files
drive a GitHub Actions schedule with no change to the runbook.)

### 9.1 The ledger — `docs/AGENT_QUEUE.md` (new, committed)

Read first, rewritten last, every run.

```markdown
# Agent queue

**Current:** N1 · step 4 of 6
**Last verified green:** 2026-08-11T14:07Z (lint ✅ tsc ✅ build ✅ vitest 215 ✅ e2e 140/10/0 ✅)
**Blocked:** —

| # | Milestone | Steps | State |
|---|---|---|---|
| N1 | Studio design system | 6 | 🔄 3/6 |
| N2 | Five-destination shell | 5 | ⬜ |
| N3 | Acts › Chapters › Scenes | 8 | ⬜ |
| …  | | | |

## N1 — steps
- [x] 1. Token scale revision in `tokens.css`
- [x] 2. `studio-dark` + `studio-light` theme blocks
- [x] 3. `Theme` union + default + toggle cycle in `stores/ui.ts`
- [ ] 4. `lib/motion.ts` + reduced-motion block in `base.css`   ← IN PROGRESS
- [ ] 5. Tweaks panel in Settings (theme/density/typeset/measure/motion/focus)
- [ ] 6. SURFACE_CHECKLIST rows + e2e `19-studio.spec.ts`

## Notes for the next run
Step 4 half-done: `motion.ts` written, `base.css` block not yet added.
`data-motion-pref` must be applied in `main.tsx` alongside `data-theme`.
```

### 9.2 The runbook — `docs/AGENT_RUNBOOK.md` (new, committed)

1. **Read first:** `docs/AGENT_QUEUE.md`, then this plan's milestone section, then
   `CLAUDE.md` and `docs/rebuild/ARCHITECTURE.md`.
2. **Resume, don't restart.** Work the step marked IN PROGRESS. Never start a new milestone
   while any step of the current one is unchecked.
3. **Definition of done for a step** — in this order:
   `npm run lint` · `npx tsc --noEmit` · `npm run build` (catches the `noUnusedLocals` that
   `--noEmit` misses) · `npx vitest run` · and for any UI step,
   `CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test` on **both** projects.
4. **Definition of done for a milestone:** every step checked, a `SURFACE_CHECKLIST.md` row
   per new control naming the spec that proves it, and full e2e green on desktop and mobile.
5. **Always commit and push** to `claude/novelcrafter-analysis-ui-redesign-5b8jva` before the
   run ends — even mid-step — with the ledger updated to say exactly where you stopped. A run
   that ends without a push has lost its work.
6. **If blocked:** write it into the ledger's `**Blocked:**` line, move to the next
   *independent* milestone, and never skip silently.
7. **Never** push elsewhere, never open a PR unless asked, never add a runtime dependency,
   never leave a rendered control that does not work.

### 9.3 The cron

```
CronCreate({
  cron: "23 * * * *",
  recurring: true,
  prompt: "Continue the Loomwright build. Read docs/AGENT_QUEUE.md and
docs/AGENT_RUNBOOK.md in /home/user/Loomwright-V2 first, then resume the step
marked IN PROGRESS — do not start a new milestone while the current one has
unchecked steps. Run the full verify gate (lint, tsc --noEmit, build, vitest,
and playwright on both projects if UI changed) before checking a step off.
Update the ledger and commit + push to
claude/novelcrafter-analysis-ui-redesign-5b8jva before you finish, even if the
step is incomplete."
})
```

**Set-up order on approval:** write and commit the ledger and runbook **first**, then create
the cron. A cron that fires before the ledger exists will improvise.

---

## Milestone order

| # | Milestone | Depends on | Why here |
|---|---|---|---|
| **N1** | Studio design system | — | Every later surface gets built in the new language once, not twice |
| **N2** | Five destinations + palette modes + empty states | N1 | New surfaces need somewhere to live |
| **N3** | Acts › Chapters › Scenes + snapshots | N2 | The keystone; N4/N5/N8/N11/N12 all block on it |
| **N4** | Plan: Outline / Board / Matrix / Timeline | N3 | Highest visible payoff per line of code |
| **N5** | Beats, inline AI, sections, focus mode | N3 | The authoring loop |
| **N6** | Typed `@` mentions | N3 | Feeds N7 and N11 |
| **N7** | Context engine + policy + tracking + budget rail | N6 | The trust surface; every AI path routes through it |
| **N8** | Progressions + scene summaries / `storySoFar` | N7 | Our strongest differentiator (auto-generated progressions) |
| **N9** | Chat dock | N8 | |
| **N10** | Prompt library | N7 | |
| **N11** | Story health charts | N3, N6 | |
| **N12** | Nudge inbox | N11 | |
| **N13** | Momentum | N3 | |
| **N14** | G6/G7/G8 + review-lane merge | N3, N5 | G7 only becomes coherent once scenes and beats exist |

---

## Verification

**Per step** (the gate the cron enforces):

```bash
npm run lint
npx tsc --noEmit
npm run build                       # catches noUnusedLocals / noUnusedParameters
npx vitest run
CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test   # both projects, if UI changed
```

**New coverage each milestone must add:**

| # | Unit | E2E |
|---|---|---|
| N1 | `ui-store.spec.ts`: theme union, default, cycle | `19-studio.spec.ts`: all four themes, density, typeset, measure — `data-*` persists across reload |
| N2 | route-alias resolution table | `20-shell.spec.ts`: five destinations on desktop **and** mobile; every legacy route id still lands; palette modes `>` `@` `#` `/` |
| N3 | `scenes-repo.spec.ts`: create/move/resequence/snapshot/restore + **the v8→v9 migration on a seeded DB** | `21-scenes.spec.ts`: split a chapter, reorder, edit metadata, reload, restore a snapshot |
| N4 | `plan-data.spec.ts`: derived indexes | `22-plan.spec.ts`: four views over one scene; Board drag changes status; Matrix cell promotes an extraction-derived hit; mobile fallbacks |
| N5 | `beat-prompt.spec.ts`; section flags honoured by word count | `23-beats.spec.ts`: insert beat, expand with a **mocked** provider, prose lands, `pre-ai` snapshot exists, offline path copies a prompt; rewrite bubble needs ≥4 words |
| N6 | mention plugin unit | `24-mentions.spec.ts`: type `@`, pick, occurrence written, highlight renders |
| N7 | `scene-context.spec.ts`: lanes, ranking, budget truncation, `caseSensitive`/`exclusions`, `hiddenFieldIds`, `aiVisible:false` | `25-context.spec.ts`: rail shows lanes; dragging a chip changes what the mocked call receives |
| N8 | `progressions.spec.ts`: `entityAtScene` layering + **a scene before the anchor cannot see it**; `story-so-far.spec.ts` budget truncation; offline summariser | `26-progressions.spec.ts`: Save & Extract writes an extracted progression; drafting an earlier scene excludes it |
| N9 | chat repo | `27-chat.spec.ts`: thread, mocked reply, Insert into scene, Send to codex stages a delta |
| N10 | resolver: every function + input substitution | `28-prompts.spec.ts`: edit a builtin, test-run shows resolved text, clipboard round-trip |
| N11 | `health.spec.ts` + **golden fixtures** per analyzer | `29-health.spec.ts`: charts render, clicking a bar opens the scene, "View as data" table present |
| N12 | `nudges.spec.ts` + a golden fixture per rule | `30-nudges.spec.ts`: inbox, dismiss/snooze/mute, "why am I seeing this", cap of 5 |
| N13 | session rollup maths | `31-momentum.spec.ts`: rolling ratio, no streak reset, reduced-motion path |
| N14 | existing generate specs extended | `16-generate.spec.ts` extended per HANDOFF §5 |

**Manual hero flow** (run after N8, and again after N12):

`npm run dev` → sample project → **Plan ▸ Matrix**: extraction-derived cells render at 55%;
click three to promote them → **Write**: open a scene, check the **Context rail** (Vex in
*always* as POV, Marrow in *detected*, budget bar green), type `/beat ` "Vex confronts Marrow
about the blade", ⌘↵ → prose lands, canon check flags the ownership contradiction → **Save &
Extract** → cascade board shows the transfer **and a new progression anchored to this scene**
→ Accept → open an earlier scene and confirm the progression is *not* in its context →
**Insights ▸ Story health**: tension spikes at that scene, Ruth's screen-time gap reads 11 →
**Nudges**: "Ruth has been off-page for 11 scenes", ⓘ explains the rule, Snooze for 5 scenes.

**Docs to update every milestone:** `docs/rebuild/SURFACE_CHECKLIST.md` (a row per control),
`docs/AGENT_QUEUE.md` (state), and `docs/HANDOFF.md` (a section per shipped family, matching
the existing §11/§12 style).

---

## Files at a glance

**New:** `src/features/plan/*` · `src/features/insights/*` · `src/features/chat/*` ·
`src/services/context/*` · `src/services/health/*` · `src/services/prompts/*` ·
`src/db/repos/{scenes,progressions,chat,nudges,prompts}.ts` · `src/lib/motion.ts` ·
`src/features/writers-room/{scene-beat.ts,section.ts,mention-suggest.ts,ContextRail.tsx,SceneList.tsx,RewriteBubble.tsx}` ·
`src/services/ai/prompts/{beat.ts,chat.ts,summarize.ts}` · `docs/AGENT_QUEUE.md` ·
`docs/AGENT_RUNBOOK.md`

**Heavily modified:** `src/styles/{tokens,base}.css` · `src/App.tsx` · `src/stores/ui.ts` ·
`src/features/shell/{LeftRail,MobileNav}.tsx` · `src/db/{schema,types}.ts` ·
`src/features/writers-room/WritersRoom.tsx` · `src/features/search/CommandPalette.tsx` ·
`src/features/settings/SettingsSurface.tsx` · `src/features/codex/EntityEditorDrawer.tsx` ·
`src/services/extraction/known-index.ts` · `src/services/intelligence/apply.ts`

**Absorbed, not deleted:** `HomePage`, `TodaySurface`, `ReviewSurface` become sub-views of
`InsightsSurface`; `HandoffSurface`, `RandomTablesSurface`, `SpeedReaderSurface`,
`TemplatesSurface`, `TrashSurface` move behind the palette and Settings ▸ Tools.

**Untouched by design:** `src/domain/entity-configs/*`, `src/services/extraction/detectors.ts`,
`src/services/intelligence/rules.ts`, `src/services/generate/{spec,coerce,wire}.ts`,
`tests/fixtures/extraction/*`. These are the assets; everything above builds on them.
