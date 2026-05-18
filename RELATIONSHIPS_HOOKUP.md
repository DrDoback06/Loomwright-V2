# RELATIONSHIPS_HOOKUP.md

Relationships workspace — single character, two-character compare, group network, history timeline, conflict heat, review queue.

---

## Data shapes

```ts
type Relationship = {
  id: string;
  a: string; b: string;       // cast ids (always sorted alphabetically by convention)
  type: "friend" | "enemy" | "family" | "lover" | "rival" | "mentor" | "faction" | "unknown";
  strength: 0..100;
  trust: 0..100;
  conflict: 0..100;
  secret: boolean;
  summary: string;
  chapters: number[];         // chapters where this rel surfaces
};

type RelationshipEdge = {     // graph projection
  from: string; to: string;
  type: string; color: string;
  strokeWidth: number;        // derived from strength
  dashed: boolean;            // secret rel
  conflictHalo?: number;      // radius if conflict > 60
};

type RelationshipEvidence = {
  id: string; rel: string;
  chapter: number;
  quote: string;
  strength: "high" | "strong" | "uncertain" | "weak";
};

type RelationshipChangeEvent = {
  id: string; rel: string;
  chapter: number;
  kind: "new" | "type" | "strength" | "trust" | "conflict" | "secret";
  from: any; to: any;
  note: string;
  date: string;
};

type RelationshipReviewQueueItem = {
  id: string;
  lvl: "high" | "strong" | "uncertain" | "weak";
  title: string;
  action: string;
  excerpt: string; cite: string;
};

type RelationshipGraphState = {
  filterType: string | null;
  filterFaction: string | null;
  filterChapter: number | null;
  hideSecret: boolean;
};
```

---

## Modes

| Id         | View                                                |
|------------|-----------------------------------------------------|
| single     | One character — top relationships, hopes, fears, recent changes |
| compare    | Two characters — meters, evidence, change history    |
| network    | Group graph (SVG, parchment, force-style)            |
| timeline   | Chapter-by-chapter change log                        |
| conflict   | High-conflict relationships sorted by heat           |
| review     | Queue cards (lvl pill, excerpt, accept/edit/merge/deny) |

---

## Cross-panel behaviour

Relationships reacts to selection from other panels:

- Cast selected → switch to `single` mode + load that character.
- Quest/Event selected → filter relationships to those affected by it.
- Atlas location selected → filter to relationships connected to that place.
- Timeline event selected → snapshot relationship meters at that chapter.

The panel reads the cross-panel focus via `window.focusedByType` (already wired through PanelStack).

---

## Callbacks

```
onCreateRelationship(a, b, type)
onEditRelationship(id, patch)
onChangeRelationshipType(id, newType)
onChangeRelationshipStrength(id, kind, value)   // kind: "strength" | "trust" | "conflict"
onAddRelationshipEvidence(id, { chapter, quote, strength })

onCompareCharacters(aId, bId)
onOpenRelationshipTimeline(id?)
onCreateEventFromRelationship(id)
onOpenCharacterDossier(characterId)
onOpenSourceMention({ chapter, page })
onOpenAtlasForSharedLocations(aId, bId)

onAcceptRelationshipQueueItem(id)
onEditRelationshipQueueItem(id, patch)
onMergeRelationshipQueueItem(id, targetRelId)
onDenyRelationshipQueueItem(id)
```

---

## Meter encoding

| Meter     | Colour    |
|-----------|-----------|
| Strength  | #b86a82   |
| Trust     | #3e6db5   |
| Conflict  | #a8553f   |

Meters are 0–100 integers; bars use a 6px height, conflict bar widths the heat halo on the graph.
