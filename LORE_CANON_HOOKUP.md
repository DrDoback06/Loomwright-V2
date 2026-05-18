# LORE_CANON_HOOKUP.md

Lore / Canon panel + References panel. Two panels, related but separate state.

---

## Lore / Canon

```ts
type CanonFact = {
  id: string;
  text: string;
  scope: "world rule" | "magic rule" | "historical" | "cultural" | "language rule" | "faction rule" | "AI instruction";
  hardness: "hard" | "soft";
  confidence: "high" | "strong" | "uncertain" | "weak";
  source: string;
  linkedEntities: string[];
  contradictions: number;
  included: boolean;        // in Project Intelligence File?
  lastUpdated: string;
  note?: string;
};

type CanonRule = CanonFact; // alias — rules are facts with scope ending in "rule"

type Contradiction = {
  id: string;
  a: { factId?: string; source: string; text?: string };
  b: { factId?: string; source: string; text?: string };
  summary: string;
  affected: string[];     // entity ids
  suggestion: string;
};

type ProjectIntelligenceLink = {
  factId: string;
  includedInAIContext: boolean;
  pinnedHard: boolean;
  styleSource: boolean;
};
```

### Views

| View            | Content                                            |
|-----------------|----------------------------------------------------|
| facts           | Canon-fact cards, filtered by scope chip strip     |
| contradictions  | Split-source contradiction cards w/ suggestion     |
| ai              | AI-instruction cards (mono font, prefixed bullet)  |

### Callbacks

```
onCreateCanonFact(patch)
onEditCanonFact(id, patch)
onMarkHardCanon(id)
onMarkSoftCanon(id)
onFlagContradiction(id)
onResolveCanonContradiction(id, resolution)
onLinkCanonToReference(factId, referenceId)
onLinkCanonToEntity(factId, entityId)
onRemoveCanonFact(id)
onCopyToProjectIntelligenceFile(id)
```

---

## References

```ts
type Reference = {
  id: string;
  title: string;
  type: "research" | "style" | "image" | "manuscript" | "instructions";
  tags: string[];
  linkedEntities: string[];
  aiContext: boolean;        // included in AI prompt assembly?
  canonSource: boolean;      // counts as canonical evidence?
  styleSource: boolean;      // used for voice/tone reference?
  lastOpened: string;
  privacy: "local" | "private" | "cloud";
  sourceState: "active" | "pinned" | "archived";
  size: string;
  excerpt: string;
};

type ReferenceTag = {
  id: string; label: string;
  color: string;
};
```

### Callbacks

```
onUploadReference(file)
onPasteReference(text)
onTagReference(refId, tags)
onLinkReferenceToEntity(refId, entityId)
onToggleReferenceAIContext(refId)
onToggleReferenceCanonSource(refId)
onToggleReferenceStyleSource(refId)
onArchiveReference(refId)
onRemoveReference(refId)
```

---

## Badge semantics (References)

| Badge                | Meaning                                    |
|----------------------|--------------------------------------------|
| In AI context        | Will be assembled into prompt context      |
| Canon source         | Cited when AI must avoid contradicting    |
| Style ref            | Used to match author voice                 |
| Excluded from AI     | Off by default (e.g. mood-board images)    |

These map directly to flags on the `Reference` object — they're not separate state.
