# Reusable Templates — hookup notes

Snapshot any structure and reuse it (Alkemion-inspired). Two kinds, one
service (`TemplateService`, key `templates`):

```
{
  templates: [
    { id, kind: "entity", name, entityType, genre?, fields: { summary, data }, createdAt },
    { id, kind: "board",  name, nodes: [{ key, kind, title, preview, x, y }],
      edges: [{ from, to, label, directed }], createdAt },
  ]
}
```

- **Entity templates** — `saveEntityTemplate` snapshots fields with
  identity stripped; `entityInitialFrom` yields a FLAT editor prefill.
  Surfaces: the entity editor's "Start from" strip (creating only) and
  the footer "Save as template" button. Nine built-in genre starters
  (High fantasy / Grimdark / Science fiction × class / race / ability)
  cover the deferred "genre RPG entity templates" item; builtins never
  export and can't be removed.
- **Board templates** — `saveBoardTemplate` snapshots a tangle cluster
  with positions normalized to origin; `instantiateBoardTemplate` stamps
  it onto any board at a point with edges remapped to the new node ids.
  Surfaces: Tangle toolbar "Save template" (selected card's cluster) and
  the tray's "Templates — tap to stamp" section.
- User templates ride project export/import (replace + merge).

## The editor round-trip fix (landed with this feature)

The form state is FLAT (`data[field.id]`); persisted entities nest
custom fields under `entity.data`. Two halves, both fixed:

1. **Open:** `initial: { id }` hydrates from the live record; any
   entity-shaped initial flattens its nested `data` block (identity keys
   win). The dossier "Edit" path no longer opens blank.
2. **Save:** `app.jsx saveEntityFromEditor` packs flat fields back into
   `entity.data` (identity keys stay top-level; aliases/summary
   mirrored) so editor- and extraction-created records share one shape.

## Verification

- Smoke `[tpl]`: builtins, identity stripping, flat prefill, origin
  normalization, stamping + edge remap, export hygiene.
- e2e `tests/e2e/32-templates.spec.js` (4 tests, incl. the
  hydrate-and-pack round-trip regression).
