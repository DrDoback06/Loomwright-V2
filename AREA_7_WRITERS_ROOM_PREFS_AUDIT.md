# Area 7 — Writer's Room applies workspace layout prefs: completion & audit reference

_Status: implemented, ready for audit._

Onboarding (and the Editor settings) persist `workspace.*` layout preferences —
`editorWidth`, `font`, `panelStack`, `margins`, `mobileCompact`, etc. Only
`mobileCompact` and `startTab` were ever read; the rest were dead. Area 7 wires
the two purely-visual page prefs — **editor width** and **editor font** — so the
Writer's Room actually honours them, live, and adds a settings control so they
are editable outside onboarding.

## What's implemented (feature → where → verified)

| Feature | Implementation | Verified by |
|---|---|---|
| **Writer's Room reads `workspace.editorWidth` / `workspace.font`** and applies them as `--wr-editor-width` / `--wr-editor-font` CSS vars on the `.wr` root | `writers-room.jsx` `_wrWorkspacePrefs`, `wsPrefs` state, root `style` | e2e `24` (vars set; canvas renders at 960px) |
| **Manuscript column + editable body honour the vars** — width `min(var(--wr-editor-width,720px),100%)`; font `var(--wr-editor-font, var(--font-serif))` on both `.wr-canvas` and the editable body | `writers-room.css` | e2e `24` (computed width + font-family) |
| **Font pref maps to a real stack** — the chosen face is preferred, app serif is the fallback so an uninstalled web font degrades cleanly | `_WR_FONT_STACKS` | code |
| **Live refresh** — the room re-applies on `lw:settings-saved` / `lw:settings-updated` / `lw:backend-ready`, so reopening onboarding or changing settings updates without a reload | `writers-room.jsx` effect | e2e `24` (pref change 640→1000 applies live) |
| **Editable settings control** — Settings → Editor now has a **Page** card (width slider + font picker) bound to the `workspace` section; changes persist and apply live | `settings-rich.jsx` `SetPageLayout` (rendered under `case "editor"`) | code + e2e `24` (uses the same `workspace` section) |
| **Safe defaults** — an unset pref leaves the var unset so the CSS falls back to the built-in 720px / app serif | root `style` guards | e2e `24` (default project = 720px, no var) |

**Behaviour note:** editor width is an *upper bound* — the canvas is
`min(--wr-editor-width, 100%)`, so in the default "full" layout the visible
side margins (280 + 320 px) constrain the column and the width pref takes
visible effect in the writing-focused modes (focus / manuscript-focus / clean,
where margins hide and the column is wide). The **font** pref applies in every
mode. The e2e width checks therefore run in focus mode.

## How to verify

```sh
npm run validate
npm run build
CHROMIUM_PATH=/path/to/chrome npm run test:e2e -- 24-writers-room-prefs   # 3 tests
```

### Manual smoke
1. `npm run dev`, open the app → Writer's Room.
2. Settings → Editor → **Page**: drag Editor width → the manuscript column
   resizes live; pick a font → the page restyles.
3. Reopen onboarding, change the workspace width/font, finish → the Writer's
   Room reflects it without a reload.

## Deferred from Area 7 (tracked in DEFERRED_BACKLOG.md)
- **`workspace.margins` + `panelStack`** — margins are already governed by the
  Editor's interactive `marginsDefault` + layout modes, and `panelStack` is a
  side-panel docking concern owned by the layout/workspace system; folding the
  onboarding prefs into those without regressing the interactive controls is a
  separate layout pass. `editorWidth` + `font` are the two conflict-free visual
  prefs and are done here.
- **`themeIntensity` / `chapterRail` position** — smaller cosmetic prefs for a
  later Writer's Room polish pass.
