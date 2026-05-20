# User Acceptance Regression Audit — original complaints vs current app behaviour

_Created on branch `claude/user-acceptance-regression-audit`, post-PR #13._

## Framing (important)

The backend service work from PRs #3–#13 is **implemented and tested** and
is **not** being rebuilt. The defect this pass addresses is narrower and
specific: **parts of the visible render layer still show design/demo
constants instead of reading the live project store.** That is why the app
can pass service + e2e tests yet feel fake to a user — and it is compounded
by the fact that the prior e2e suite drove `window.LoomwrightBackend.*`
through `page.evaluate` and almost never clicked real UI or asserted on
rendered DOM (only `tests/e2e/01-boot…` clicks anything).

Status language until this pass lands: **"Local beta candidate — pending
UAT/live-render fix."**

## Baseline (Phase 0, this branch)

```
npm run validate         → 526 UI callbacks; 558 handlers; Bucket A = 0 ✓
npm run test:smoke       → all smoke checks passed ✓
npm run test:e2e         → 75 passed ✓
npm run build            → production build checks passed ✓
npm run test:e2e:preview → 2 passed ✓
```

## Root-cause summary (confirmed by reading code)

| Root cause | Evidence | Effect |
|------------|----------|--------|
| `decoratePanel` bails when store empty | `backend-services.jsx:432` `if (!entities.length) return panel;` | Empty store keeps panel's hardcoded demo rows + fake subtitle |
| Panel presets carry demo rows + fake subtitles | `app.jsx:51–76` `PANEL_PRESETS.cast/.timeline` rows + "12 entries · 3 in review" | Fresh project shows Aelinor/Saren/etc. |
| Left-rail queue badges hardcoded | `brand.jsx:80–118` `NAV_ITEMS` `queue: 4/12/3/...`; `app.jsx:891` sums them | Fake rail badges + fake top-bar queue total |
| `tangle` marked `soon:true` | `brand.jsx:104` | Tangle rail item disabled though TangleService works |
| Today suggestions static | `today-ai.jsx:16` `TODAY_SUGGESTIONS` | Today always shows invented prompts |
| Home dashboards static | `home.jsx` `HOME_MANUSCRIPT/REVIEW/PI/WARNINGS/ENTITY_HEALTH` + "Saren's Bargain" chip | Home shows fake stats (Recent Activity is live) |
| Related-pickers read `ENTITY_SAMPLES` | `entity-editor.jsx:223` `EERelatedPicker` | Pickers don't show user-created cast (live cast goes to `CAST_SAMPLE`), and show samples by default |
| Skill-tree assign/connect/lock React-local | `skill-trees.jsx`; no registry handlers | Changes don't persist |

## Complaint table (statuses finalized after the DOM-level UI suite runs)

| ID | Original complaint | Current status | Evidence | Severity | Fix now? | Follow-up |
|----|--------------------|----------------|----------|----------|----------|-----------|
| 1 | Sample data loads by default | Partially fixed (service gating works; render layer leaks demo data) | service: `SampleProjectService` opt-in; render: `decoratePanel:432`, `PANEL_PRESETS`, `NAV_ITEMS`, `today-ai`, `home` | High | Yes — live-render fix | — |
| 2 | "Start writing" / editable canvas | Mostly fixed (Save/Save&Extract wired; contentEditable) | `writers-room.jsx`; `callback-registry.jsx:819`; `ManuscriptService` | UX polish | No — already wired | richer editor = future |
| 3 | Toolbar buttons did nothing | Mostly fixed (most wired) | `callback-registry.jsx` handlers | UX polish | Spot-fix focus exit | — |
| 4 | Chapter reorder; delete tiny | Partially fixed | create/delete wired; reorder UI unclear | Medium | No (larger) | reorder UI follow-up |
| 5 | AI Writer buttons decorative | Fixed (PR #12 routing + guard) | `callback-registry.jsx` Bucket B | Low | No — already fixed | — |
| 6 | Active author dropdown cycles | Needs manual UX review | author profiles in Settings | Low | Investigate | document |
| 7 | Placeholders throughout | Partially fixed | grep placeholders | Medium | Replace contained ones | — |
| 8 | Review queue accept/merge/deny/edit | Fixed (wired) — verify via DOM | `review-queue.jsx`, `callback-registry.jsx:503–571` | High | Verify with DOM test | — |
| 9 | Focus mode exit unclear | Partially fixed | `writers-room.jsx` eye toggle only | UX polish | Yes — add exit affordance | — |
| 10 | Today/Home fake data | Partially fixed (Home recent activity live; rest static) | `today-ai.jsx:16`, `home.jsx` | High | Yes — live data | — |
| 11 | Extraction does nothing | Mostly fixed (Pass 1) | `ExtractionService`, e2e K | Medium | Verify via DOM | streaming = future |
| 12 | Inline annotation numbers unclear | Needs review | occurrence spans `writers-room.jsx` | Low | Yes — tooltip/aria | — |
| 13 | Speed Reader pivot alignment | Mostly fixed (service); verify visual | `speed-reader.jsx` `srSplitWord` | UX polish | Verify; CSS fix if wrong | — |
| 14 | Item linked pickers / not in tab | Partially fixed (data ok; picker source wrong) | `entity-editor.jsx:223` | High | Yes — live picker source | — |
| 15 | Duplicate quest/event ledgers | Mostly fixed (shared store) | `EntityService` single store | Low | Verify | — |
| 16 | Tangle opened Create Location | Fixed, but rail disabled (`soon:true`) | `callback-registry.jsx:943`; `brand.jsx:104` | Medium | Yes — un-disable rail | — |
| 17 | Skill Tree create/edit/assign | Partially fixed (create persists; assign/connect React-local) | `skill-trees.jsx` | Medium | Yes — wire or disable | deep editor = future |
| 18 | Relationships for new actors | Mostly fixed (persist pass) | e2e M | Low | Verify | — |
| 19 | Notes/comments on text blocks | Still broken / not built | no comment service | Medium | No (larger) | next PR |
| 20 | Search global | Fixed (PR #10) — verify via DOM | `SearchService`, e2e P | Low | Verify | — |
| 21 | Sidebar counts fake/stale | Partially fixed (some live, badges static) | `NAV_ITEMS`, `PANEL_PRESETS` subtitles | High | Yes — live counts | — |
| 22 | Active References / current context | Needs review / likely not built | `NAV_ITEMS` refs item | Medium | No (larger) | context panel follow-up |
| 23 | Today useful live work | Partially fixed | `today-ai.jsx` | High | Yes — live | — |
| 24 | Home project dashboard | Partially fixed | `home.jsx` | High | Yes — live | — |
| 25 | Save/local-only status real | Mostly fixed | persistence + AIRouting localOnly | Low | Verify | — |
| 26 | App-wide action audit | Fixed (Bucket A = 0) + this UAT | `npm run validate` | Low | This doc | — |

## Fixes made this pass

_(filled during execution)_

## Counts

_(filled at end: fixed / mostly-fixed / partial / still-broken / obsolete / needs-manual-UX-review)_

## Follow-ups documented (not in this pass)

- Notes/comments attached to text blocks (#19).
- Chapter reorder UI (#4).
- Active-references / current-chapter context panel (#22).
- Deep Skill-Tree node editor + actor-context switching (#17).
- Rich-text editor migration, extraction streaming.
