import { newId } from '@/lib/id';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import type { Archetype, TypePack } from './index';
import { cap } from './lexicon';
import type { GenCtx } from './generic';

/** Deep skills pack: each archetype is one coherent school — its verbs,
 * nouns, costs, and branch names all pull from the same well, so a
 * poison tree bleeds poison from root to tips. */

const ARCHETYPES: Archetype[] = [
  {
    id: 'sorcery',
    keywords: ['sorcerer', 'sorcery', 'mage', 'magic', 'arcane', 'wizard', 'spell', 'mana'],
    themes: ['high-fantasy', 'mythic', 'grimdark'],
    lexicon: {
      verbs: ['channel', 'unravel', 'bind', 'conjure', 'siphon', 'transmute', 'ward', 'scry'],
      nouns: ['ley-thread', 'sigil', 'mana', 'rune', 'veil', 'echo', 'star-chart', 'cantrip'],
      adjectives: ['arcane', 'woven', 'luminous', 'forbidden', 'threadbare', 'resonant'],
      costs: ['2 mana', '1 rune charge', 'a memorised sigil', 'one held breath', '3 mana'],
      cooldowns: ['per scene', 'until next rest', 'once per chapter', 'none'],
      targets: ['a foe within sight', 'one ally', 'everything in the circle', 'the caster'],
      amounts: ['briefly', 'for a scene', 'until dawn', 'while concentrating'],
    },
    branchNames: ['Evocation', 'Weaving', 'Veilcraft', 'Runework', 'Siphoning'],
  },
  {
    id: 'poison',
    keywords: ['poison', 'venom', 'toxin', 'assassin', 'serpent', 'plague', 'blight'],
    themes: 'any',
    lexicon: {
      verbs: ['envenom', 'coat', 'taint', 'corrode', 'paralyse', 'fester', 'distil', 'numb'],
      nouns: ['venom', 'vial', 'fang', 'blight', 'antidote', 'serpent', 'residue', 'spore'],
      adjectives: ['venomous', 'creeping', 'numbing', 'tainted', 'slow-acting', 'colorless'],
      costs: ['1 vial', 'a dose of venom', 'one coated blade', '2 doses'],
      cooldowns: ['once per victim', 'per scene', 'until restocked', 'none'],
      targets: ['a struck foe', 'one meal or cup', 'a blade or dart', 'anyone who lingers'],
      amounts: ['over three scenes', 'within a heartbeat', 'slowly and silently', 'until treated'],
    },
    branchNames: ['Toxins', 'Subtlety', 'Antidotes', 'Fangwork', 'Contagion'],
  },
  {
    id: 'flame',
    keywords: ['fire', 'flame', 'ember', 'pyromancer', 'burn', 'ash', 'inferno'],
    themes: 'any',
    lexicon: {
      verbs: ['ignite', 'sear', 'scorch', 'kindle', 'smother', 'stoke', 'cauterise'],
      nouns: ['ember', 'cinder', 'pyre', 'ash', 'wick', 'flashpoint', 'furnace'],
      adjectives: ['smouldering', 'white-hot', 'ashen', 'roaring', 'flickering'],
      costs: ['1 ember', 'a handful of cinders', 'one open flame nearby', '2 embers'],
      cooldowns: ['per scene', 'while a fire burns', 'once per chapter', 'none'],
      targets: ['a foe within reach', 'a swath of ground', 'one flammable thing', 'the wielder'],
      amounts: ['until doused', 'for a scene', 'in a burst', 'while stoked'],
    },
    branchNames: ['Kindling', 'Wildfire', 'Ashes', 'The Forge'],
  },
  {
    id: 'shadow',
    keywords: ['shadow', 'stealth', 'thief', 'rogue', 'night', 'dark', 'silence', 'knife'],
    themes: 'any',
    lexicon: {
      verbs: ['slip', 'vanish', 'muffle', 'shadow', 'palm', 'mark', 'ambush'],
      nouns: ['dusk', 'footfall', 'lockpick', 'alley', 'silhouette', 'knife', 'whisper'],
      adjectives: ['silent', 'unseen', 'fleeting', 'grey', 'patient'],
      costs: ['darkness nearby', 'a held breath', 'one marked target', 'nothing — but nerve'],
      cooldowns: ['while unseen', 'per scene', 'once per night', 'none'],
      targets: ['an unaware foe', 'one watcher', 'the wielder', 'a locked thing'],
      amounts: ['until noticed', 'for three heartbeats', 'for a scene', 'instantly'],
    },
    branchNames: ['Footwork', 'Veils', 'Knifeplay', 'Marks'],
  },
  {
    id: 'blade',
    keywords: ['sword', 'blade', 'warrior', 'duel', 'fencer', 'knight', 'strike', 'parry'],
    themes: ['high-fantasy', 'grimdark', 'mythic', 'modern'],
    lexicon: {
      verbs: ['riposte', 'feint', 'disarm', 'cleave', 'parry', 'lunge', 'pommel-strike'],
      nouns: ['edge', 'guard', 'tempo', 'measure', 'scabbard', 'stance', 'quillon'],
      adjectives: ['measured', 'brutal', 'perfect', 'battered', 'practiced'],
      costs: ['stamina', 'an opening', 'one free hand', 'balance'],
      cooldowns: ['per exchange', 'per scene', 'when winded', 'none'],
      targets: ['a duellist', 'anyone in reach', "the opponent's weapon", 'the wielder'],
      amounts: ['for one exchange', 'until footing is lost', 'for a scene'],
    },
    branchNames: ['Guards', 'Ripostes', 'Warcraft', 'The Perfect Cut'],
  },
  {
    id: 'holy',
    keywords: ['holy', 'light', 'priest', 'divine', 'cleric', 'paladin', 'blessing', 'faith'],
    themes: ['high-fantasy', 'mythic', 'grimdark'],
    lexicon: {
      verbs: ['bless', 'consecrate', 'absolve', 'smite', 'shield', 'anoint', 'intercede'],
      nouns: ['litany', 'relic', 'halo', 'censer', 'vow', 'chorus', 'sanctuary'],
      adjectives: ['consecrated', 'radiant', 'sworn', 'unbroken', 'penitent'],
      costs: ['a spoken vow', '1 prayer', 'a drop of consecrated oil', 'faith, tested'],
      cooldowns: ['once per dawn', 'per scene', 'while the vow holds', 'none'],
      targets: ['one ally', 'the unhallowed', 'a place or threshold', 'the faithful nearby'],
      amounts: ['until sunset', 'for a scene', 'while the litany is sung'],
    },
    branchNames: ['Litanies', 'Aegis', 'Judgement', 'Relics'],
  },
  {
    id: 'wilds',
    keywords: ['nature', 'druid', 'beast', 'wild', 'ranger', 'grove', 'thorn', 'root'],
    themes: ['high-fantasy', 'mythic'],
    lexicon: {
      verbs: ['entangle', 'graft', 'call', 'track', 'bloom', 'burrow', 'molt'],
      nouns: ['root', 'thorn', 'spoor', 'sap', 'antler', 'bramble', 'seed'],
      adjectives: ['feral', 'evergreen', 'thorned', 'loamy', 'migratory'],
      costs: ['living soil underfoot', 'a seed', '1 favour of the grove', 'blood, freely given'],
      cooldowns: ['per season', 'per scene', 'until replanted', 'none'],
      targets: ['the ground ahead', 'one beast', 'the caller', 'everything rooted nearby'],
      amounts: ['until harvest', 'for a scene', 'while tended'],
    },
    branchNames: ['Rootwork', 'The Hunt', 'Verdance', 'Beastspeech'],
  },
  {
    id: 'storm',
    keywords: ['storm', 'lightning', 'thunder', 'tempest', 'wind', 'sky', 'gale'],
    themes: 'any',
    lexicon: {
      verbs: ['arc', 'ground', 'ride', 'summon', 'discharge', 'split', 'deafen'],
      nouns: ['bolt', 'gale', 'front', 'static', 'squall', 'downdraft', 'eye'],
      adjectives: ['crackling', 'howling', 'charged', 'sudden', 'rolling'],
      costs: ['a charged sky', '1 spark', 'both hands raised', 'the high ground'],
      cooldowns: ['per storm', 'per scene', 'until recharged', 'none'],
      targets: ['the tallest foe', 'a line of ground', 'the summoner', 'everything exposed'],
      amounts: ['in a flash', 'for a scene', 'while the storm holds'],
    },
    branchNames: ['Static', 'Galecraft', 'The Eye', 'Thunderheads'],
  },
  {
    id: 'tech',
    keywords: ['tech', 'engineer', 'hacker', 'drone', 'cyber', 'implant', 'machine', 'code'],
    themes: ['science-fiction', 'modern'],
    lexicon: {
      verbs: ['deploy', 'overclock', 'patch', 'spoof', 'reroute', 'compile', 'jailbreak'],
      nouns: ['drone', 'subroutine', 'exploit', 'servo', 'firmware', 'uplink', 'kill-switch'],
      adjectives: ['overclocked', 'jury-rigged', 'encrypted', 'redundant', 'zero-day'],
      costs: ['1 charge cell', 'processor headroom', 'a spare part', 'network access'],
      cooldowns: ['per reboot', 'until patched', 'per mission', 'none'],
      targets: ['one system in range', 'a friendly implant', 'the operator', 'every device nearby'],
      amounts: ['until reboot', 'for one breach window', 'while powered'],
    },
    branchNames: ['Hardware', 'Intrusion', 'Automation', 'Failsafes'],
  },
  {
    id: 'mindcraft',
    keywords: ['psionic', 'mind', 'psychic', 'telepath', 'will', 'memory', 'dream'],
    themes: ['science-fiction', 'mythic', 'modern'],
    lexicon: {
      verbs: ['project', 'sift', 'cloud', 'anchor', 'fracture', 'soothe', 'read'],
      nouns: ['synapse', 'echo', 'memory', 'veil', 'lattice', 'impulse', 'dream'],
      adjectives: ['lucid', 'intrusive', 'anchored', 'fractured', 'silent'],
      costs: ['a splitting headache', '1 focus', 'eye contact', 'a shared memory'],
      cooldowns: ['per rest', 'per scene', 'until refocused', 'none'],
      targets: ['one mind', 'a crowd', 'the psion', 'anyone dreaming nearby'],
      amounts: ['for a scene', 'until broken', 'while concentrating'],
    },
    branchNames: ['Telepathy', 'Wardings', 'Dominion', 'The Dreaming'],
  },
];

/** Higher tree tiers earn roman-numeral upgrades and stronger wording. */
const TIER_WORDS = ['', ' II', ' III', ' IV', ' V', ' VI'];

function pickSlot(rng: Rng, arch: Archetype, slot: string): string {
  const pool = arch.lexicon[slot];
  return pool?.length ? rng.pick(pool) : '';
}

export function skillNameFor(rng: Rng, arch: Archetype, tier = 0): string {
  const verb = pickSlot(rng, arch, 'verbs');
  const noun = pickSlot(rng, arch, 'nouns');
  const adjective = pickSlot(rng, arch, 'adjectives');
  const forms = [
    () => `${cap(noun)} ${cap(verb)}`,
    () => `${cap(adjective)} ${cap(noun)}`,
    () => `${cap(verb)} the ${cap(noun)}`,
    () => `${cap(noun)}ward`,
  ];
  const base = rng.pick(forms)();
  const suffix = tier >= 3 && rng.chance(0.4) ? TIER_WORDS[Math.min(tier - 2, 5)] : '';
  return `${base}${suffix}`;
}

/** One fully-fielded skill. `tier` scales cost/effect wording. */
export function generateSkillDraft(
  rng: Rng,
  arch: Archetype,
  _ctx: GenCtx,
  opts: { tier?: number; name?: string } = {}
): BundleEntityDraft {
  const tier = opts.tier ?? 0;
  const name = opts.name ?? skillNameFor(rng, arch, tier);
  const verb = () => pickSlot(rng, arch, 'verbs');
  const noun = () => pickSlot(rng, arch, 'nouns');
  const adjective = () => pickSlot(rng, arch, 'adjectives');
  const target = () => pickSlot(rng, arch, 'targets');
  const amount = () => pickSlot(rng, arch, 'amounts');

  const skillType = rng.weightedPick([
    { value: 'active', weight: 5 },
    { value: 'passive', weight: 3 },
    { value: 'triggered', weight: 2 },
    { value: 'innate', weight: 1 },
  ]).value;

  const effects = [
    `${cap(verb())} ${target()} ${amount()}.`,
    ...(rng.chance(0.7) ? [`${cap(verb())} the ${noun()}, ${amount()}.`] : []),
    ...(tier >= 2 && rng.chance(0.6) ? [`At this mastery: also affects ${target()}.`] : []),
  ];

  const requirements =
    tier === 0
      ? rng.chance(0.3)
        ? [`A ${adjective()} ${noun()} in hand`]
        : []
      : [`Mastery of the previous ${noun()} technique`,
         ...(rng.chance(0.4) ? [`A ${adjective()} ${noun()}`] : [])];

  const upgradePath = [
    `Adept — ${verb()}s ${target()}`,
    `Expert — cost drops to ${pickSlot(rng, arch, 'costs')}`,
    ...(rng.chance(0.5) ? [`Master — also ${verb()}s the ${noun()}`] : []),
  ];

  const summary = `${cap(verb())}s ${target()} using ${rng.chance(0.5) ? 'a' : 'the'} ${adjective()} ${noun()}.`;
  const description = `${cap(name)} is a ${adjective()} ${arch.id} technique. The practitioner ${verb()}s the ${noun()} to ${verb()} ${target()}, ${amount()}. ${cap(rng.chance(0.5) ? `Misuse leaves the ${noun()} ${adjective()}` : `Its ${noun()} must be ${adjective()} before each use`)}.`;

  return {
    localId: newId(),
    type: 'skills',
    name,
    aliases: [],
    summary,
    tags: [arch.id, adjective()],
    fields: {
      skillType,
      cost: pickSlot(rng, arch, 'costs'),
      cooldown: pickSlot(rng, arch, 'cooldowns'),
      description,
      effects,
      requirements,
      upgradePath,
    },
  };
}

/** Evocative tree names: "The Serpent's Kiss", "Path of Cinders". */
export function treeNameFor(rng: Rng, arch: Archetype): string {
  const noun = () => cap(pickSlot(rng, arch, 'nouns'));
  const adjective = () => cap(pickSlot(rng, arch, 'adjectives'));
  const forms = [
    () => `Path of ${noun()}s`,
    () => `The ${adjective()} ${noun()}`,
    () => `${noun()} Discipline`,
    () => `Way of the ${noun()}`,
    () => `The ${noun()}'s ${rng.pick(['Kiss', 'Price', 'Teaching', 'Burden', 'Gift'])}`,
  ];
  return rng.pick(forms)();
}

export const skillsPack: TypePack = {
  type: 'skills',
  archetypes: ARCHETYPES,
  generate: (rng, arch, ctx) => generateSkillDraft(rng, arch, ctx),
};
