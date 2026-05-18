# Extraction Review — Hook-up Notes

## Purpose
Every entity tab in this pass has its own review queue that surfaces
extraction candidates from the manuscript. The user accepts, edits,
merges, or denies each candidate. Blue-confidence items may auto-add but
remain visible in the queue for transparency.

## Confidence Bands
| Band | Range | Meaning | Default action |
|---|---|---|---|
| **Blue** | 95–100 | Auto-add eligible | Saved as Active, visible in queue for review |
| **Green** | 75–94 | Strong suggestion | Surfaced for one-tap Accept |
| **Orange** | 50–74 | Uncertain | Needs review before action |
| **Red** | < 50 | Weak / risky | Almost certainly needs edit or deny |

**Confidence colours are only for review/extraction surfaces. NEVER use
them as manuscript entity highlight colours.**

## Review Card Standard
Every review card (across all entity types) carries:
- Confidence band (badge with value %)
- Candidate type (e.g. "owner change detected")
- Suggested action (one-line)
- Source chapter + paragraph cite
- Source quote (italic blockquote)
- Related existing entity (for merges)
- Affected target entity
- Conflict / warning hint (if any)
- Suggested field changes
- Buttons: **Accept · Edit · Merge · Deny · Open source · Open related tab · Show on Atlas / Timeline** (when relevant)

## Per-Tab Queue Categories

### Locations
candidates, hierarchy, placements, mentions, contradictions.

### Items
candidates, ownership, location, effects, equipment, quest/event links,
contradictions, forgotten-item warnings.

### Classes
candidates, assignment, stats, skills, restrictions.

### Races
candidates, traits, origin, factions, bestiary.

### Stats
value changes, qualitative changes, rule suggestions, contradictions.

### Quests
candidates, steps, progress, completion/failure, links, contradictions.

### Events
candidates, timeline, participants, consequences, relationship changes,
contradictions.

## Review Queue Item Shape
```js
reviewQueueItem {
  id, entityType,
  candidateType,                    // freeform string keyed per entity
  suggestedAction: string,
  confidence: { band: "blue|green|orange|red", value: 0-100 },
  sourceChapter: { num, paragraphId, cite },
  sourceQuote: string,
  targetEntityId?: string,          // when modifying an existing entity
  relatedEntityIds?: [string],      // for merges
  suggestedChanges: { ... },        // field-level patch
  status: "pending|accepted|denied|merged",
  warning?: string,
}
```

## Where Queues Live
- **Compact panel**: `<ReviewCountBadge>` + `<Btn icon="bell">` opens
  global queue pre-filtered to this entity type.
- **Expanded panel**: "Review Queue" tab in the right-tabs strip.
- **Global Review Queue**: master review hub, accessible from the
  topbar bell. Pre-filters via `onOpenReviewQueue({ entityType })`.

## Manual Creation vs Extraction Creation
Both flows produce the same final entity object. The Entity Editor
supports promoting a candidate into the full editor via the
`promoteFrom` prop, which surfaces the source quote + confidence in
the editor aside panel.

## Callbacks (Common Across Tabs)
`onAccept<Entity>QueueItem`, `onEdit<Entity>QueueItem`,
`onMerge<Entity>QueueItem`, `onDeny<Entity>QueueItem`,
`onOpenSource<Entity>Mention`, `onOpen<Entity>InTab`.
