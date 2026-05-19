# Legacy Extraction Audit — Claimwise → Loomwright v2

_Source branch: `DrDoback06/Claimwise` @ `claimwise-legacy-working`._
_Audit date: 2026-05-19._

## Scope

Behavioural reference only. The legacy Claimwise extraction subsystem is
studied to identify logic worth porting into Loomwright v2's existing
services. **The legacy UI, architecture, providers, and routing are NOT
to be reused**. Loomwright's `Loomwright Shell.html` modular design is
the source of truth.

## 1. Extraction-related files identified

| File | Purpose |
|------|---------|
| `src/services/aiService.js` | Multi-provider AI router (Claude/OpenAI/Gemini/Groq/HF/offline) with retry, caching, queueing. **Not portable** as-is — Loomwright is BYOK single-provider. |
| `src/services/chapterDataExtractionService.js` | Centralised extraction methods per category: beats, events, locations, entities, character data, relationships. Uses chunking + overlap, JSON parsing, fuzzy name fallback, confidence scoring. |
| `src/services/canonExtractionPipeline.js` | Single-pass 10-category canon extraction with a comprehensive prompt covering characters, items, skills, relationships, plots, quests, timeline, locations, factions, lore. |
| `src/services/entityMatchingService.js` | Levenshtein-based fuzzy matching + nickname aliasing + upgrade detection (property-change identification). |
| `src/services/extractionHistoryService.js` | Reversible extraction sessions with previousState/newState recorded per action; supports undo / revertSession. |
| `src/services/aiSuggestionService.js` | Story-shape suggestions (plot directions, callbacks, etc). **Not extraction-relevant**; out of scope. |
| `src/services/entityInterjectionService.js` | Embeds entities into existing text. **Different feature**; out of scope. |
| `src/components/EntityExtractionWizard.jsx` | Linear extraction → review → action wizard. Three buckets: matched / new / upgrades. Per-candidate accept/skip/enhance. No batch. |
| `src/components/NarrativeReviewQueue.jsx` | Richer review queue with domain filter, status filter, confidence-band filter, JSON edit mode, disambiguation selector, side-by-side compare, **bulk approve/deny/undo**. |
| `src/components/EntityInterjectionModal.jsx` | Insertion UI. Out of scope. |
| `src/loomwright/language/languageAI.js` | Earlier prototype. Superseded by `chapterDataExtractionService`. Not portable. |

## 2. What worked well

### Chunked extraction with overlap
5000-character chunks with 500-character overlap so entities mentioned across boundaries aren't lost. Each chunk passed to AI with `chapterNumber` and `chunk.index + 1 / chunks.length` for context.

### Confidence on every candidate (0–1)
Every extracted record carries `confidence: 0-1`. Loomwright already has confidence bands (blue / green / orange / red); the legacy 0–1 scale maps directly.

### Three-tier name matching hierarchy
1. **Exact** (case-insensitive) → confidence 1.0, matchType `"exact"`
2. **Nickname alias** → confidence 0.95, matchType `"nickname"`
3. **Fuzzy** via Levenshtein, threshold 0.7 → matchType `"fuzzy"`

This is a proven, simple heuristic. Loomwright's current local-pass scanner only does exact whole-word match.

### Upgrade detection
`detectUpgrade(entity, existingEntity)` identifies property changes (stats, description, rarity, tier) on an existing entity — distinguishes a "this is new" candidate from a "this is an update to a known record" candidate. Loomwright currently treats everything as new.

### Wizard categorises candidates into three buckets
- **Matched** (existing entity confirmed in this chapter) — confidence shown, "Confirm Match" / "Skip"
- **New** (truly new entity) — "Create" or for actors "Enhance" (auto-fill stats/equipment) then create
- **Upgrade** (existing entity with new properties detected) — "Apply Upgrade" or "Skip"

This categorisation makes the review queue purposeful instead of a flat list.

### Comprehensive single-pass prompt
The `canonExtractionPipeline` prompt asks for all 10 categories at once. Reduces token cost vs running 10 prompts. Verbatim prompt text is preserved below for reuse.

### Per-extraction history with undo
Every accept/edit/merge records `previousState` and `newState`. `revertExtraction(id)` rolls back. `revertSession(sessionId)` rolls back a whole extraction run. Powerful safety net.

### Bulk review-queue actions
The `NarrativeReviewQueue` supports:
- Approve all pending
- Approve all pending with edits applied
- Deny remaining
- Undo last
- Undo all

Loomwright currently has none of these — only per-item actions.

### Filters in review queue
By **domain** (character / item / skill / relationship / plot / timeline / location / lore / faction / retroactive impact / all), **status** (pending / accepted / rejected / edited), and **confidence band**.

## 3. What was unreliable or should NOT be reused

### Hardcoded story context
The aiSuggestionService prompts are bonded to "The Compliance Run" — specific character names embedded in the prompt. Generic prompts that read project context dynamically are required for Loomwright.

### No source-chunk persisted on candidates
The wizard shows `description` (extracted summary) but **not the exact chapter snippet that produced the candidate**. Loomwright's `EntityOccurrence` model already captures `exactText` + `startOffset/endOffset` — better. Don't regress.

### Multi-provider router
Routes between Claude / OpenAI / Gemini / Groq / HuggingFace / offline with fallback chains, cost tracking, intelligence routing. Loomwright is **BYOK single-provider** by design. The provider abstraction in Loomwright is intentionally simpler.

### Server-proxy mode for keys
Loomwright stores BYOK keys encrypted in IndexedDB via `KeysService` (AES-GCM). No server.

### EntityInterjectionService
Different feature (insert into text). Out of scope for this pass.

### Linear wizard with no batch
The simpler `EntityExtractionWizard` lacks bulk operations. Use `NarrativeReviewQueue`'s richer model where it adds value, ignore the simpler one.

### Aged caching with hidden TTL
`cacheTTL = 10 * 60 * 1000` silently hides results. For deterministic extraction the user-triggered call should always run fresh.

## 4. Legacy candidate / entity shapes

### Entity output (chapterDataExtractionService)

```js
{
  actors: [{ name, description, isNew }],
  items:  [{ name, description, isNew }],
  skills: [{ name, description, isNew }],
}
```

### Canon pipeline output (10 categories at once)

```js
{
  characters:   [{ name, description, isNew, traits, role, confidence }],
  items:        [{ name, description, isNew, type, rarity, owner, confidence }],
  skills:       [{ name, description, isNew, user, action, level, confidence }],
  relationships:[{ character1, character2, type, change, strength, confidence }],
  plots:        [{ title, description, status, characters, confidence }],
  quests:       [{ title, description, type, status, objectives, confidence }],
  timeline:     [{ event, timestamp, characters, significance, confidence }],
  locations:    [{ name, type, description, significance, confidence }],
  factions:     [{ name, type, members, goals, stance, confidence }],
  lore:         [{ title, category, description, significance, confidence }],
}
```

### Match result (entityMatchingService)

```js
{ actor: <entity>, confidence: 0..1, matchType: "exact" | "nickname" | "fuzzy" }
```

### Extraction-session record (extractionHistoryService)

```js
{
  id, timestamp, chapterId, sourceType, sourceName,
  status, entriesCount, suggestions, reviewStatus,
  appliedActions, wizardState, documentText, lastSaved,
}
```

### History entry (per accept/edit/merge)

```js
{
  id, extractionId, timestamp, chapterId,
  entityType, action, entityId, entityName,
  previousState, newState, targetActorId, targetActorName,
  sourceContext, confidence, reverted, revertedAt,
}
```

## 5. Prompt / parsing logic worth preserving

### Beats prompt (verbatim — generic enough to port)

```
Analyze the following chapter text chunk and extract plot beats
(significant story events, conflicts, resolutions, character moments).

Chapter ${chapterNumber}, Chunk ${chunk.index + 1}/${chunks.length}:
${chunk.text}

Return a JSON array of plot beats. Each beat should have:
- beat: A brief description of what happens
- purpose: Why this beat matters to the story
- characters: Array of character names involved
- emotionalTone: The emotional tone
- importance: 1-10 scale
- confidence: 0-1 confidence score
```

### Entities prompt

```
Analyze the following chapter text and extract story entities.

Chapter text (chunk ${chunk.index + 1}/${chunks.length}):
${chunk.text}

Extract:
1. Characters/Actors mentioned (new or existing)
2. Items mentioned (weapons, equipment, objects)
3. Skills mentioned (abilities, powers, techniques)

For each entity, provide:
- name: Entity name
- type: actor, item, or skill
- description: Brief description from context
- isNew: true if this seems like a new entity introduction

Return JSON:
{"actors":[{name,description,isNew}],"items":[…],"skills":[…]}
```

### Canon 10-category prompt (verbatim shape; useful for "deep extract")

```
You are a canon extraction system for a long-form story. Analyze this
chapter chunk and extract ALL narrative elements across every domain.

Chapter ${chapterNumber}, Chunk ${chunk.index + 1}:
---
${chunk.text}
---

Known characters: ${actorNames || 'None'}
Known items:      ${itemNames  || 'None'}

Extract into these categories:
1. characters: [{name, description, isNew, traits, role, confidence}]
2. items: [{name, description, isNew, type, rarity, owner, confidence}]
3. skills: [{name, description, isNew, user, action, level, confidence}]
4. relationships: [{character1, character2, type, change, strength, confidence}]
5. plots: [{title, description, status, characters, confidence}]
6. quests: [{title, description, type, status, objectives, confidence}]
7. timeline: [{event, timestamp, characters, significance, confidence}]
8. locations: [{name, type, description, significance, confidence}]
9. factions: [{name, type, members, goals, stance, confidence}]
10. lore: [{title, category, description, significance, confidence}]

For each item, include a confidence score (0-1).
For existing entities, note them as isNew:false.

Return valid JSON only.
```

The `Known characters / Known items` lines are the **critical wedge**:
they let the model know what already exists so it can return matched
candidates instead of duplicates.

### Relationships two-pass prompt

The two-pass approach (Pass 1: identify pairs; Pass 2: detail each pair)
produced higher-quality relationship records than a single-pass run.
Worth preserving when Loomwright eventually expands relationship
extraction.

### Levenshtein matcher

The exact code (worth porting verbatim):

```js
// Match hierarchy: exact → nickname → fuzzy (threshold 0.7)
if (actor.name?.toLowerCase() === needle.toLowerCase())
  return { actor, confidence: 1.0, matchType: 'exact' };
for (const nick of actor.aliases || [])
  if (nick.toLowerCase() === needle.toLowerCase())
    return { actor, confidence: 0.95, matchType: 'nickname' };
const score = levenshteinSimilarity(needle, actor.name);
if (score >= 0.7) return { actor, confidence: score, matchType: 'fuzzy' };
```

`levenshteinSimilarity` = `1 - distance / Math.max(a.length, b.length)`
with standard DP distance.

## 6. Mapping to Loomwright v2 services

| Legacy capability | Loomwright destination |
|-------------------|------------------------|
| Chunk text with overlap | `ExtractionService.runExtraction` — add `chunkText(text, size=5000, overlap=500)` helper |
| Per-category prompts | New `ExtractionService.promptForCategory(category, ctx)` returning a generic prompt template |
| Canon 10-category prompt | Used by Deep Extract path (`deep: true`) — adds `Known characters: …` / `Known items: …` lines from live store |
| Confidence 0–1 → band (blue/green/orange/red) | Already in `confidenceBand` field; map `>=0.95 → blue`, `>=0.75 → green`, `>=0.5 → orange`, `< 0.5 → red` |
| Three-tier match (exact / nickname / fuzzy) | `OccurrenceService.findKnownEntityMention(needle)` — extend the current name scanner with alias + Levenshtein |
| Upgrade detection | New helper `EntityService.diffEntity(existing, candidate)` returning a list of changed fields. Review item gets `suggestedAction: "update"` instead of `"create"` |
| Three-bucket wizard (matched/new/upgrade) | Review queue items already have `suggestedAction`; extend it to `create | update | merge | link` and let the existing review queue UI render them differently |
| Extraction sessions with undo trail | `ExtractionService.saveSession(...)` already stores; **extend** with `previousState` per accept and a `revertSession(sessionId)` method |
| Bulk review-queue actions | `ReviewService.resolveMany(ids, status)` + wire `onBulkAcceptQueueItems` / `onBulkDenyQueueItems` / `onBulkMergeQueueItems` (these callback names already exist) |
| Filters by domain/status/confidence | The current review queue panels can read `confidenceBand`; ensure ReviewService.listSync supports `{type, status, minConfidence}` |
| Source-chunk on candidate | Loomwright already has `EntityOccurrence.exactText` + offsets — **better than legacy**. Ensure review items carry `sourceQuote` (already in shape). |

## 7. Concrete implementation steps for this pass

These are the items I will land in code (separate commits):

### Step A — Port chunk+overlap helper

In `backend-services.jsx`, add `chunkText(text, size=5000, overlap=500)` returning `[{ index, start, end, text }]`. Replace the single-shot text passed to `AIService.complete` with iteration over chunks.

### Step B — Port Levenshtein + alias-aware matcher

In `backend-services.jsx`, add `levenshteinDistance(a, b)`, `levenshteinSimilarity(a, b)`, and `findKnownEntityMention(needle, opts)` returning `{ entity, confidence, matchType }` using the three-tier hierarchy. Replace `scanTextForKnownEntities` to:
- still scan exact whole-word matches (cheap, deterministic),
- additionally probe for nickname / fuzzy hits at threshold ≥ 0.85 (higher than legacy 0.7 because we're matching free text without an LLM filter).

### Step C — Enrich review-item shape with matchType + sourceQuote + previousState

`ExtractionService.runExtraction` already stamps `chapterId` and `candidateId`. Add:
- `matchType: "exact" | "nickname" | "fuzzy" | "new"` per candidate
- `sourceQuote: <slice of chapter text around the candidate>` (~140 chars)
- `previousState: <existing entity snapshot>` when `matchType !== "new"` and proposal differs (legacy's "upgrade" case)
- `suggestedAction: "create" | "update"` mapped from matchType.

### Step D — Confidence-band derivation

Add `EntityService.confidenceBand(value)` returning blue/green/orange/red. ExtractionService uses it to set `confidenceBand` on review items. Existing review queue UI already reads this field.

### Step E — Bulk review actions

`ReviewService.resolveMany(ids, status)` iterates `resolve`. Registry handlers `onBulkAcceptQueueItems` / `onBulkDenyQueueItems` / `onBulkMergeQueueItems` (already in the callback names list, currently fall to `onCopy*` generic — verify and wire explicitly).

### Step F — Better prompts for AI path

When a provider is configured and Deep Extract runs, use the canon 10-category prompt verbatim, prefixed with `Known characters: …` / `Known items: …` lines reflecting the live store. Local-pass still runs unconditionally.

### Step G — Extraction-session undo (deferred scope)

The legacy `extractionHistoryService` with `previousState` + `revertSession` is rich. Loomwright already stores a session under `KEYS.extractionSession`. Extending it with per-action undo trail is multi-hour work — **out of scope for this pass**. Recorded as a TODO in this doc.

What this pass intentionally does NOT do:
- multi-provider router
- intelligence cost tracking
- caching layer
- two-pass relationship extraction (defer; current relationship extraction is shallow in Loomwright too)
- enhancement (auto-fill stats/equipment via AI) — separate feature

## Acceptance criteria for the extraction portion of this pass

- `chunkText` exists and is used by `runExtraction`.
- Local scanner recognises nicknames and fuzzy matches (Levenshtein ≥ 0.85).
- Each review item carries `matchType`, `sourceQuote`, `confidenceBand`, and `suggestedAction`.
- Deep Extract uses the canon 10-category prompt with the live `Known characters` / `Known items` injection.
- `onBulkAcceptQueueItems` etc. perform bulk resolution.
- All existing tests + audit still pass.
- Writer's Room and review queue UI continue to function unchanged.
