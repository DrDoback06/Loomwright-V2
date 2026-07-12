import type { EntityType } from '@/domain/entity-types';
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
}

const CONTRACTIONS = new Set(["i'm","i've","i'll","i'd","you're","you've","you'll","we're","we've","we'll","they're","they've","they'll","he's","she's","it's","that's","there's","here's","what's","who's","don't","doesn't","didn't","can't","won't","wouldn't","couldn't","shouldn't"]);
const NON_ENTITY_WORDS = new Set(['british','english','welsh','scottish','irish','american','european','northern','southern','western','eastern','run','stop','go','look','wait','help','yes','no','okay','fine','right','wrong','sorry','thanks','please','slap','bang','crash','thud','boom','clang','click','snap','hiss','gasp','sigh','scream','silence','morning','afternoon','evening','night','today','tomorrow','yesterday','blood','reach']);
const ROLE_OR_EPITHET = /\b(?:strongest|weakest|greatest|best|worst|champion|evader|berserker|warrior|knight|mage|wizard|hunter|assassin|soldier|captain|commander|warden|king|queen|prince|princess|lord|lady|doctor|professor|hero|villain|chosen one)\b/i;
const CLASS_END = /\b(?:berserker|warrior|knight|mage|wizard|sorcerer|warlock|hunter|assassin|rogue|paladin|cleric|druid|monk|ranger|bard|necromancer|artificer|guardian|reaver|dreadknight)\b$/i;
const LOCATION_END = /\b(?:street|road|lane|avenue|bridge|station|hospital|school|university|shop|store|market|centre|center|park|square|district|quarter|town|city|village|castle|keep|tower|fort|fortress|temple|church|abbey|inn|tavern|hotel|river|lake|sea|island|isle|forest|woods|moor|marsh|valley|mountain|mountains|harbour|harbor|port|palace|hall|gardens?)\b/i;
const ITEM_END = /\b(?:knife|sword|blade|dagger|axe|hammer|shield|gun|rifle|pistol|bow|spear|staff|wand|ring|key|phone|book|tome|scroll|potion|bottle|bag|coin|card|ticket|badge|helmet|armour|armor|boots|gloves|cloak|vest|snickers)\b/i;
const ITEM_CONTEXT = /\b(?:held|carried|wielded|drew|raised|grabbed|dropped|used|wore|equipped|found|bought|stole|saved|ate|opened|brandished)\b/i;
const SOFTWARE_CONTEXT = /\b(?:software|app|program|system|screen|website|platform|database|terminal)\b/i;

function words(value: string): string[] { return value.trim().split(/\s+/).filter(Boolean); }
function localContext(text: string, occurrence: QualityOccurrence) {
  return {
    before: text.slice(Math.max(0, occurrence.start - 64), occurrence.start),
    after: text.slice(occurrence.end, Math.min(text.length, occurrence.end + 64)),
  };
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
  let canonical = normalized.canonical;
  const contexts = input.occurrences.map((occurrence) => localContext(input.text, occurrence));
  const joined = contexts.map((context) => `${context.before} ${context.after}`).join(' ');
  const immediateHuman = contexts.some(({ before, after }) => /\b(?:said|asked|called|named)\s*$/i.test(before) || /^\s*(?:said|asked|replied|shouted|whispered|hissed|muttered|was|is|had|has|looked|stood|ran|walked|nodded|grabbed|held|wore|believed|thought|knew|felt)\b/i.test(after));
  const vocative = contexts.some(({ before, after }) => /[,"“]\s*$/u.test(before) || /^\s*[,!?."”]/u.test(after));
  const locationCue = contexts.some(({ before }) => /\b(?:city|town|village|keep|castle|fortress|river|forest|district|street|road|port|island|realm|kingdom)\s+of\s+$|\b(?:to|into|at|near|beyond|through|across|past|reached|entered|returned\s+to|arrived\s+at)\s+$/i.test(before));
  const skillCue = contexts.some(({ before }) => /\b(?:skill|spell|ability|technique|power|talent|art|incantation|maneuver|manoeuvre)\s+(?:(?:called|named|known\s+as)\s+)?$/i.test(before));
  const eventCue = contexts.some(({ after }) => /^\s+(?:began|started|ended|occurred|happened|erupted|fell|rose)\b/i.test(after));
  if (/^[A-Z]{2,}$/.test(canonical) && (immediateHuman || vocative || input.occurrences.length >= 2)) canonical = canonical[0] + canonical.slice(1).toLowerCase();
  const lower = canonical.toLowerCase();
  const tokenList = words(canonical);
  const result: CandidateQuality = { canonical, aliases: normalized.aliases, rejectReason: null, forcedType: null, signal: null, confidenceFloor: 0, confidenceCap: 0.92 };

  if (!canonical || canonical.length < 2) result.rejectReason = 'empty-or-short';
  else if (CONTRACTIONS.has(lower.replace(/[’]/g, "'"))) result.rejectReason = 'pronoun-contraction';
  else if (NON_ENTITY_WORDS.has(lower)) result.rejectReason = 'command-adjective-or-sound';
  else if (NER_STOPWORDS.has(lower)) result.rejectReason = 'stopword';
  else if (/^(?:i|you|he|she|it|we|they|this|that|these|those)$/i.test(canonical)) result.rejectReason = 'pronoun';
  else if (/^[A-Z]{2,}$/.test(canonical)) result.rejectReason = SOFTWARE_CONTEXT.test(joined) ? 'software-or-brand-not-world-entity' : 'unintroduced-all-caps-token';
  else if (tokenList.length > 6 || /[.!?][\s\S]/.test(canonical)) result.rejectReason = 'sentence-fragment';
  else if (tokenList.length >= 4 && tokenList.filter((token) => NER_STOPWORDS.has(token.toLowerCase())).length / tokenList.length >= 0.35) result.rejectReason = 'clause-not-entity';
  if (result.rejectReason) return result;

  if (skillCue) { result.forcedType = 'skills'; result.signal = 'skill-cue'; result.confidenceFloor = 0.78; return result; }
  if (eventCue) { result.forcedType = 'events'; result.signal = 'event-cue'; result.confidenceFloor = 0.78; return result; }
  if (locationCue) { result.forcedType = 'locations'; result.signal = 'location-cue'; result.confidenceFloor = 0.76; return result; }
  if (CLASS_END.test(canonical)) { result.forcedType = 'classes'; result.signal = 'class-name'; result.confidenceFloor = 0.72; return result; }
  if (ITEM_END.test(canonical) && ITEM_CONTEXT.test(joined)) { result.forcedType = 'items'; result.signal = 'item-context'; result.confidenceFloor = 0.72; return result; }
  if (LOCATION_END.test(canonical)) { result.forcedType = 'locations'; result.signal = 'location-name'; result.confidenceFloor = 0.74; return result; }
  if (likelyPersonName(canonical)) { result.forcedType = 'cast'; result.signal = 'person-name-shape'; result.confidenceFloor = immediateHuman ? 0.82 : 0.72; return result; }
  if (ROLE_OR_EPITHET.test(canonical)) { result.rejectReason = 'unresolved-title-or-epithet'; return result; }

  if (tokenList.length === 1) {
    if (immediateHuman || (vocative && input.occurrences.length >= 2)) {
      result.forcedType = 'cast'; result.signal = 'named-person-context'; result.confidenceFloor = 0.76;
    } else if (input.occurrences.length < 3) {
      result.rejectReason = 'unsupported-single-token';
    } else {
      result.confidenceCap = 0.56;
    }
  }
  if (SOFTWARE_CONTEXT.test(joined) && /^[A-Z][A-Z0-9-]+$/.test(input.surface)) result.rejectReason = 'software-or-brand-not-world-entity';
  return result;
}
