import { newId } from '@/lib/id';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import type { Archetype, TypePack } from './index';
import { article, cap, factionName, placeName, type ThemeId } from './lexicon';
import type { GenCtx } from './generic';

/** Deep factions pack: each archetype is one coherent kind of power bloc —
 * its goals, methods, ideology, and internal shape all pull from the same
 * well, so a thieves' guild schemes like a guild from its creed to its
 * chain of command.
 *
 * Slot conventions: `goals`/`methods` are short chip strings, `creeds` are
 * motto-like clauses for description, `ideals`/`structures` are prose
 * clauses. Option-backed `kinds` hold exact lowercase strings from the
 * factions entity config — duplicates act as weights. */

const ARCHETYPES: Archetype[] = [
  {
    id: 'thieves',
    keywords: ['thieves', 'guild', 'crime', 'smuggler', 'underworld', 'gang', 'crew', 'syndicate', 'fence'],
    themes: 'any',
    lexicon: {
      kinds: ['guild', 'network', 'cabal', 'guild'],
      sizes: ['a tight crew of a dozen', 'city-wide, in every ward', 'small but everywhere that matters', 'regional, with fingers in three ports'],
      goals: ['own the docks', 'control the black market', 'buy every magistrate worth buying', 'run the smuggling routes', 'keep the watch looking the other way', 'corner the fencing trade', 'settle an old score with a rival crew', 'go legitimate, eventually'],
      methods: ['extortion', 'smuggling', 'blackmail', 'burglary', 'bribery', 'protection rackets', 'well-placed knives', 'a network of informers'],
      ideals: ['There are no gods, only debts and the people who collect them.', 'Loyalty to the crew above crown, coin, or kin.', 'Everything has a price; the trick is knowing whose.', 'The law is for people who can afford it.'],
      structures: ['A shadow-hierarchy of earners and enforcers under a boss no one names aloud.', 'Cells that never meet, so no one arrested can betray the rest.', 'Ranks earned in scores pulled, debts owed, and silences kept.'],
      creeds: ['loyalty, silence, and a fair cut', 'nothing is stolen that was properly guarded', 'the debt always comes due'],
      descriptors: ['secretive', 'ruthless', 'well-connected', 'patient', 'feared', 'deniable'],
      nouns: ['dock', 'ledger', 'blade', 'favour', 'debt', 'shadow'],
    },
  },
  {
    id: 'noble-house',
    keywords: ['house', 'noble', 'dynasty', 'lord', 'family', 'court', 'aristocrat', 'bloodline', 'estate'],
    themes: ['high-fantasy', 'grimdark', 'mythic', 'modern'],
    lexicon: {
      kinds: ['house', 'clan', 'council', 'house'],
      sizes: ['a single great family and its retainers', 'a dynasty spanning three provinces', 'old blood, dwindling lands', 'a rising house with more ambition than acreage'],
      goals: ['secure the succession', 'expand the family holdings', 'marry into a stronger house', 'reclaim a lost ancestral seat', 'outlast their rivals at court', 'restore the family name', 'put an heir on a higher throne', 'bury an old scandal for good'],
      methods: ['patronage', 'court intrigue', 'arranged marriage', 'a private guard', 'strategic debt', 'quiet poison, when needed', 'controlling the granaries', 'sponsoring the right festivals'],
      ideals: ['Blood is duty; the house outlives every one of us.', 'Honour in public, whatever it takes in private.', 'A name is the only inheritance that cannot be spent.', 'Rule as our ancestors ruled, and answer to no upstart.'],
      structures: ['A patriarch or matriarch, heirs in careful order, and a web of cousins owed favours.', 'The head rules; the steward runs everything; the spymaster knows everything.', 'Cadet branches jockey for the main line while presenting a united face.'],
      creeds: ['the house endures', 'first among the old blood', 'we do not forget a slight'],
      descriptors: ['proud', 'ancient', 'calculating', 'well-appointed', 'insular', 'formidable'],
      nouns: ['crest', 'seat', 'oath', 'vault', 'name', 'succession'],
    },
  },
  {
    id: 'religious-order',
    keywords: ['order', 'church', 'temple', 'faith', 'priest', 'clergy', 'religious', 'divine', 'holy'],
    themes: ['high-fantasy', 'grimdark', 'mythic'],
    lexicon: {
      kinds: ['order', 'movement', 'cult', 'order'],
      sizes: ['a single cloister and its faithful', 'a church with temples in every town', 'a wandering order with no fixed home', 'the state faith, wealthy and watched'],
      goals: ['convert the faithless', 'guard the sacred relic', 'purge a spreading heresy', 'rebuild the ruined cathedral', 'canonise their late founder', 'reclaim a holy site from unbelievers', 'shepherd the poor and win their loyalty', 'prepare the faithful for a foretold day'],
      methods: ['sermon and pilgrimage', 'tithes and alms', 'inquisition', 'charity that buys loyalty', 'sanctuary for the desperate', 'excommunication', 'sacred oaths', 'the quiet influence of confession'],
      ideals: ['The light is owed to all, whether they ask for it or not.', 'Doctrine before mercy; mercy before pride.', 'To doubt is human; to persist in doubt is damnation.', 'The order serves the faith, and the faith serves the world.'],
      structures: ['A high seat, an inner conclave, and orders of priests, wardens, and lay-brothers below.', 'Cloistered leadership above, mendicant preachers spreading the word abroad.', 'The devout rise by piety, learning, and useful zeal.'],
      creeds: ['by the light, unbroken', 'faith is the only fortress', 'serve, and be sheltered'],
      descriptors: ['devout', 'austere', 'influential', 'zealous', 'charitable', 'unyielding'],
      nouns: ['relic', 'vow', 'litany', 'sanctuary', 'tithe', 'flame'],
    },
  },
  {
    id: 'merchant-company',
    keywords: ['merchant', 'company', 'trade', 'guild', 'commerce', 'caravan', 'bank', 'consortium', 'traders'],
    themes: 'any',
    lexicon: {
      kinds: ['guild', 'network', 'council', 'guild'],
      sizes: ['a family firm with a handful of caravans', 'a chartered company with its own fleet', 'a trade guild controlling one city market', 'a consortium spanning the trade roads'],
      goals: ['monopolise a trade route', 'corner the market in a scarce good', 'win an exclusive royal charter', 'undercut a rival company into ruin', 'open a new route to distant markets', 'buy a seat on the city council', 'secure the caravan roads against banditry', 'turn a wartime shortage into a fortune'],
      methods: ['exclusive contracts', 'armed caravans', 'strategic bribery', 'price-fixing', 'hired mercenary escorts', 'insurance and moneylending', 'buying the competition', 'lobbying the magistrates'],
      ideals: ['A ledger balanced is a conscience clear.', 'Trade binds the world tighter than any treaty.', 'Every problem is a price waiting to be named.', 'The company prospers, so its people prosper.'],
      structures: ['A board of partners, a factor in every port, and clerks who truly run it.', 'Shareholding families under a governor elected each season.', 'Rank follows capital: the more you risk, the more you rule.'],
      creeds: ['profit, and the peace that protects it', 'a fair weight and a signed contract', 'the road is long; the ledger longer'],
      descriptors: ['prosperous', 'shrewd', 'far-reaching', 'pragmatic', 'well-guarded', 'ambitious'],
      nouns: ['ledger', 'caravan', 'charter', 'contract', 'coin', 'route'],
    },
  },
  {
    id: 'rebel-cell',
    keywords: ['rebel', 'resistance', 'revolution', 'insurgent', 'freedom', 'uprising', 'underground', 'movement', 'partisan'],
    themes: 'any',
    lexicon: {
      kinds: ['movement', 'network', 'cabal', 'movement'],
      sizes: ['a handful of desperate believers', 'a growing underground across the province', 'scattered cells with a shared cause', 'a shadow-army awaiting the signal'],
      goals: ['topple the tyrant', 'free the occupied province', 'expose the regime\'s crimes', 'arm the discontented', 'spark a general uprising', 'rescue their captured leaders', 'seize the armoury and the printing press', 'outlast the crackdown'],
      methods: ['sabotage', 'propaganda and pamphlets', 'ambush and hit-and-run', 'a network of safe-houses', 'stealing from the granaries', 'turning the regime\'s own soldiers', 'coded messages and dead drops', 'martyrs, when martyrs are needed'],
      ideals: ['Better to die standing than live on their knees.', 'The cause outlives any one of us — trust the cause, not the person.', 'No throne is worth the blood it sits on.', 'Freedom is taken, never granted.'],
      structures: ['Isolated cells that know only their own, so a captured member can betray few.', 'A hidden council of founders and the couriers who link them.', 'Command by trust earned in risk shared, not rank conferred.'],
      creeds: ['freedom or nothing', 'the fire is already lit', 'we are everywhere and nowhere'],
      descriptors: ['desperate', 'idealistic', 'elusive', 'determined', 'hunted', 'growing'],
      nouns: ['banner', 'cell', 'signal', 'chain', 'dawn', 'spark'],
    },
  },
  {
    id: 'knightly-order',
    keywords: ['knight', 'order', 'chivalry', 'warrior', 'guard', 'templar', 'legion', 'company', 'oathbound'],
    themes: ['high-fantasy', 'grimdark', 'mythic'],
    lexicon: {
      kinds: ['order', 'army', 'house', 'order'],
      sizes: ['a lone chapterhouse of sworn knights', 'a martial order holding the frontier', 'an elite guard of a few hundred', 'a legion with garrisons across the realm'],
      goals: ['hold the frontier against the dark', 'honour the founding oath', 'slay the beast that broke their last muster', 'protect the pilgrim roads', 'restore the order\'s tarnished honour', 'guard the throne against usurpers', 'reclaim their lost chapterhouse', 'train a new generation before the old guard falls'],
      methods: ['the sword and the muster', 'the night vigil', 'the code of chivalry', 'oaths sworn on relics', 'patrols and border forts', 'trial by combat', 'sworn brotherhood', 'the levy in times of war'],
      ideals: ['The oath is the whole of the law.', 'Strength exists to shield the weak, or it is only cruelty.', 'Die with your face to the enemy and your vow unbroken.', 'Honour is a debt paid daily, never in full.'],
      structures: ['A grandmaster, a council of knight-commanders, and squires earning their spurs.', 'Chapters holding their own keeps under a single sworn code.', 'Rank won through deeds, vigils kept, and enemies faced.'],
      creeds: ['sworn, and unbroken', 'the shield of the weak', 'honour above life'],
      descriptors: ['disciplined', 'honourable', 'martial', 'steadfast', 'venerable', 'unflinching'],
      nouns: ['oath', 'blade', 'vigil', 'muster', 'banner', 'shield'],
    },
  },
  {
    id: 'cult',
    keywords: ['cult', 'sect', 'occult', 'secret', 'forbidden', 'sleeper', 'doomsday', 'hidden', 'apocalypse'],
    themes: ['grimdark', 'mythic', 'science-fiction', 'high-fantasy'],
    lexicon: {
      kinds: ['cult', 'cabal', 'movement', 'cult'],
      sizes: ['a secret circle of thirteen', 'cells hidden inside a respectable faith', 'a spreading whisper with no known centre', 'more members than anyone dares to guess'],
      goals: ['awaken the sleeper below', 'hasten the promised ending', 'gather the chosen before the night', 'recover the forbidden text', 'infiltrate the powers that be', 'complete the great working', 'silence those who have seen too much', 'prepare a vessel for what is coming'],
      methods: ['secret ritual', 'patient recruitment', 'sacrifice', 'coded scripture', 'blackmail of the compromised', 'planting believers in high places', 'visions and prophecy', 'erasing all who leave'],
      ideals: ['The end is not to be feared but ushered in.', 'The world as it is was always a lie to be unmade.', 'Only the chosen will wake; the rest were never real.', 'Obedience now buys transcendence later.'],
      structures: ['Concentric circles of initiation; only the inmost know the true aim.', 'A hidden hierophant, ranks of the anointed, and disposable outer faithful.', 'Advancement by devotion proven in secrets kept and lines crossed.'],
      creeds: ['the sleeper stirs', 'we were promised the dark', 'all things end, and we are the ending'],
      descriptors: ['secretive', 'fervent', 'insidious', 'patient', 'unsettling', 'devoted'],
      nouns: ['sigil', 'sleeper', 'rite', 'whisper', 'veil', 'ending'],
    },
  },
  {
    id: 'scholars',
    keywords: ['scholar', 'academy', 'college', 'library', 'lore', 'research', 'university', 'archive', 'sages'],
    themes: 'any',
    lexicon: {
      kinds: ['order', 'council', 'guild', 'order'],
      sizes: ['a single college and its fellows', 'an academy with a famous library', 'a scattered society of correspondents', 'a chartered institute funded by the crown'],
      goals: ['catalogue all knowledge', 'recover a lost work thought destroyed', 'decode the sealed archive', 'map the unmapped reaches', 'settle a centuries-old scholarly dispute', 'preserve learning against a coming dark age', 'win the patronage of the powerful', 'keep a dangerous truth safely buried'],
      methods: ['painstaking research', 'expeditions to ruins', 'debate and peer review', 'careful copying of fragile texts', 'cultivating wealthy patrons', 'a jealously guarded library', 'apprenticeship and long study', 'quiet censorship of the dangerous'],
      ideals: ['Knowledge kept from the world is knowledge half-lost.', 'Doubt everything, cite everything, conclude carefully.', 'Some doors are opened only to be closed more securely.', 'The archive outlasts every empire that funds it.'],
      structures: ['A rectorate, tenured fellows, and students grinding toward mastery.', 'A society of equals ruled loosely by reputation and results.', 'Rank by publication, discovery, and the size of one\'s footnotes.'],
      creeds: ['light against the long dark', 'cite, question, preserve', 'the archive remembers'],
      descriptors: ['learned', 'meticulous', 'well-endowed', 'insular', 'curious', 'venerable'],
      nouns: ['archive', 'folio', 'lens', 'inquiry', 'index', 'lore'],
    },
  },
];

function pickSlot(rng: Rng, arch: Archetype, slot: string): string {
  const pool = arch.lexicon[slot];
  return pool?.length ? rng.pick(pool) : '';
}

/** 1–`max` distinct picks from an archetype slot, for chip fields. */
function pickSome(rng: Rng, arch: Archetype, slot: string, min: number, max: number): string[] {
  const pool = arch.lexicon[slot] ?? [];
  if (!pool.length) return [];
  return rng.shuffle(pool).slice(0, rng.int(min, Math.min(max, pool.length)));
}

/** Two distinct entries from a slot (falls back to a repeat if the pool has
 * only one) — keeps paired clauses from saying the same thing twice. */
function pickPair(rng: Rng, arch: Archetype, slot: string): [string, string] {
  const two = rng.shuffle(arch.lexicon[slot] ?? []).slice(0, 2);
  const first = two[0] ?? pickSlot(rng, arch, slot);
  return [first, two[1] ?? first];
}

/** Faction names lean on the theme grammar (lexicon.factionName) with an
 * archetype-noun fallback: "Order of the Relic", "The Dockside Syndicate". */
export function factionNameFor(rng: Rng, arch: Archetype, theme: ThemeId): string {
  if (rng.chance(0.4)) {
    const noun = cap(pickSlot(rng, arch, 'nouns'));
    const forms = [
      () => `The ${placeName(rng, theme)} ${rng.pick(['Pact', 'Circle', 'Company', 'Court', 'Society'])}`,
      () => `Order of the ${noun}`,
      () => `The ${cap(pickSlot(rng, arch, 'descriptors'))} ${noun}`,
    ];
    return rng.pick(forms)();
  }
  return factionName(rng, theme);
}

/** First entity of `type` ctx knows about, as an EntityRef — or undefined. */
function refFrom(rng: Rng, ctx: GenCtx, type: string): { id: string; type: string; name: string } | undefined {
  const candidates = ctx.known.filter((k) => k.type === type);
  if (!candidates.length) return undefined;
  const picked = rng.pick(candidates);
  return { id: picked.id, type: picked.type, name: picked.name };
}

function someRefs(rng: Rng, ctx: GenCtx, type: string, max: number): { id: string; type: string; name: string }[] {
  const candidates = ctx.known.filter((k) => k.type === type);
  if (!candidates.length) return [];
  return rng
    .shuffle(candidates)
    .slice(0, rng.int(1, Math.min(max, candidates.length)))
    .map((k) => ({ id: k.id, type: k.type, name: k.name }));
}

/** One fully-fielded faction. Every field is driven by the same archetype
 * + rng, so a "cult" roll stays a cult across goals, methods, and creed. */
export function generateFactionDraft(rng: Rng, arch: Archetype, ctx: GenCtx): BundleEntityDraft {
  const theme = ctx.theme;
  const noun = () => pickSlot(rng, arch, 'nouns');
  const creed = pickSlot(rng, arch, 'creeds');
  const kind = pickSlot(rng, arch, 'kinds');
  const [descA, descB] = pickPair(rng, arch, 'descriptors');
  const [idealA, idealB] = pickPair(rng, arch, 'ideals');

  const name = factionNameFor(rng, arch, theme);
  const summary = `${cap(article(descA))} ${descA} ${kind} whose watchword is "${creed}".`;
  const description = `${cap(name)} is ${article(descA)} ${descA}, ${descB} power that lives and dies by the ${noun()}. ${idealA} ${pickSlot(rng, arch, 'structures')}`;

  const fields: Record<string, unknown> = {
    kind,
    description,
    size: pickSlot(rng, arch, 'sizes'),
    structure: pickSlot(rng, arch, 'structures'),
    goals: pickSome(rng, arch, 'goals', 2, 4),
    methods: pickSome(rng, arch, 'methods', 2, 4),
    ideology: `${idealA} ${idealB}`,
  };

  // Link into the project where entities of the right type already exist.
  if (rng.chance(0.6)) {
    const leader = refFrom(rng, ctx, 'cast');
    if (leader) fields.leader = leader;
  }
  if (rng.chance(0.5)) {
    const members = someRefs(rng, ctx, 'cast', 3);
    if (members.length) fields.members = members;
  }
  if (rng.chance(0.5)) {
    const hq = refFrom(rng, ctx, 'locations');
    if (hq) fields.headquarters = hq;
  }
  if (rng.chance(0.4)) {
    const controls = someRefs(rng, ctx, 'locations', 2);
    if (controls.length) fields.controlsLocations = controls;
  }
  if (rng.chance(0.35)) {
    const quest = refFrom(rng, ctx, 'quests');
    if (quest) fields.quests = [quest];
  }

  return {
    localId: newId(),
    type: 'factions',
    name,
    aliases: [],
    summary,
    tags: [arch.id, descB],
    fields,
  };
}

export const factionsPack: TypePack = {
  type: 'factions',
  archetypes: ARCHETYPES,
  generate: (rng, arch, ctx) => generateFactionDraft(rng, arch, ctx),
};
