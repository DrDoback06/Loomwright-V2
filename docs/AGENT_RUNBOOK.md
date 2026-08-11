# Agent runbook

How an unattended agent run works on this repo. Read this **and**
`docs/AGENT_QUEUE.md` before touching code.

## 1. Read first, in this order

1. `docs/AGENT_QUEUE.md` — what is in flight, and exactly where the last run stopped.
2. `docs/REDESIGN_PLAN.md` — the milestone you are working, in full.
3. `CLAUDE.md` and `docs/rebuild/ARCHITECTURE.md` — the repo's law.
4. `docs/HANDOFF.md` — the pre-existing generation/intelligence work (milestone N14).

## 2. Resume, don't restart

Work the step marked `← IN PROGRESS` in the queue. **Never start a new milestone while any
step of the current one is unchecked.** If the notes say a step is half-done, finish that
half before anything else.

## 3. Definition of done — a step

All of these, in this order, all green:

```bash
npm run lint
npx tsc --noEmit
npm run build          # tsc -b; catches noUnusedLocals/noUnusedParameters that --noEmit misses
npx vitest run
CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test    # if the step touched UI
```

Playwright runs **both** desktop-chromium and mobile-chromium. New UI must pass on both.
If e2e fails with `webServer exit code 2`, it is a build error — run `npm run build`.

## 4. Definition of done — a milestone

- Every step checked.
- A row in `docs/rebuild/SURFACE_CHECKLIST.md` for **every** new rendered control, naming the
  spec that proves it. No dead buttons, ever.
- The new unit + e2e specs listed in the plan's verification table exist and pass.
- Full suite green on desktop and mobile.
- A section appended to `docs/HANDOFF.md` in the style of its §11/§12.

## 5. Always commit and push before the run ends

To `claude/novelcrafter-analysis-ui-redesign-5b8jva` — **never** another branch. Even
mid-step, even if nothing is green yet: commit the work-in-progress and update the queue to
say precisely where you stopped and what the next action is.

```bash
git add -A
git commit -m "N3: scenes repo + v9 migration (steps 1-3)"
git push -u origin claude/novelcrafter-analysis-ui-redesign-5b8jva
```

Retry a failed push up to 4 times with exponential backoff (2s, 4s, 8s, 16s).
**A run that ends without a push has lost its work** — the container is ephemeral.

## 6. If blocked

Write the blocker into the queue's `**Blocked:**` line with enough detail to act on, then
move to the next *independent* milestone. Never skip silently, never leave the queue saying
a step is in progress when you have abandoned it.

## 7. Never

- Push to another branch, or open a PR unless explicitly asked.
- Add a runtime dependency. Zero new ones. (`@tiptap/pm`, `dexie`, `zustand`, `minisearch`,
  `d3-force`, `nanoid` are already there — build on them.)
- Leave a rendered control that does not genuinely work.
- Delete a CSS token id from `src/styles/tokens.css` — `components.css` references them ~1,900
  times. Re-point values and alias legacy names instead.
- Touch `/legacy` (reference only; its callback system is banned by eslint).
- Put real API keys anywhere. E2E mocks provider HTTP via `page.route`.

## 8. Repo gotchas that have bitten before

- Roster-card accessible names start with avatar initials — match `/Name/`, never `/^Name/`.
- Toasts render outside dialogs — assert with `page.getByText`, not scoped to a drawer.
- Playwright `getByLabel` substring-matches; drawer dice buttons (`aria-label="Reroll X"`)
  collide with field labels. Use `{ exact: true }`.
- `entity.fields` is an untyped bag — `tests/unit/packs.spec.ts` is the only thing stopping a
  bad field id. Keep that discipline for anything new that writes into `fields`.
- Extraction fixture 05 pins a legacy contract deliberately. Do not "fix" it — see
  `docs/HANDOFF.md` §11.
- `db.auditLog` ring-buffers at 500 entries per project, with a monotonic `at`.
