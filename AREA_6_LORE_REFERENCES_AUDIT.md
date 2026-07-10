# Area 6 — Lore/Canon + References go live: completion & audit reference

_Status: implemented, ready for audit._

Both panels in `lore-references.jsx` were demo-driven. The References panel was
worse than demo — its `REFERENCES` constant was assigned to `window.REFERENCES`,
which `ReferencesService.listSync` uses as its **storage fallback**, so a fresh
project silently showed six fake references as if they were real. Area 6 wires
both panels to the live store and removes that fallback pollution.

## What's implemented (feature → where → verified)

| Feature | Implementation | Verified by |
|---|---|---|
| **Live canon facts** — reads the `lore` entity collection (summary/body, scope, hardness, confidence, linked entities, includedInAI, note) | `lore-references.jsx` `buildLoreModel` | e2e `23` (live lore fact renders as hard canon) |
| **Scope filter derived + normalised** — persisted scope strings map to world/magic/history/cultural/language/faction | `_loreScope` + `LorePanelBody` | code |
| **Source cite from occurrences** — first occurrence chapter of the lore entity | `buildLoreModel` `firstSource` | code |
| **Fact actions persist** — Hard↔Soft toggle and Include/Exclude-AI write to `lore` entity data; Edit opens the real record | `_loreUpdateData`, `_loreOpenEditor` | e2e `23` (Exclude-from-AI persists `includedInAI=false`) |
| **AI instructions are the REAL prompt rules** — Project Intelligence `canonRules` + `forbidden` terms (the exact strings `buildAuthorContext` appends to every AI call), not a demo list | `buildLoreModel` aiInstructions | e2e `23` (canon rule + "Never use: …" render) |
| **Contradictions honest empty state** — no live cross-chapter detector yet, so the tab says so instead of showing fake conflicts | `LorePanelBody` contradictions view | code |
| **Live references** — reads `ReferencesService.listSync()`; kind normalised to a type chip; excerpt/size derived from content; linked entities resolved to names | `buildReferencesModel`, `_refTypeKey`, `_refWordCount` | e2e `23` (live ref renders with tags + AI badge) |
| **Reference toggles persist** — In/Exclude AI, Canon source, Style ref, Archive all write through `ReferencesService.save` | `_refSave` | e2e `23` (AI-context toggle persists; Archive removes the card) |
| **Type chips reflect present kinds** — only kinds that exist in the live refs get a filter chip | `ReferencesPanelBody` `kindsPresent` | code |
| **No more fallback pollution** — the demo `REFERENCES` constant is gone; `window.REFERENCES` defaults to `[]` so a fresh project is genuinely empty | module tail | e2e `23` (empty project ≠ 6 demo refs) |
| **Live refresh** — Lore recomputes on entity-store / project-intel / occurrence events; References on `lw:references-updated` | panel effects | code |

## How to verify

```sh
npm run validate
npm run build
CHROMIUM_PATH=/path/to/chrome npm run test:e2e -- 23-lore-references   # 5 tests
```

### Manual smoke (no AI key)
1. `npm run dev`, open `Loomwright Shell.html` on a fresh project.
2. **Lore / Canon** → empty. Add a fact (or extract lore) → it appears; flip
   it Hard/Soft and Include/Exclude-AI and reopen — the change persists.
3. In onboarding, set a canon rule → the Lore **AI instructions** tab shows it.
4. **References** → empty (not 6 fake cards). Paste a reference → it appears;
   toggle "In AI context" / Archive and it persists.

## Deferred from Area 6 (tracked in DEFERRED_BACKLOG.md)
- **Live contradiction detection** — cross-chapter canon-conflict finding
  (the demo's banner/tunnel conflicts) is an extraction-quality follow-up.
- **Inline AI-instruction editing** — canon rules render live and read-only;
  editing routes to onboarding. An in-panel editor is a later polish.
- **Reference tag editor + upload preview** — Upload/Paste save real refs; a
  richer tag/preview surface is deferred.
