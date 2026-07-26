import type { EntityType } from '@/domain/entity-types';

/**
 * What role does this name play in the prose?
 *
 * The original classifier answered that question with an ordered chain of
 * early returns: the first cue that matched won outright, whatever the rest of
 * the chapter said. That is why a single `"handed the Saltbrand to Vex"` —
 * one movement preposition — outranked three sentences where Vex was the
 * subject of a verb, and the protagonist was filed as a location.
 *
 * This module answers it by counting instead. Every occurrence of a surface
 * form contributes weighted votes to the roles its context supports, and the
 * winner is the role the whole document argues for. Naming cues ("the skill
 * called X") stay heavy because they are near-certain; positional cues like
 * "to X" stay light because they are shared by places and people alike.
 *
 * Pure and offset-driven — no project state, no network. The extraction
 * engine's typing accuracy is the ceiling on everything downstream, because a
 * character filed as a location can never trigger a travel cascade.
 */

/** The roles prose can argue for. A subset of EntityType: these are the ones
 * a sentence's shape can genuinely distinguish. */
export type RoleType = 'cast' | 'locations' | 'items' | 'skills' | 'factions' | 'events';

export const ROLE_TYPES: RoleType[] = ['cast', 'locations', 'items', 'skills', 'factions', 'events'];

export interface RoleEvidence {
  scores: Record<RoleType, number>;
  /** Human-readable cue names per role — surfaced as candidate reasons. */
  reasons: Record<RoleType, string[]>;
  /** Highest-scoring role, or null when nothing voted. */
  leader: RoleType | null;
  /** Leader's score minus the runner-up's. 0 means a genuine tie. */
  margin: number;
  total: number;
}

export interface EvidenceOccurrence {
  start: number;
  end: number;
}

/** How much each cue is worth. Naming cues are near-certain; bare positional
 * cues are shared between roles and must never win on their own. */
interface Cue {
  role: RoleType;
  weight: number;
  name: string;
  /** Tested against the ~96 chars before the occurrence. */
  before?: RegExp;
  /** Tested against the ~96 chars after the occurrence. */
  after?: RegExp;
  /** Tested against the surface form itself. */
  surface?: RegExp;
  /** Both sides must match. */
  requiresSurface?: RegExp;
}

// ── Cast ────────────────────────────────────────────────────────────────────

const DIALOGUE_VERBS =
  'said|asked|replied|whispered|shouted|murmured|cried|answered|muttered|growled|hissed|breathed|snapped|wondered|added|continued|exclaimed|declared|warned|called|barked|drawled';

/** Verbs a person is the subject of. Deliberately broad: being the subject of
 * almost any past-tense action is strong evidence of personhood, and places
 * are rarely the subject of anything. */
const HUMAN_SUBJECT_VERBS =
  'said|asked|replied|shouted|whispered|hissed|muttered|nodded|smiled|frowned|laughed|sighed|shrugged|turned|looked|watched|stared|glanced|stood|sat|knelt|rose|ran|walked|strode|stepped|crossed|entered|left|reached|arrived|returned|fled|rode|sailed|climbed|grabbed|held|drew|raised|lowered|threw|caught|took|gave|handed|carried|wore|opened|closed|pulled|pushed|struck|swung|drank|ate|slept|woke|waited|listened|thought|knew|felt|believed|remembered|wondered|decided|realised|realized|learned|mastered|studied|practised|practiced|found|lost|killed|saved|betrayed|forgave|loved|hated|feared|wanted|needed|tried|began|stopped|kept|let|made|had|was|were|is|has|would|could|should|did';

const BODY_AND_MIND =
  'hand|hands|face|eyes|eye|voice|breath|heart|jaw|mouth|lips|shoulder|shoulders|fingers|throat|chest|head|hair|gaze|smile|frown|temper|mind|thoughts|memory|grip|arm|arms|back|knee|knees|blood|skin|pulse|stomach|coat|cloak|boots';

// ── Locations ───────────────────────────────────────────────────────────────

const PLACE_KINDS =
  'city|keep|village|town|castle|fortress|hold|port|harbour|harbor|isle|island|river|mountain|mountains|forest|gate|tower|temple|inn|tavern|kingdom|realm|land|lands|valley|peak|pass|road|sea|ocean|lake|hall|palace|citadel|abbey|monastery|province|county|shire|domain|territory|wastes|plains|desert|swamp|marsh|moor|caverns|caves|ruins|district|quarter|region|settlement|outpost|camp|border|frontier';

const PLACE_HEAD_NOUNS =
  'Keep|Castle|Tower|Gate|Hold|Fortress|Citadel|Palace|Temple|Bridge|Pass|Peak|Vale|Wood|Woods|Forest|Marsh|Moor|Hall|Inn|Tavern|City|Town|Village|Harbour|Harbor|Port|Isle|Island|Mountains?|River|Lake|Sea|Plains|Desert|Wastes|Ruins|Road|Street|Row|Quarter|District|Region';

// ── Items ───────────────────────────────────────────────────────────────────

const ITEM_NOUNS =
  'sword|blade|dagger|knife|axe|bow|spear|lance|mace|hammer|flail|club|whip|ring|amulet|crown|circlet|cloak|robe|staff|wand|rod|sceptre|scepter|shield|tome|grimoire|chalice|goblet|orb|gauntlets?|helm|helmet|pendant|necklace|locket|relic|key|crystal|gem|jewel|stone|elixir|potion|scroll|banner|horn|bell|mirror|talisman|charm|armour|armor|plate|mail|boots|gloves|belt|brooch|lantern|compass|map|ledger|coin|purse';

const ITEM_VERBS =
  'wielded|carried|drew|sheathed|forged|enchanted|held|holding|equipped|gripped|raised|brandished|unsheathed|swung|levelled|leveled|pointed|aimed|sold|bought|stole|pocketed|lifted';

// ── Skills ──────────────────────────────────────────────────────────────────

const SKILL_NOUNS = 'skill|spell|ability|technique|power|talent|art|incantation|maneuver|manoeuvre|move|stance|form|kata';
const SKILL_LEARN = 'learned|mastered|studied|practised|practiced|taught|perfected|cast|channelled|channeled|invoked|unleashed';

// ── Factions ────────────────────────────────────────────────────────────────

const FACTION_ENDINGS =
  'guild|order|company|house|cell|circle|covenant|brotherhood|sisterhood|clan|tribe|syndicate|consortium|coalition|league|conclave|cabal|court|legion|watch|guard';
const FACTION_VERBS = 'joined|served|swore|pledged|betrayed|led|founded|left|defected';

const CUES: Cue[] = [
  // Cast — naming and speech are near-certain.
  { role: 'cast', weight: 4, name: 'dialogue attribution', after: new RegExp(`^[,"'”’\\s]*\\b(?:${DIALOGUE_VERBS})\\b`, 'i') },
  { role: 'cast', weight: 4, name: 'dialogue attribution', before: new RegExp(`\\b(?:${DIALOGUE_VERBS})\\s+$`, 'i') },
  { role: 'cast', weight: 4, name: 'honorific', before: /\b(?:Lord|Lady|Ser|Sir|Dame|King|Queen|Prince|Princess|Captain|Commander|Master|Mistress|Maester|General|Admiral|Doctor|Professor|Father|Brother|Sister|Aunt|Uncle|Saint|Emperor|Empress|Duke|Duchess|Baron|Count|Countess)\.?\s+$/ },
  { role: 'cast', weight: 3, name: 'subject of an action', after: new RegExp(`^\\s+(?:${HUMAN_SUBJECT_VERBS})\\b`, 'i') },
  { role: 'cast', weight: 3, name: 'possessive of a body or feeling', after: new RegExp(`^'s\\s+(?:${BODY_AND_MIND})\\b`, 'i') },
  { role: 'cast', weight: 2, name: 'addressed directly', before: /[,"“]\s*$/u, after: /^\s*[,!?."”]/u },
  { role: 'cast', weight: 2, name: 'introduced as a person', before: /\b(?:a\s+(?:man|woman|boy|girl|child|stranger|soldier|guard|merchant|priest|witch|smith)\s+(?:called|named)|called|named)\s+$/i },
  { role: 'cast', weight: 2, name: 'travelled with', before: /\b(?:with|beside|alongside|behind|following|joined|met|greeted|thanked|asked|told|warned)\s+$/i },

  // Locations — containment and place-form are strong; a bare preposition is not.
  { role: 'locations', weight: 4, name: 'place-of construction', before: new RegExp(`\\b(?:${PLACE_KINDS})\\s+of\\s+$`, 'i') },
  { role: 'locations', weight: 4, name: 'place head-noun', after: new RegExp(`^\\s+(?:${PLACE_HEAD_NOUNS})\\b`) },
  { role: 'locations', weight: 3, name: 'described as a place', after: new RegExp(`^\\s*,?\\s*(?:a|an|the)\\s+(?:\\w+\\s+){0,2}(?:${PLACE_KINDS})\\b`, 'i') },
  { role: 'locations', weight: 3, name: 'inside a region', after: new RegExp(`^\\s*,?\\s*(?:in|within|inside|on)\\s+the\\s+\\w+\\s+(?:${PLACE_KINDS})\\b`, 'i') },
  { role: 'locations', weight: 3, name: 'lived or based there', before: /\b(?:lives?|lived|based|stationed|born|raised|stayed|camped|settled)\s+(?:in|at|near|outside)\s+$/i },
  { role: 'locations', weight: 2, name: 'compass bearing', before: /\b(?:north|south|east|west|northeast|northwest|southeast|southwest)\s+of\s+$/i },
  // The weak one. On its own it can never outvote a single cast cue, which is
  // the entire point: "handed the blade to Vex" must not make Vex a place.
  { role: 'locations', weight: 1, name: 'movement preposition', before: /\b(?:to|into|at|toward|towards|from|near|beyond|through|across|past|reached|entered|left|arrived\s+at|returned\s+to|visited|looted|raided|fled)\s+$/i },

  // Items.
  { role: 'items', weight: 4, name: 'wielded or carried', before: new RegExp(`\\b(?:${ITEM_VERBS})\\s+(?:the\\s+|a\\s+|an\\s+|his\\s+|her\\s+|their\\s+|its\\s+)?$`, 'i'), requiresSurface: new RegExp(`(?:${ITEM_NOUNS})$`, 'i') },
  { role: 'items', weight: 3, name: 'object-form name', surface: new RegExp(`(?:${ITEM_NOUNS})$`, 'i') },
  { role: 'items', weight: 2, name: 'possessed object', before: /\b(?:the|a|an|his|her|their|its|my|your|our)\s+$/i, requiresSurface: new RegExp(`(?:${ITEM_NOUNS})$`, 'i') },

  // Skills.
  { role: 'skills', weight: 5, name: 'named as a skill', before: new RegExp(`\\b(?:${SKILL_NOUNS})\\s+(?:(?:called|named|known\\s+as)\\s+)?$`, 'i') },
  { role: 'skills', weight: 4, name: 'learned or cast', before: new RegExp(`\\b(?:${SKILL_LEARN})\\s+(?:the\\s+|a\\s+|an\\s+)?$`, 'i') },
  { role: 'skills', weight: 2, name: 'used on a target', after: /^\s+(?:on|at|against)\s+/i },

  // Factions.
  { role: 'factions', weight: 4, name: 'organisation-form name', surface: new RegExp(`\\b(?:${FACTION_ENDINGS})$`, 'i') },
  { role: 'factions', weight: 3, name: 'allegiance verb', before: new RegExp(`\\b(?:${FACTION_VERBS})\\s+(?:the\\s+)?$`, 'i'), requiresSurface: new RegExp(`\\b(?:${FACTION_ENDINGS})$`, 'i') },
  { role: 'factions', weight: 2, name: 'has members or ranks', after: /^\s*(?:'s)?\s+(?:members|ranks|banner|banners|soldiers|agents|initiates)\b/i },

  // Events.
  { role: 'events', weight: 4, name: 'event verb', after: /^\s+(?:began|started|broke\s+out|erupted|ended|came\s+to\s+an\s+end|occurred|happened)\b/i },
  { role: 'events', weight: 2, name: 'dated', before: /\b(?:during|after|before|since)\s+the\s+$/i },
];

const WINDOW = 96;

function emptyScores(): Record<RoleType, number> {
  return { cast: 0, locations: 0, items: 0, skills: 0, factions: 0, events: 0 };
}

function emptyReasons(): Record<RoleType, string[]> {
  return { cast: [], locations: [], items: [], skills: [], factions: [], events: [] };
}

/**
 * Weigh every cue every occurrence supports and total them per role.
 *
 * A cue fires at most once per occurrence per role-and-name pair, so a name
 * repeated in ten identical sentences does not out-shout a name with three
 * genuinely different kinds of support — but ten sentences still beat one.
 */
export function collectRoleEvidence(
  text: string,
  surface: string,
  occurrences: EvidenceOccurrence[]
): RoleEvidence {
  const scores = emptyScores();
  const reasons = emptyReasons();

  for (const occurrence of occurrences) {
    const before = text.slice(Math.max(0, occurrence.start - WINDOW), occurrence.start);
    const after = text.slice(occurrence.end, Math.min(text.length, occurrence.end + WINDOW));
    const firedHere = new Set<string>();
    for (const cue of CUES) {
      const key = `${cue.role}|${cue.name}`;
      if (firedHere.has(key)) continue;
      if (cue.requiresSurface && !cue.requiresSurface.test(surface)) continue;
      if (cue.surface && !cue.surface.test(surface)) continue;
      if (cue.before && !cue.before.test(before)) continue;
      if (cue.after && !cue.after.test(after)) continue;
      if (!cue.before && !cue.after && !cue.surface && !cue.requiresSurface) continue;
      firedHere.add(key);
      scores[cue.role] += cue.weight;
      if (!reasons[cue.role].includes(cue.name)) reasons[cue.role].push(cue.name);
    }
  }

  const ranked = ROLE_TYPES.map((role) => ({ role, score: scores[role] })).sort(
    (a, b) => b.score - a.score
  );
  const leader = ranked[0].score > 0 ? ranked[0].role : null;
  const margin = ranked[0].score - (ranked[1]?.score ?? 0);
  const total = ranked.reduce((sum, row) => sum + row.score, 0);

  return { scores, reasons, leader, margin, total };
}

/** True when `role` has strictly more support than every other role. */
export function roleLeads(evidence: RoleEvidence, role: RoleType): boolean {
  return evidence.leader === role && evidence.margin > 0;
}

/** True when `role` has support and nothing outranks it (ties allowed). */
export function roleAtLeastTies(evidence: RoleEvidence, role: RoleType): boolean {
  return evidence.scores[role] > 0 && evidence.scores[role] >= Math.max(...ROLE_TYPES.map((r) => evidence.scores[r]));
}

/**
 * Confidence from evidence strength, shaped so that one weak cue never reads
 * as certainty and a pile of agreeing cues never quite reads as proof.
 */
export function evidenceConfidence(evidence: RoleEvidence, role: RoleType): number {
  const score = evidence.scores[role];
  if (score <= 0) return 0;
  const share = evidence.total > 0 ? score / evidence.total : 1;
  const depth = Math.min(1, score / 10);
  return Math.min(0.9, 0.42 + 0.34 * depth + 0.18 * share);
}

/** The evidence as ranked type suggestions for the review UI. */
export function evidenceSuggestions(
  evidence: RoleEvidence
): { type: EntityType; confidence: number; reason: string }[] {
  return ROLE_TYPES.filter((role) => evidence.scores[role] > 0)
    .sort((a, b) => evidence.scores[b] - evidence.scores[a])
    .map((role) => ({
      type: role as EntityType,
      confidence: Number(evidenceConfidence(evidence, role).toFixed(2)),
      reason: evidence.reasons[role].join(', ') || 'contextual support',
    }));
}
