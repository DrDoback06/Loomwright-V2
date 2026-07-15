import type {
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
