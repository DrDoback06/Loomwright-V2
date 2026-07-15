from pathlib import Path

ROOT = Path('.')

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')

def replace(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    write(path, content.replace(old, new, 1))

# Shared interpretation types.
replace(
    'src/domain/entity-types.ts',
    "  | 'references';\n\nexport interface EntityTypeMeta",
    "  | 'references';\n\nexport interface EntityTypeSuggestion {\n  type: EntityType;\n  /** 0..1 confidence that this interpretation is the best fit. */\n  confidence: number;\n  reason: string;\n}\n\nexport type CandidateInterpretationKind =\n  | 'canonical'\n  | 'title'\n  | 'alias'\n  | 'nickname'\n  | 'command'\n  | 'sound'\n  | 'objective'\n  | 'software'\n  | 'nationality'\n  | 'generic-item'\n  | 'ambiguous';\n\nexport interface EntityTypeMeta"
)

# Candidate transport/persistence fields.
replace(
    'src/services/extraction/detectors.ts',
    "import type { EntityType } from '@/domain/entity-types';",
    "import type { CandidateInterpretationKind, EntityType, EntityTypeSuggestion } from '@/domain/entity-types';"
)
replace(
    'src/services/extraction/detectors.ts',
    "  detector?: string;\n  start?: number;",
    "  detector?: string;\n  typeSuggestions?: EntityTypeSuggestion[];\n  interpretation?: { kind: CandidateInterpretationKind; note: string };\n  start?: number;"
)
replace(
    'src/services/extraction/detectors.ts',
    "    existing.suggestedChanges = { ...(existing.suggestedChanges ?? {}), ...(c.suggestedChanges ?? {}) };",
    "    existing.suggestedChanges = { ...(existing.suggestedChanges ?? {}), ...(c.suggestedChanges ?? {}) };\n    const suggestions = new Map((existing.typeSuggestions ?? []).map((suggestion) => [suggestion.type, suggestion]));\n    for (const suggestion of c.typeSuggestions ?? []) {\n      const prior = suggestions.get(suggestion.type);\n      if (!prior || suggestion.confidence > prior.confidence) suggestions.set(suggestion.type, suggestion);\n    }\n    existing.typeSuggestions = [...suggestions.values()].sort((a, b) => b.confidence - a.confidence);\n    if (!existing.interpretation && c.interpretation) existing.interpretation = c.interpretation;"
)

replace(
    'src/db/types.ts',
    "import type { EntityRef, EntityType } from '@/domain/entity-types';",
    "import type { CandidateInterpretationKind, EntityRef, EntityType, EntityTypeSuggestion } from '@/domain/entity-types';"
)
replace(
    'src/db/types.ts',
    "  detector?: string;\n  status: CandidateStatus;",
    "  detector?: string;\n  typeSuggestions?: EntityTypeSuggestion[];\n  interpretation?: { kind: CandidateInterpretationKind; note: string };\n  status: CandidateStatus;"
)
replace(
    'src/services/extraction/session.ts',
    "      detector: c.detector,\n    }))",
    "      detector: c.detector,\n      typeSuggestions: c.typeSuggestions,\n      interpretation: c.interpretation,\n    }))"
)

# Contextual quality model: preserve ambiguity instead of suppressing it.
quality = r'''import type {
  CandidateInterpretationKind,
  EntityType,
  EntityTypeSuggestion,
} from '@/domain/entity-types';
import type { KnownEntity } from './known-index';
import { NER_STOPWORDS } from './ner-lexicon';

export interface QualityOccurrence { start: number; end: number; atSentenceStart: boolean }
export interface CandidateQuality {
  canonical: string;
  aliases: string[];
  rejectReason: string | null;
  forcedType: EntityType | null;
  signal: string | null;
  confidenceFloor: number;
  confidenceCap: number;
  typeSuggestions: EntityTypeSuggestion[];
  interpretation: { kind: CandidateInterpretationKind; note: string } | null;
}

const CONTRACTIONS = new Set(["i'm","i've","i'll","i'd","you're","you've","you'll","we're","we've","we'll","they're","they've","they'll","he's","she's","it's","that's","there's","here's","what's","who's","don't","doesn't","didn't","can't","won't","wouldn't","couldn't","shouldn't"]);
const HARD_NON_ENTITY_WORDS = new Set(['yes','no','okay','fine','right','wrong','sorry','thanks','please','morning','afternoon','evening','night','today','tomorrow','yesterday','blood','reach']);
const COMMAND_WORDS = new Set(['run','stop','go','look','wait','help','hide','fight','move','stay','leave','return']);
const SOUND_WORDS = new Set(['slap','bang','crash','thud','boom','clang','click','snap','hiss','gasp','sigh','scream']);
const NATIONALITY_WORDS = new Set(['british','english','welsh','scottish','irish','american','european','northern','southern','western','eastern']);
const ROLE_OR_EPITHET = /\b(?:strongest|weakest|greatest|best|worst|champion|evader|berserker|warrior|knight|mage|wizard|hunter|assassin|soldier|captain|commander|warden|king|queen|prince|princess|lord|lady|doctor|professor|hero|villain|chosen one)\b/i;
const CLASS_END = /\b(?:berserker|warrior|knight|mage|wizard|sorcerer|warlock|hunter|assassin|rogue|paladin|cleric|druid|monk|ranger|bard|necromancer|artificer|guardian|reaver|dreadknight)\b$/i;
const LOCATION_END = /\b(?:street|road|lane|avenue|bridge|station|hospital|school|university|shop|store|market|centre|center|park|square|district|quarter|town|city|village|castle|keep|tower|fort|fortress|temple|church|abbey|inn|tavern|hotel|river|lake|sea|island|isle|forest|woods|moor|marsh|valley|mountain|mountains|harbour|harbor|port|palace|hall|gardens?|land)\b/i;
const ITEM_END = /\b(?:knife|sword|blade|dagger|axe|hammer|shield|gun|rifle|pistol|bow|spear|staff|wand|ring|key|phone|book|tome|scroll|potion|bottle|bag|coin|card|ticket|badge|helmet|armour|armor|boots|gloves|cloak|vest|snickers)\b/i;
const ITEM_CONTEXT = /\b(?:held|carried|wielded|drew|raised|grabbed|dropped|used|wore|equipped|found|bought|stole|saved|ate|opened|brandished|cut|stabbed|slashed)\b/i;
const SOFTWARE_CONTEXT = /\b(?:software|app|program|system|screen|website|platform|database|terminal|interface|ai)\b/i;

function words(value: string): string[] { return value.trim().split(/\s+/).filter(Boolean); }
function localContext(text: string, occurrence: QualityOccurrence) {
  return {
    before: text.slice(Math.max(0, occurrence.start - 96), occurrence.start),
    after: text.slice(occurrence.end, Math.min(text.length, occurrence.end + 96)),
  };
}
function displayCase(value: string): string {
  const connectors = new Set(['a','an','the','and','or','of','with','to','in','on','for']);
  return value.toLowerCase().split(/\s+/).map((token, index) => {
    if (index > 0 && connectors.has(token)) return token;
    return token ? token[0].toUpperCase() + token.slice(1) : token;
  }).join(' ');
}
function ranked(...suggestions: EntityTypeSuggestion[]): EntityTypeSuggestion[] {
  const byType = new Map<EntityType, EntityTypeSuggestion>();
  for (const suggestion of suggestions) {
    const prior = byType.get(suggestion.type);
    if (!prior || suggestion.confidence > prior.confidence) byType.set(suggestion.type, suggestion);
  }
  return [...byType.values()].sort((a, b) => b.confidence - a.confidence);
}

export function canonicalizeSurface(surface: string, entities: KnownEntity[]): { canonical: string; aliases: string[] } {
  let value = surface.replace(/[“”"]/g, '').replace(/[‘’]/g, "'").replace(/^[\s,;:!?—–-]+|[\s,;:!?—–-]+$/g, '').replace(/\s+/g, ' ').trim();
  const aliases: string[] = [];
  const possessive = value.match(/^(.+?)'s$/i);
  if (possessive && possessive[1].length >= 2) {
    const base = possessive[1].trim();
    const known = entities.some((entity) => [entity.name, ...(entity.aliases ?? [])].some((name) => name.toLowerCase() === base.toLowerCase()));
    if (known || /^[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)*$/u.test(base)) { aliases.push(value); value = base; }
  }
  return { canonical: value, aliases };
}

export function likelyPersonName(value: string): boolean {
  const tokenList = words(value);
  if (tokenList.length < 2 || tokenList.length > 4) return false;
  if (ROLE_OR_EPITHET.test(value) || LOCATION_END.test(value) || ITEM_END.test(value)) return false;
  return tokenList.every((token) => /^[A-Z][\p{L}'’-]+$/u.test(token));
}

export function assessCandidateQuality(input: { text: string; surface: string; occurrences: QualityOccurrence[]; entities: KnownEntity[] }): CandidateQuality {
  const normalized = canonicalizeSurface(input.surface, input.entities);
  const original = normalized.canonical;
  let canonical = original;
  const contexts = input.occurrences.map((occurrence) => localContext(input.text, occurrence));
  const joined = contexts.map((context) => `${context.before} ${context.after}`).join(' ');
  const immediateHuman = contexts.some(({ before, after }) => /\b(?:said|asked|called|named)\s*$/i.test(before) || /^\s*(?:said|asked|replied|shouted|whispered|hissed|muttered|was|is|had|has|looked|stood|ran|walked|nodded|grabbed|held|wore|believed|thought|knew|felt)\b/i.test(after));
  const vocative = contexts.some(({ before, after }) => /[,"“]\s*$/u.test(before) || /^\s*[,!?."”]/u.test(after));
  const locationCue = contexts.some(({ before }) => /\b(?:city|town|village|keep|castle|fortress|river|forest|district|street|road|port|island|realm|kingdom)\s+of\s+$|\b(?:to|into|at|inside|outside|near|beyond|through|across|past|reached|entered|returned\s+to|arrived\s+at|visited|looted|raided)\s+$/i.test(before));
  const skillCue = contexts.some(({ before }) => /\b(?:skill|spell|ability|technique|power|talent|art|incantation|maneuver|manoeuvre)\s+(?:(?:called|named|known\s+as)\s+)?$/i.test(before));
  const eventCue = contexts.some(({ after }) => /^\s+(?:began|started|ended|occurred|happened|erupted|fell|rose)\b/i.test(after));
  const displayCue = contexts.some(({ before }) => /\b(?:screen|display|terminal|interface|single word|command|prompt)\b[^.!?]{0,48}:?\s*$/i.test(before));
  const allCaps = /[A-Z]/.test(original) && original === original.toUpperCase();
  const originalLower = original.toLowerCase().replace(/[’]/g, "'");
  const originalTokens = words(original);

  const result: CandidateQuality = {
    canonical,
    aliases: normalized.aliases,
    rejectReason: null,
    forcedType: null,
    signal: null,
    confidenceFloor: 0,
    confidenceCap: 0.92,
    typeSuggestions: [],
    interpretation: null,
  };

  if (!canonical || canonical.length < 2) result.rejectReason = 'empty-or-short';
  else if (originalTokens.length === 1 && CONTRACTIONS.has(originalLower)) result.rejectReason = 'pronoun-contraction';
  else if (NER_STOPWORDS.has(originalLower)) result.rejectReason = 'stopword';
  else if (/^(?:i|you|he|she|it|we|they|this|that|these|those)$/i.test(original)) result.rejectReason = 'pronoun';
  else if (HARD_NON_ENTITY_WORDS.has(originalLower)) result.rejectReason = 'generic-non-entity';
  if (result.rejectReason) return result;

  // Shouted or displayed phrases can be objectives, quests, skills or events.
  if (allCaps && originalTokens.length >= 3) {
    canonical = displayCase(original);
    result.canonical = canonical;
    result.forcedType = 'quests';
    result.signal = 'shouted-objective';
    result.confidenceFloor = 0.44;
    result.confidenceCap = 0.6;
    result.typeSuggestions = ranked(
      { type: 'quests', confidence: 0.44, reason: 'Reads like a named objective or memorable mission phrase' },
      { type: 'skills', confidence: 0.34, reason: 'Could be a named move, command or triggered ability' },
      { type: 'events', confidence: 0.3, reason: 'Could label a recurring incident or scene beat' },
      { type: 'lore', confidence: 0.24, reason: 'Could be a repeated in-world phrase or canon saying' },
    );
    result.interpretation = { kind: 'objective', note: 'Unusual phrase preserved for review rather than discarded.' };
    return result;
  }

  if (COMMAND_WORDS.has(originalLower)) {
    if (allCaps || displayCue || input.occurrences.length >= 2) {
      result.canonical = original[0].toUpperCase() + original.slice(1).toLowerCase();
      result.forcedType = 'skills';
      result.signal = 'command-word';
      result.confidenceFloor = 0.4;
      result.confidenceCap = 0.56;
      result.typeSuggestions = ranked(
        { type: 'skills', confidence: 0.42, reason: 'Displayed or repeated command may name a skill' },
        { type: 'quests', confidence: 0.34, reason: 'Could be a direct objective or quest prompt' },
        { type: 'abilities', confidence: 0.3, reason: 'Could be a triggered ability or system command' },
      );
      result.interpretation = { kind: 'command', note: 'Command preserved at low certainty.' };
      return result;
    }
    result.rejectReason = 'unsupported-command';
    return result;
  }

  if (SOUND_WORDS.has(originalLower)) {
    if (input.occurrences.length >= 2) {
      result.forcedType = 'skills';
      result.signal = 'repeated-sound-or-move';
      result.confidenceFloor = 0.38;
      result.confidenceCap = 0.54;
      result.typeSuggestions = ranked(
        { type: 'skills', confidence: 0.4, reason: 'Repeated beat may be a named move or attack pattern' },
        { type: 'abilities', confidence: 0.35, reason: 'Could be a triggered ability or effect' },
        { type: 'events', confidence: 0.24, reason: 'Could be an important repeated story beat' },
      );
      result.interpretation = { kind: 'sound', note: 'Repeated sound retained as a possible move or ability.' };
      return result;
    }
    result.rejectReason = 'unsupported-sound';
    return result;
  }

  if (NATIONALITY_WORDS.has(originalLower)) {
    result.forcedType = 'races';
    result.signal = 'nationality-or-origin';
    result.confidenceFloor = 0.36;
    result.confidenceCap = 0.5;
    result.typeSuggestions = ranked(
      { type: 'races', confidence: 0.38, reason: 'Could represent nationality, ancestry or origin' },
      { type: 'factions', confidence: 0.28, reason: 'Could identify a cultural or political grouping' },
      { type: 'lore', confidence: 0.22, reason: 'Could be setting context rather than a tracked entity' },
    );
    result.interpretation = { kind: 'nationality', note: 'Nationality retained at low certainty.' };
    return result;
  }

  if (allCaps && SOFTWARE_CONTEXT.test(joined)) {
    canonical = displayCase(original);
    result.canonical = canonical;
    result.forcedType = 'cast';
    result.signal = 'named-digital-character';
    result.confidenceFloor = 0.44;
    result.confidenceCap = 0.58;
    result.typeSuggestions = ranked(
      { type: 'cast', confidence: 0.46, reason: 'Named software may be a sentient or character-like presence' },
      { type: 'items', confidence: 0.38, reason: 'Could be a tool, program or device treated as an item' },
      { type: 'lore', confidence: 0.28, reason: 'Could be world-system terminology rather than a character' },
    );
    result.interpretation = { kind: 'software', note: 'Named software retained because it may function as cast.' };
    return result;
  }

  const lower = canonical.toLowerCase();
  const tokenList = words(canonical);
  if (tokenList.length > 8 || /[.!?][\s\S]/.test(canonical)) {
    result.rejectReason = 'sentence-fragment';
    return result;
  }

  if (skillCue) {
    result.forcedType = 'skills'; result.signal = 'skill-cue'; result.confidenceFloor = 0.78;
    result.typeSuggestions = [{ type: 'skills', confidence: 0.84, reason: 'Explicitly introduced as a skill, spell or ability' }];
    return result;
  }
  if (eventCue) {
    result.forcedType = 'events'; result.signal = 'event-cue'; result.confidenceFloor = 0.78;
    result.typeSuggestions = [{ type: 'events', confidence: 0.84, reason: 'Explicit event verb follows the name' }];
    return result;
  }
  if (locationCue || /land$/i.test(canonical)) {
    result.forcedType = 'locations'; result.signal = 'location-cue'; result.confidenceFloor = /land$/i.test(canonical) ? 0.68 : 0.76;
    result.typeSuggestions = ranked(
      { type: 'locations', confidence: result.confidenceFloor, reason: 'Appears in movement, visit or place context' },
      { type: 'factions', confidence: 0.22, reason: 'A proper name ending in land could also describe a group or realm' },
    );
    return result;
  }
  if (CLASS_END.test(canonical)) {
    result.forcedType = 'classes'; result.signal = 'class-name'; result.confidenceFloor = 0.72;
    result.typeSuggestions = ranked(
      { type: 'classes', confidence: 0.78, reason: 'Ends in a class or archetype term' },
      { type: 'cast', confidence: 0.34, reason: 'Could instead be a title or alias belonging to a character' },
    );
    return result;
  }
  if (ITEM_END.test(canonical) && ITEM_CONTEXT.test(joined)) {
    result.forcedType = 'items'; result.signal = 'item-context'; result.confidenceFloor = 0.72;
    result.typeSuggestions = [{ type: 'items', confidence: 0.8, reason: 'Concrete object used or carried in the prose' }];
    return result;
  }
  if (LOCATION_END.test(canonical)) {
    result.forcedType = 'locations'; result.signal = 'location-name'; result.confidenceFloor = 0.7;
    result.typeSuggestions = [{ type: 'locations', confidence: 0.74, reason: 'Name has a place-form ending' }];
    return result;
  }
  if (likelyPersonName(canonical)) {
    result.forcedType = 'cast'; result.signal = 'person-name-shape'; result.confidenceFloor = immediateHuman ? 0.82 : 0.72;
    result.typeSuggestions = [{ type: 'cast', confidence: result.confidenceFloor, reason: 'Multi-word human name in character context' }];
    return result;
  }
  if (ROLE_OR_EPITHET.test(canonical)) {
    result.forcedType = 'cast';
    result.signal = 'title-or-alias';
    result.confidenceFloor = 0.44;
    result.confidenceCap = 0.58;
    result.typeSuggestions = ranked(
      { type: 'cast', confidence: 0.46, reason: 'Likely a title, nickname or alias belonging to a character' },
      { type: 'classes', confidence: 0.36, reason: 'Could describe a class or archetype' },
      { type: 'items', confidence: /evader|weapon|blade|shield/i.test(canonical) ? 0.4 : 0.24, reason: 'Could be a named object in this particular sentence' },
    );
    result.interpretation = { kind: 'title', note: 'Prefer linking this phrase to an existing entity as a title or alias.' };
    return result;
  }

  if (tokenList.length === 1) {
    if (immediateHuman || (vocative && input.occurrences.length >= 2)) {
      result.forcedType = 'cast'; result.signal = 'named-person-context'; result.confidenceFloor = 0.76;
      result.typeSuggestions = [{ type: 'cast', confidence: 0.8, reason: 'Used as a speaking or addressed character name' }];
    } else if (input.occurrences.length < 3) {
      result.rejectReason = 'unsupported-single-token';
    } else {
      result.confidenceCap = 0.56;
      result.typeSuggestions = ranked(
        { type: 'cast', confidence: 0.48, reason: 'Repeated capitalised name may identify a character' },
        { type: 'locations', confidence: 0.3, reason: 'Could instead be a place name' },
        { type: 'items', confidence: 0.24, reason: 'Could instead be a named object' },
      );
      result.interpretation = { kind: 'ambiguous', note: 'Repeated proper noun retained for user interpretation.' };
    }
  }
  if (/^[A-Z]{2,}$/.test(canonical) && !result.forcedType) result.rejectReason = 'unintroduced-all-caps-token';
  if (!result.typeSuggestions.length && result.forcedType) {
    result.typeSuggestions = [{ type: result.forcedType, confidence: result.confidenceFloor, reason: result.signal ?? 'Contextual interpretation' }];
  }
  void lower;
  return result;
}
'''
write('src/services/extraction/quality.ts', quality)

# Discovery: persist interpretations and add repeated common-item discovery.
replace(
    'src/services/extraction/discovery.ts',
    "        suggestedChanges: aliases.length ? { aliases: [...new Set(aliases)] } : null,\n        summary:",
    "        suggestedChanges: aliases.length ? { aliases: [...new Set(aliases)] } : null,\n        typeSuggestions: quality.typeSuggestions,\n        interpretation: quality.interpretation ?? undefined,\n        summary:"
)

common_items = r'''
const COMMON_ITEM_RE = /\b(?:(bread|kitchen|combat|hunting|pocket|butter|ritual|ceremonial|silver|iron|steel|wooden|old|rusted)\s+)?(knife|sword|blade|dagger|axe|hammer|shield|gun|rifle|pistol|bow|spear|staff|wand|ring|key|phone|book|scroll|potion|bottle|bag|coin|card|ticket|badge|helmet|armour|armor|boots|gloves|cloak|vest)\b/gi;

/** Repeated concrete object nouns are useful even when prose does not capitalise
 * them. This deliberately requires recurrence so ordinary scenery does not flood
 * Review. The user still receives a low-certainty interpretation and can retype. */
export function discoverCommonItems(text: string, entities: KnownEntity[]): ExtractionCandidate[] {
  const groups = new Map<string, { starts: { start: number; end: number; exact: string }[]; aliases: Set<string> }>();
  let match: RegExpExecArray | null;
  COMMON_ITEM_RE.lastIndex = 0;
  while ((match = COMMON_ITEM_RE.exec(text)) !== null) {
    const noun = match[2].toLowerCase();
    const exact = match[0];
    const group = groups.get(noun) ?? { starts: [], aliases: new Set<string>() };
    group.starts.push({ start: match.index, end: match.index + match[0].length, exact });
    if (exact.toLowerCase() !== noun) group.aliases.add(exact.toLowerCase());
    groups.set(noun, group);
  }
  const out: ExtractionCandidate[] = [];
  for (const [noun, group] of groups) {
    if (group.starts.length < 2) continue;
    const name = noun[0].toUpperCase() + noun.slice(1);
    const known = findKnownEntityMention(name, entities.filter((entity) => entity.type === 'items'), { threshold: 0.92 });
    if (known?.matchType === 'exact' || known?.matchType === 'nickname') continue;
    const representative = group.starts[0];
    out.push(buildCandidate({
      entityType: 'items',
      name,
      suggestedAction: known ? 'merge' : 'create',
      matchType: known ? 'ambiguous' : 'new',
      existingEntityId: known?.entity.id ?? null,
      confidence: Math.min(0.52 + group.starts.length * 0.035, 0.66),
      sourceQuote: makeSourceQuote(text, representative.start, representative.end),
      sourceQuotes: group.starts.slice(0, 4).map((occurrence) => makeSourceQuote(text, occurrence.start, occurrence.end)),
      start: representative.start,
      end: representative.end,
      suggestedChanges: group.aliases.size ? { aliases: [...group.aliases] } : null,
      typeSuggestions: [
        { type: 'items', confidence: 0.64, reason: 'Repeated concrete object noun in the chapter' },
        { type: 'skills', confidence: 0.2, reason: 'Could be a move name if used figuratively' },
      ],
      interpretation: { kind: 'generic-item', note: 'Repeated uncapitalised object retained as a possible tracked item.' },
      summary: `“${name}” appears ${group.starts.length}× as a concrete object.`,
      detector: 'ner:repeated-common-item',
    }));
  }
  return out;
}

'''
replace(
    'src/services/extraction/discovery.ts',
    "/** Cluster near-duplicate discovery candidates of the same type. */",
    common_items + "/** Cluster near-duplicate discovery candidates of the same type. */"
)

replace(
    'src/services/extraction/engine.ts',
    "import { clusterAliases, discoverEntities } from './discovery';",
    "import { clusterAliases, discoverCommonItems, discoverEntities } from './discovery';"
)
replace(
    'src/services/extraction/engine.ts',
    "  const discovered = clusterAliases(discoverEntities(text, entities, { minRecurrence }));",
    "  const discovered = clusterAliases([\n    ...discoverEntities(text, entities, { minRecurrence }),\n    ...discoverCommonItems(text, entities),\n  ]);"
)

# Retyping a pending interpretation updates its provisional occurrences too.
replace(
    'src/db/repos/review.ts',
    "import type { Entity, ReviewCandidate } from '../types';",
    "import type { Entity, ReviewCandidate } from '../types';\nimport type { EntityType } from '@/domain/entity-types';"
)
retype_fn = r'''
export async function retypeCandidates(ids: string[], entityType: EntityType): Promise<number> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return 0;
  const rows = (await db.candidates.bulkGet(uniqueIds)).filter((row): row is ReviewCandidate => Boolean(row && row.status === 'pending'));
  if (!rows.length) return 0;
  await db.transaction('rw', db.candidates, db.occurrences, async () => {
    for (const row of rows) {
      await db.candidates.update(row.id, {
        entityType,
        existingEntityId: null,
        suggestedAction: 'create',
        matchType: 'new',
      });
      await db.occurrences.where('candidateId').equals(row.id).modify({ entityType });
    }
  });
  await logAudit({
    projectId: rows[0].projectId,
    action: 'review.retype',
    target: { table: 'candidates', id: rows[0].id, label: rows.map((row) => row.name).join(', ') },
    before: { entityTypes: [...new Set(rows.map((row) => row.entityType))] },
    after: { entityType, candidateIds: rows.map((row) => row.id) },
  });
  return rows.length;
}

'''
replace(
    'src/db/repos/review.ts',
    "/** Insert fresh candidates for a chapter, replacing its pending ones.",
    retype_fn + "/** Insert fresh candidates for a chapter, replacing its pending ones."
)

# Review UI: ranked suggestions and editable interpretation.
replace(
    'src/features/review/ReviewSurface.tsx',
    "import { acceptCandidate, denyCandidate, listPendingCandidates } from '@/db/repos/review';",
    "import { acceptCandidate, denyCandidate, listPendingCandidates, retypeCandidates } from '@/db/repos/review';"
)
replace(
    'src/features/review/ReviewSurface.tsx',
    "import { ENTITY_TYPE_META } from '@/domain/entity-types';",
    "import { ALL_ENTITY_TYPES, ENTITY_TYPE_META, type EntityType, type EntityTypeSuggestion } from '@/domain/entity-types';"
)
replace(
    'src/features/review/ReviewSurface.tsx',
    "  const acceptNew = async (candidate: ReviewCandidate) => {",
    "  const retypeCluster = async (candidateIds: string[], entityType: EntityType, label: string) => {\n    const changed = await retypeCandidates(candidateIds, entityType);\n    if (changed) toast(`${label} will now be reviewed as ${ENTITY_TYPE_META[entityType].label}.`, { kind: 'success' });\n  };\n\n  const acceptNew = async (candidate: ReviewCandidate) => {"
)
smart_control = r'''
                <InterpretationControl
                  currentType={cluster.entityType}
                  candidates={cluster.candidates}
                  onChange={(entityType) => void retypeCluster(cluster.candidateIds, entityType, cluster.primaryName)}
                />

'''
replace(
    'src/features/review/ReviewSurface.tsx',
    "                <div className=\"lw-identitycard__title\">",
    smart_control + "                <div className=\"lw-identitycard__title\">"
)
raw_control = r'''
                <InterpretationControl
                  currentType={candidate.entityType}
                  candidates={[candidate]}
                  onChange={(entityType) => void retypeCluster([candidate.id], entityType, candidate.name)}
                />
'''
# Insert in raw card only, using the second qcard top close adjacent to h2.
replace(
    'src/features/review/ReviewSurface.tsx',
    "                </div>\n                <h2 className=\"lw-qcard__name\">\n                  {candidate.name}",
    "                </div>\n" + raw_control + "                <h2 className=\"lw-qcard__name\">\n                  {candidate.name}"
)
component = r'''
function InterpretationControl({
  currentType,
  candidates,
  onChange,
}: {
  currentType: EntityType;
  candidates: ReviewCandidate[];
  onChange: (entityType: EntityType) => void;
}) {
  const byType = new Map<EntityType, EntityTypeSuggestion>();
  for (const candidate of candidates) {
    for (const suggestion of candidate.typeSuggestions ?? []) {
      const prior = byType.get(suggestion.type);
      if (!prior || suggestion.confidence > prior.confidence) byType.set(suggestion.type, suggestion);
    }
  }
  const suggestions = [...byType.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 4);
  const notes = [...new Set(candidates.map((candidate) => candidate.interpretation?.note).filter(Boolean))];
  return (
    <div className="lw-interpretation" onPointerDown={(event) => event.stopPropagation()}>
      <label>
        <span>Interpret as</span>
        <select
          className="lw-input"
          value={currentType}
          onChange={(event) => onChange(event.target.value as EntityType)}
          aria-label={`Interpret ${candidates[0]?.name ?? 'candidate'} as entity type`}
        >
          {ALL_ENTITY_TYPES.map((entityType) => (
            <option key={entityType} value={entityType}>{ENTITY_TYPE_META[entityType].label}</option>
          ))}
        </select>
      </label>
      {suggestions.length ? (
        <div className="lw-interpretation__suggestions" aria-label="Suggested entity types">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.type}
              type="button"
              className={suggestion.type === currentType ? 'lw-chip lw-chip--static lw-chip--selected' : 'lw-chip lw-chip--static'}
              title={suggestion.reason}
              onClick={() => onChange(suggestion.type)}
            >
              {ENTITY_TYPE_META[suggestion.type].label} {Math.round(suggestion.confidence * 100)}%
            </button>
          ))}
        </div>
      ) : null}
      {notes.length ? <p>{notes.join(' ')}</p> : null}
    </div>
  );
}

'''
replace(
    'src/features/review/ReviewSurface.tsx',
    "function shortValue(value: unknown): string {",
    component + "function shortValue(value: unknown): string {"
)

# Lightweight styling.
css_path = 'src/styles/components.css'
css = read(css_path)
if '.lw-interpretation {' not in css:
    css += r'''

.lw-interpretation {
  margin: .55rem 0 .35rem;
  padding: .55rem .65rem;
  border: 1px solid color-mix(in srgb, var(--lw-line) 80%, transparent);
  border-radius: .6rem;
  background: color-mix(in srgb, var(--lw-paper) 82%, transparent);
}
.lw-interpretation > label { display: flex; align-items: center; gap: .55rem; font-size: .72rem; font-weight: 700; }
.lw-interpretation select { width: auto; min-width: 9rem; padding-block: .3rem; }
.lw-interpretation__suggestions { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .45rem; }
.lw-interpretation__suggestions button { cursor: pointer; }
.lw-interpretation .lw-chip--selected { outline: 2px solid var(--lw-accent); outline-offset: 1px; }
.lw-interpretation > p { margin: .4rem 0 0; font-size: .72rem; color: var(--lw-muted); }
'''
    write(css_path, css)

# Quality regression suite, matching the user's concrete corrections.
test = r'''import { describe, expect, it } from 'vitest';
import { runLocalExtraction } from '@/services/extraction/engine';
import type { KnownEntity } from '@/services/extraction/known-index';

const nuancedChapter = `
Blood welled through the torn fabric of the hi-vis vest he'd been wearing since the Jobcentre, back when he'd been Graham Hendricks.
Dreadknight Berserker Graham Hendricks still believed you should wear what the system gave you.

"You're bleeding!" Pipkins was at his side instantly.
"It's fine," Graham said.
"It's not fine, you dense prick! IT'S A SWAN WITH A KNIFE, GRIMGUFF. THERE'S NO SPEECH FOR THIS."

Grimguff looked. The bread knife had no business looking so professional.
Slap. Slap. Slap.
The screen glitched. Went black. Then a single word: RUN.
"I'm not dying in a car park," Graham said.
A Snickers he'd been saving for tactical sustenance rolled from his pocket.
They had looted Poundland before Gerald Swan found them.
Darren Fletchley waved from across the road.
The CLAIMWISE software lit up on the terminal.
British rain rattled against the windows.
Graham had once won West Midlands Strongest Man.
Grimguff raised Council-Tax-Evader and aimed it at the swan.
`;

function candidate(result: ReturnType<typeof runLocalExtraction>, name: string) {
  return result.candidates.find((row) => row.name.toLowerCase() === name.toLowerCase());
}

describe('nuanced contextual discovery', () => {
  it('keeps real entities and preserves uncertain interpretations at lower confidence', () => {
    const result = runLocalExtraction({ text: nuancedChapter, entities: [] });

    expect(candidate(result, 'Graham Hendricks')?.entityType).toBe('cast');
    expect(candidate(result, 'Pipkins')?.entityType).toBe('cast');
    expect(candidate(result, 'Grimguff')?.entityType).toBe('cast');
    expect(candidate(result, 'Gerald Swan')?.entityType).toBe('cast');
    expect(candidate(result, 'Darren Fletchley')?.entityType).toBe('cast');
    expect(candidate(result, 'Dreadknight Berserker')?.entityType).toBe('classes');
    expect(candidate(result, 'Poundland')?.entityType).toBe('locations');
    expect(candidate(result, 'Knife')?.entityType).toBe('items');

    expect(candidate(result, 'Slap')?.entityType).toBe('skills');
    expect(candidate(result, 'Slap')?.confidence).toBeLessThan(0.6);
    expect(candidate(result, 'Run')?.entityType).toBe('skills');
    expect(candidate(result, "It's a Swan with a Knife")?.entityType).toBe('quests');
    expect(candidate(result, 'Claimwise')?.entityType).toBe('cast');
    expect(candidate(result, 'West Midlands Strongest Man')?.interpretation?.kind).toBe('title');
    expect(candidate(result, 'Council-Tax-Evader')?.typeSuggestions?.some((suggestion) => suggestion.type === 'items')).toBe(true);
    expect(candidate(result, 'British')?.typeSuggestions?.[0]?.type).toBe('races');

    expect(result.candidates.map((row) => row.name)).not.toContain("I'm");
  });

  it('normalises possessives and resolves them to an existing entity', () => {
    const entities: KnownEntity[] = [
      { id: 'cast-grimguff', type: 'cast', name: 'Grimguff', aliases: [] },
    ];
    const result = runLocalExtraction({
      text: "Grimguff's stomach clenched. Grimguff's coat was torn.",
      entities,
    });
    expect(result.candidates.map((row) => row.name)).not.toContain("Grimguff's");
    expect(result.occurrences.filter((occurrence) => occurrence.entityId === 'cast-grimguff').length).toBeGreaterThanOrEqual(2);
  });
});
'''
write('tests/unit/extraction-quality.spec.ts', test)
