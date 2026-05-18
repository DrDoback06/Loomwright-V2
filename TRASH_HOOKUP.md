# TRASH_HOOKUP.md

`TrashPanelBody` lives in `trash.jsx`. Permanent deletion uses a
double-confirm (first click sets the confirming-id, second commits).

## Shape

```ts
trashItem = {
  id: string,
  type: "chapter" | "entity" | "note" | "reference" | "canvas" |
        "relationship" | "map" | "skill" | "tangle" | "settings",
  name: string,
  from?: string,        // origin label, e.g. "Writer's Room · Ch. 3"
  deletedAt: string,
  by?: string,
  note?: string,
  resolved?: boolean,   // for notes; resolved-before-delete flag
}
```

## Callbacks

- `onRestoreTrashItem`, `onPreviewTrashItem`
- `onDeleteTrashItemForever` (caller is responsible for double-confirm UX)
- `onFilterTrashByType`, `onSortTrash`, `onSearchTrash`
- `onEmptyTrash` (not wired — single-purpose; add if needed)

## Retention

UI copy says 30 days. Make the host enforce this.
