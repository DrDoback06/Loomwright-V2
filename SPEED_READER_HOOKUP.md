# Speed Reader — Hook-up

Files: `speed-reader.jsx`, `speed-reader.css`.

Two surfaces share one engine (`useSpeedReader`):

## Side panel

`<SpeedReaderPanelBody panel={panel}/>` — wired in `panel-stack.jsx`
via `panel.id === "p-speedReader"`. Includes:
- source selector (chapters + pasted)
- centred word, red pivot letter
- play/pause/prev/next + sentence step
- WPM slider, font-size slider
- punctuation/sentence/focus toggles
- bookmark + Add source + Open Reader

"Open Reader" dispatches `lw:open-panel-workspace` with
`{ workspaceId: "speed-reader", panelKind: "speedReader" }`.

## Full workspace

`SpeedReaderWorkspaceFull` overwrites the basic one in
`window.WORKSPACE_COMPONENTS["speed-reader"]` (this file is loaded
*after* `workspaces-system.jsx`, so its registration wins).

Layout:
- **Top toolbar**: play/pause, restart, bookmark.
- **Left**: reading-source list with kind badges, Paste Source panel,
  bookmark list (clickable → seek).
- **Centre**: previous-sentence ghost line · big RSVP word · current
  sentence underline · next-sentence ghost · transport row · scrubber
  with bookmark strip.
- **Right**: WPM/font sliders, pause-multiplier toggles, session stats
  (words read, pauses, elapsed, bookmarks, notes), current sentence
  panel, action buttons (flag difficult, send to Writer's Room, copy
  excerpt, open chapter), notes list, save/export.

## RSVP engine

Real timing. Base interval: `60000 / max(60, wpm)` ms.

Multipliers applied per word:
- punctuation pause: `,;:—` → ×1.6 when enabled
- sentence pause: `.!?…` → ×2.2 when enabled
- long-word slow-down: length > 8 chars → ×1.4 when enabled

`srTokenise(text)` returns the beat list; each beat knows its sentence
index and end-of-sentence/clause flag. `srSplitWord(word)` returns
`{ before, pivot, after }` for the red-centre-letter render.

## Required callbacks (all dispatched via `data-callback` and CustomEvents)

| Callback | Event | Trigger |
|---|---|---|
| `onSpeedReaderSelectDocument` | (in-component) | source select |
| `onSpeedReaderAddSource` | `lw:speed-reader-add` | "Add reading source" |
| `onSpeedReaderPasteText` | (in-component) | paste-text commit |
| `onSpeedReaderPlay` / `Pause` | — | play/pause toggle |
| `onSpeedReaderRestart` | — | restart |
| `onSpeedReaderPreviousWord` / `NextWord` | — | step |
| `onSpeedReaderPreviousSentence` / `NextSentence` | — | step |
| `onSpeedReaderChangeWpm` / `ChangeFontSize` | — | sliders |
| `onSpeedReaderTogglePunctuationPause` / `ToggleSentencePause` | — | toggles |
| `onSpeedReaderBookmark` | `lw:speed-reader-bookmark` | bookmark |
| `onSpeedReaderSendSentenceToWriterRoom` | `lw:speed-reader-send-sentence` | "Send to Writer's Room" |
| `onSpeedReaderSaveSession` | `lw:speed-reader-save-session` | save |
| `onSpeedReaderExportSession` | `lw:speed-reader-export-session` | export (also clipboard) |
| `onOpenSpeedReaderWorkspace` | `lw:open-panel-workspace` | "Open Reader" |
| `onExitSpeedReaderWorkspace` | `lw:exit-panel-workspace` | workspace exit |

## Acceptance

1. Open Speed Reader from left rail → side panel renders centred word
   with red pivot.
2. Click "Open Reader" → full workspace opens.
3. Press play → words advance at WPM; commas/periods pause longer.
4. Click "Bookmark" while reading → marker appears in scrubber strip.
5. Click "Send to Writer's Room" → CustomEvent fires with the current
   sentence payload.
