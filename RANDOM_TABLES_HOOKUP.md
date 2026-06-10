# Random Tables — hookup notes

Rollable generator tables (Alkemion-inspired) for brainstorming names,
weather, twists and found objects — or anything the author charts.

## Data model (`RandomTableService`, key `random_tables`)

```
{
  tables:  [{ id, name, category, dice, rows: [{ id, text, weight, entityRef? }], createdAt }],
  history: [{ id, tableId, tableName, results: [text], at }]   // capped 30
}
```

- Storage holds USER tables only. Four starter tables (character names,
  weather, plot twists, found objects) ship as code-level builtins
  (`source: "builtin"`), merged at read time, copy-on-write when edited,
  never exported, never removable.
- `roll(tableId, { count, unique, rng })` — weighted; `rng` injectable so
  tests are deterministic. `rollAndLog` records history.
- User tables ride project export/import (replace + merge modes).

## Surfaces

- `random-tables.jsx` panel (left rail ▸ tools; wheel "Roll" action):
  roster with category chips, Roll (1/3/5 + no-repeats), result cards
  with **→ Writer** (inserts into the active chapter) and **Create
  entity** (editor prefilled; type follows the table category), row
  editor with weights, Duplicate-to-edit for starters, recent rolls.

## Verification

- Smoke `[rt]`: builtins, persisted user tables, deterministic/weighted/
  unique rolls, copy-on-write, removal guard, history, export hygiene.
- e2e `tests/e2e/30-random-tables.spec.js` (4 tests).
