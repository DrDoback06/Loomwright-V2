import type { EntityType } from '@/domain/entity-types';
import type { KnownEntity } from './known-index';
import { NER_STOPWORDS } from './ner-lexicon';

export interface QualityOccurrence {
  start: number;
  end: number;
  atSentenceStart: boolean;
}

export interface CandidateQuality {
  canonical: string;
  aliases: string[];
  rejectReason: string | null;
  forcedType: EntityType | null;
  signal: string | null;
  confidenceFloor: number;
  confidenceCap: number;
}

const CONTRACTIONS = new Set([
  "i'm", "i’ve", "i've", "i’ll", "i'll", "i’d", "i'd",
  "you're", "you’re", "you've", "you’ve", "you'll", "you’ll",
  "we're", "we’re", "we've", "we’ve", "we'll", "we’ll",
  "they're", "they’re", "they've", "they’ve", "they'll", "they’ll",
  "he's", "he’s", "she's", "she’s", "it's", "it’s", "that's", "that’s",
  "there's", "there’s", "here's", "here’s", "what's", "what’s", "who's", "who’s",
  "don't", "don’t", "doesn't", "doesn’t", "didn't", "didn’t", "can't", "can’t",
  "won't", "won’t", "wouldn't", "wouldn’t", "couldn't", "couldn’t", "shouldn't", "shouldn’t",
]);

const NON_ENTITY_WORDS = new Set([
  'british','english','welsh','scottish','irish','american','european','northern','southern','western','eastern',
  'run','stop','go','look','wait','help','yes','no','okay','fine','right','wrong','sorry','thanks','please',
  'slap','bang','crash','thud','boom','clang','click','snap','hiss','gasp','sigh','scream','silence',
  'morning','afternoon','evening','night','today','tomorrow','yesterday',
]);

const ROLE_OR_EPITHET = /\b(?:strongest|weakest|greatest|best|worst|champion|evader|berserker|warrior|knight|mage|wizard|hunter|assassin|soldier|captain|commander|warden|king|queen|prince|princess|lord|lady|doctor|professor|hero|villain|chosen one)\b/i;
const CLASS_END = /\b(?:berserker|warrior|knight|mage|wizard|sorcerer|warlock|hunter|assassin|rogue|paladin|cleric|druid|monk|ranger|bard|necromancer|artificer|guardian|reaver|dreadknight)\b$/i;
const LOCATION_END = /\b(?:street|road|lane|avenue|bridge|station|hospital|school|university|shop|store|market|centre|center|park|square|district|quarter|town|city|village|castle|keep|tower|fort|fortress|temple|church|abbey|inn|tavern|hotel|river|lake|sea|island|isle|forest|woods|moor|marsh|valley|mountain|mountains|harbour|harbor|port|palace|hall|gardens?)\b/i;
const ITEM_END = /\b(?:knife|sword|blade|dagger|axe|hammer|shield|gun|rifle|pistol|bow|spear|staff|wand|ring|key|phone|book|tome|scroll|potion|bottle|bag|coin|card|ticket|badge|helmet|armour|armor|boots|gloves|cloak|vest|snickers)\b/i;
const HUMAN_CONTEXT = /\b(?:said|asked|replied|shouted|whispered|hissed|muttered|laughed|smiled|looked|nodded|walked|ran|stood|sat|grabbed|held|wore|believed|thought|knew|felt|his|her|their|he|she|they)\b/i;
const LOCATION_CONTEXT = /\b(?:at|in|inside|outside|near|from|to|toward|towards|entered|left|reached|arrived|returned|visited|looted|raided|crossed|passed|through)\b/i;
const ITEM_CONTEXT = /\b(?:held|carried|wielded|drew|raised|grabbed|dropped|used|wore|equipped|found|bought|stole|saved|ate|opened|brandished)\b/i;
const SOFTWARE_CONTEXT = /\b(?:software|app|program|system|screen|website|platform|database|terminal)\b/i;

function words(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

function sentenceWindow(text: string, start: number, end: number, radius = 120): string {
  return text.slice(Math.max(0, start - radius), Math.min(text.length, end + radius));
}

export function canonicalizeSurface(surface: string, entities: KnownEntity[]): { canonical: string; aliases: string[] } {
  let value = surface
    .replace(/[“”"‘’]/g, (char) => (char === '’' || char === '‘' ? "'" : ''))
    .replace(/^[\s,;:!?—–-]+|[\s,;:!?—–-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const aliases: string[] = [];
  const possessive = value.match(/^(.+?)'s$/i);
  if (possessive && possessive[1].length >= 2) {
    const base = possessive[1].trim();
    const known = entities.some((entity) =>
      [entity.name, ...(entity.aliases ?? [])].some((name) => name.toLowerCase() === base.toLowerCase())
    );
    if (known || /^[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)*$/u.test(base)) {
      aliases.push(value);
      value = base;
    }
  }
  return { canonical: value, aliases };
}

export function likelyPersonName(value: string): boolean {
  const tokenList = words(value);
  if (tokenList.length < 2 || tokenList.length > 4) return false;
  if (ROLE_OR_EPITHET.test(value) || LOCATION_END.test(value) || ITEM_END.test(value)) return false;
  return tokenList.every((token) => /^[A-Z][\p{L}'’-]+$/u.test(token));
}

export function assessCandidateQuality(input: {
  text: string;
  surface: string;
  occurrences: QualityOccurrence[];
  entities: KnownEntity[];
}): CandidateQuality {
  const { text, surface, occurrences, entities } = input;
  const normalized = canonicalizeSurface(surface, entities);
  const canonical = normalized.canonical;
  const lower = canonical.toLowerCase();
  const tokenList = words(canonical);
  const windows = occurrences.map((occ) => sentenceWindow(text, occ.start, occ.end));
  const joinedContext = windows.join(' ');

  const result: CandidateQuality = {
    canonical,
    aliases: normalized.aliases,
    rejectReason: null,
    forcedType: null,
    signal: null,
    confidenceFloor: 0,
    confidenceCap: 0.92,
  };

  if (!canonical || canonical.length < 2) result.rejectReason = 'empty-or-short';
  else if (CONTRACTIONS.has(lower)) result.rejectReason = 'pronoun-contraction';
  else if (NON_ENTITY_WORDS.has(lower)) result.rejectReason = 'command-adjective-or-sound';
  else if (NER_STOPWORDS.has(lower)) result.rejectReason = 'stopword';
  else if (/^(?:i|you|he|she|it|we|they|this|that|these|those)$/i.test(canonical)) result.rejectReason = 'pronoun';
  else if (/^[A-Z]{2,}$/.test(canonical) && !SOFTWARE_CONTEXT.test(joinedContext)) result.rejectReason = 'unintroduced-all-caps-token';
  else if (tokenList.length > 6) result.rejectReason = 'sentence-sized-span';
  else if (/[.!?][\s\S]/.test(canonical)) result.rejectReason = 'sentence-fragment';
  else {
    const lowerTokens = tokenList.map((token) => token.toLowerCase());
    const functionWords = lowerTokens.filter((token) => NER_STOPWORDS.has(token)).length;
    if (tokenList.length >= 4 && functionWords / tokenList.length >= 0.35) result.rejectReason = 'clause-not-entity';
  }

  if (result.rejectReason) return result;

  if (CLASS_END.test(canonical)) {
    result.forcedType = 'classes';
    result.signal = 'class-name';
    result.confidenceFloor = 0.72;
    return result;
  }

  if (ITEM_END.test(canonical) && ITEM_CONTEXT.test(joinedContext)) {
    result.forcedType = 'items';
    result.signal = 'item-context';
    result.confidenceFloor = 0.72;
    return result;
  }

  if (LOCATION_END.test(canonical)) {
    result.forcedType = 'locations';
    result.signal = 'location-name';
    result.confidenceFloor = 0.74;
    return result;
  }

  if (likelyPersonName(canonical)) {
    result.forcedType = 'cast';
    result.signal = 'person-name-shape';
    result.confidenceFloor = HUMAN_CONTEXT.test(joinedContext) ? 0.8 : 0.72;
    return result;
  }

  if (ROLE_OR_EPITHET.test(canonical)) {
    result.rejectReason = 'unresolved-title-or-epithet';
    return result;
  }

  if (tokenList.length === 1) {
    if (HUMAN_CONTEXT.test(joinedContext)) {
      result.forcedType = 'cast';
      result.signal = 'named-person-context';
      result.confidenceFloor = 0.74;
    } else if (LOCATION_CONTEXT.test(joinedContext) && occurrences.length >= 2) {
      result.forcedType = 'locations';
      result.signal = 'repeated-place-context';
      result.confidenceFloor = 0.66;
    } else if (ITEM_CONTEXT.test(joinedContext) && ITEM_END.test(canonical)) {
      result.forcedType = 'items';
      result.signal = 'item-context';
      result.confidenceFloor = 0.7;
    } else if (occurrences.length < 3) {
      result.rejectReason = 'unsupported-single-token';
    } else {
      result.confidenceCap = 0.58;
    }
  }

  if (/^[A-Z]{2,}$/.test(canonical) && SOFTWARE_CONTEXT.test(joinedContext)) {
    result.rejectReason = 'software-or-brand-not-world-entity';
  }

  return result;
}
