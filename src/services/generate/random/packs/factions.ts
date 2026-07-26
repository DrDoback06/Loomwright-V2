import { newId } from '@/lib/id';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import type { Archetype, TypePack } from './index';
import { cap, factionName, placeName, type ThemeId } from './lexicon';
import type { GenCtx } from './generic';

/** Deep factions pack: each archetype is one answer to "what does this group
 * want, and what is it willing to do" — goals, methods, ideology and internal
 * structure all draw from the same well, so a thieves' guild never argues like
 * a monastery. Follows `skills.ts` in structure and `quests.ts` in the
 * template-grammar approach. */

const ARCHETYPES: Archetype[] = [
  {
    id: 'thieves',
    keywords: ['thieves', 'guild', 'crime', 'smuggler', 'underworld', 'crew', 'syndicate', 'fence'],
    themes: 'any',
    lexicon: {
      goals: ['own every dock on the river', 'keep the watch bought and quiet', 'take a cut of everything that moves after dark', 'buy the debt of one person who matters'],
      methods: ['blackmail before violence', 'a bribe first, always', 'break one leg loudly, once a year', 'never the same route twice'],
      ranks: ['Fingers', 'Runners', 'Fences', 'The Ledger', 'The Quiet Room'],
      creed: ['debts are the only real law', 'nobody is owed anything they did not take', 'the city belongs to whoever it does not notice'],
      assets: ['a warehouse nobody has searched', 'three magistrates and a harbourmaster', 'the only accurate map of the sewers', 'a locksmith who does not ask'],
      frictions: ['a rival crew moving in from upriver', 'a member who started talking', 'the new watch captain who cannot be bought'],
      sizes: ['forty, and most of them children', 'a hundred across three wards', 'small, deliberately — twelve who matter'],
    },
  },
  {
    id: 'noble-house',
    keywords: ['house', 'noble', 'dynasty', 'family', 'court', 'lord', 'blood', 'succession'],
    themes: ['high-fantasy', 'grimdark', 'mythic'],
    lexicon: {
      goals: ['put its own blood on a seat it has no claim to', 'marry into the coast and take the tariffs with it', 'outlive the older house across the valley', 'have the old judgement against it overturned'],
      methods: ['marriage before war, war before disgrace', 'buy the debt, then call it in', 'a letter to the right person, hand-delivered', 'never move before the harvest is counted'],
      ranks: ['The Seat', 'Cadet branches', 'Sworn swords', 'The steward', 'Wards and hostages'],
      creed: ['the name outlasts the person carrying it', 'land is the only wealth that cannot be stolen', 'a grudge kept is a grudge that pays'],
      assets: ['four generations of favours owed', 'the only ford for thirty miles', 'a vault of documents about other people', 'two hundred tenants who vote as told'],
      frictions: ['an heir who does not want it', 'a cousin with a better claim and worse manners', 'the debt nobody in the family mentions'],
      sizes: ['a household of ninety, a name worth more', 'three estates and everyone on them', 'diminished — a name and one good house'],
    },
  },
  {
    id: 'order',
    keywords: ['order', 'temple', 'church', 'faith', 'priest', 'monastery', 'devotion', 'religious'],
    themes: ['high-fantasy', 'mythic', 'grimdark'],
    lexicon: {
      goals: ['recover the rite that was lost when the old house burned', 'keep one truth from ever being written down', 'bring the outer shrines back under the rule', 'tend the thing beneath the sanctuary'],
      methods: ['persuasion, then patience, then centuries', 'the rite performed exactly, whatever it costs', 'send one person who cannot be argued with', 'give charity until refusing is the scandal'],
      ranks: ['The Warden', 'Keepers', 'Sworn', 'Novices', 'The Silent Chapter'],
      creed: ['what is kept is what survives', 'doubt is permitted; abandonment is not', 'the rite is older than the reason for it'],
      assets: ['a library nobody outside has read', 'grain stores that outlast any siege', 'the trust of every village on the road', 'the only people who can perform the rite'],
      frictions: ['a schism over one word in the liturgy', 'a warden who has stopped believing', 'the crown wanting the library'],
      sizes: ['sixty, most of them old', 'a mother house and eleven cells', 'two hundred, and growing where it should not'],
    },
  },
  {
    id: 'company',
    keywords: ['company', 'merchant', 'trade', 'guild', 'commerce', 'bank', 'caravan', 'charter'],
    themes: 'any',
    lexicon: {
      goals: ['hold the charter on the northern route another ten years', 'make its scrip legal tender in two more cities', 'ruin the family that undercut it', 'buy the mine before anyone else values it'],
      methods: ['undercut, absorb, then raise the price', 'lend generously and foreclose precisely', 'a contract with a clause nobody read', 'pay the escort better than the enemy can'],
      ranks: ['The Board', 'Factors', 'Caravan masters', 'Clerks', 'Bonded hands'],
      creed: ['a ledger does not lie and does not forgive', 'every risk has a price; find it', 'the route matters more than the goods'],
      assets: ['the accurate weights, and the ones for customers', 'warehouses in four cities', 'letters of credit honoured everywhere', 'the only insurer who will touch the pass'],
      frictions: ['a caravan lost with the whole season on it', 'a factor skimming and covering it well', 'a rival charter granted last spring'],
      sizes: ['three hundred on the books, half on the road', 'small and enormously rich', 'a name in eleven ports'],
    },
  },
  {
    id: 'rebels',
    keywords: ['rebel', 'resistance', 'insurgent', 'cell', 'revolution', 'uprising', 'underground', 'partisan'],
    themes: 'any',
    lexicon: {
      goals: ['make the province ungovernable before winter', 'free the prisoners taken after the market riot', 'prove what happened at the crossing and be believed', 'survive long enough to be a fact'],
      methods: ['nothing that cannot be denied', 'cells of five who do not know each other', 'strike the ledger, not the soldier', 'let the reprisal do the recruiting'],
      ranks: ['The cell', 'Couriers', 'Quartermaster', 'The name nobody says', 'Sympathisers'],
      creed: ['they cannot hang everyone', 'the occupation is not permanent; we are', 'a movement that needs one person is already dead'],
      assets: ['a printing press moved every nine days', 'half the dockhands, quietly', 'the tunnels under the old wall', 'one clerk inside the governor’s house'],
      frictions: ['an informer, certainly, but which one', 'a faction that wants to escalate', 'money that arrived from somewhere unexplained'],
      sizes: ['nineteen who act, four hundred who help', 'unknowable by design', 'small, and shrinking after the last raid'],
    },
  },
  {
    id: 'knights',
    keywords: ['knight', 'order', 'chivalry', 'militant', 'legion', 'sworn', 'warband', 'garrison'],
    themes: ['high-fantasy', 'mythic', 'grimdark'],
    lexicon: {
      goals: ['hold the pass, as sworn, until relieved', 'recover the standard taken at the ford', 'earn back a charter revoked for good reason', 'be the reason the border is quiet'],
      methods: ['the summons answered within the day', 'formation, discipline, and no pursuit', 'a challenge issued formally and meant', 'garrison, patrol, and be visible'],
      ranks: ['The Marshal', 'Sworn knights', 'Sergeants', 'Squires', 'The muster'],
      creed: ['an oath is the whole of the person', 'discipline is what courage looks like on a bad day', 'the road is held or it is not'],
      assets: ['the only heavy horse in the province', 'a keep at the narrowest point', 'four hundred years of the same drill', 'the right to raise the countryside'],
      frictions: ['a marshal too old to ride and too proud to stop', 'the crown three years behind on pay', 'an oath sworn to someone now disgraced'],
      sizes: ['sixty lances and their households', 'a garrison of two hundred', 'twelve left of the original hundred'],
    },
  },
  {
    id: 'cult',
    keywords: ['cult', 'cabal', 'secret', 'hidden', 'conspiracy', 'occult', 'sect', 'initiate'],
    themes: ['grimdark', 'mythic', 'modern', 'science-fiction'],
    lexicon: {
      goals: ['open the way beneath the reservoir', 'place one initiate in every guild hall', 'complete the count before the year turns', 'be there when it wakes, and be recognised'],
      methods: ['recruit the lonely and the recently bereaved', 'never more than three in a room', 'a favour first, an obligation after', 'the ritual performed in ordinary places'],
      ranks: ['The Voice', 'The Circle of Nine', 'Bearers', 'The counted', 'Those who do not know they are members'],
      creed: ['the world is a lid and we are the hinge', 'devotion is measured in what it costs', 'the truth is not for everyone and never was'],
      assets: ['members in three offices that matter', 'a building that does not appear on the survey', 'money from a source nobody has traced', 'the only surviving copy'],
      frictions: ['an initiate who wants out and knows too much', 'the Voice contradicting last year’s revelation', 'somebody has started asking about the reservoir'],
      sizes: ['forty who know, three hundred who attend', 'nine, exactly, always', 'growing faster than it can be controlled'],
    },
  },
  {
    id: 'scholars',
    keywords: ['scholar', 'academy', 'college', 'university', 'research', 'archive', 'institute', 'lab'],
    themes: 'any',
    lexicon: {
      goals: ['finish the survey before the funding stops', 'be the ones who publish it, not the coastal school', 'keep the restricted wing restricted', 'prove the thing everyone senior has staked a career against'],
      methods: ['footnotes, quietly devastating', 'a grant application dressed as a favour', 'send a junior and deny knowing them', 'publish first, apologise later'],
      ranks: ['The Chair', 'Fellows', 'Readers', 'Post-graduates', 'The archivist, who actually decides'],
      creed: ['a claim without a source is a rumour', 'the archive outlives every argument in it', 'someone must know, even if nobody acts'],
      assets: ['the archive, and the index only one person can read', 'a charter exempting it from search', 'correspondents in nine cities', 'the instrument nobody else has'],
      frictions: ['two fellows who will not be in the same room', 'a result that cannot be replicated', 'the patron asking what the money bought'],
      sizes: ['thirty fellows and a hundred students', 'small, ancient, and impossible to close', 'four people and a very good library'],
    },
  },
];

const KIND_BY_ARCHETYPE: Record<string, string> = {
  thieves: 'guild',
  'noble-house': 'house',
  order: 'order',
  company: 'guild',
  rebels: 'movement',
  knights: 'order',
  cult: 'cult',
  scholars: 'council',
};

function pickSlot(rng: Rng, arch: Archetype, slot: string): string {
  const pool = arch.lexicon[slot];
  return pool?.length ? rng.pick(pool) : '';
}

function some(rng: Rng, arch: Archetype, slot: string, max: number): string[] {
  const pool = arch.lexicon[slot] ?? [];
  if (!pool.length) return [];
  return rng.shuffle([...pool]).slice(0, rng.int(1, Math.min(max, pool.length)));
}

function refTo(entity: { id: string; type: string; name: string }) {
  return { id: entity.id, type: entity.type, name: entity.name };
}

function relatedRef(rng: Rng, ctx: GenCtx, type: string, p: number) {
  const candidates = ctx.known.filter((k) => k.type === type);
  if (!candidates.length || !rng.chance(p)) return undefined;
  return refTo(rng.pick(candidates));
}

function relatedRefs(rng: Rng, ctx: GenCtx, type: string, max: number, p: number, excludeId?: string) {
  const candidates = ctx.known.filter((k) => k.type === type && k.id !== excludeId);
  if (!candidates.length || !rng.chance(p)) return undefined;
  return rng
    .shuffle([...candidates])
    .slice(0, rng.int(1, Math.min(max, candidates.length)))
    .map(refTo);
}

/** One fully-fielded faction. `name` lets a batch generator pre-title. */
export function generateFactionDraft(
  rng: Rng,
  arch: Archetype,
  ctx: GenCtx,
  options: { name?: string } = {}
): BundleEntityDraft {
  const theme: ThemeId = ctx.theme;
  const name = options.name ?? factionName(rng, theme);
  const goals = some(rng, arch, 'goals', 3);
  const creed = pickSlot(rng, arch, 'creed');
  const asset = pickSlot(rng, arch, 'assets');
  const friction = pickSlot(rng, arch, 'frictions');
  const ranks = some(rng, arch, 'ranks', 4);

  const summary = `${cap(goals[0] ?? 'holds what it has')}. It believes ${creed}.`;
  const description =
    `${name} is best understood by what it will not do. It ${pickSlot(rng, arch, 'methods')}, and it has ` +
    `${asset}. The thing it is quietest about is ${friction}. ` +
    `Ask anyone inside what the group is for and you will get some version of: ${creed}.`;
  const structure = ranks.length
    ? `${ranks.join(' → ')}. Advancement is by ${rng.pick([
        'sponsorship, and the sponsor carries the blame',
        'time served, mostly',
        'one test nobody describes beforehand',
        'usefulness, measured openly',
      ])}.`
    : '';
  const ideology =
    `${cap(creed)}. In practice that means ${pickSlot(rng, arch, 'methods')} — ` +
    `${rng.chance(0.5) ? 'which the leadership calls pragmatism' : 'which their enemies call exactly what it is'}.`;

  const leader = relatedRef(rng, ctx, 'cast', 0.55);
  const members = relatedRefs(rng, ctx, 'cast', 3, 0.5, leader?.id);
  const headquarters = relatedRef(rng, ctx, 'locations', 0.6);
  const controlsLocations = relatedRefs(rng, ctx, 'locations', 2, 0.4);

  return {
    localId: newId(),
    type: 'factions',
    name,
    aliases: rng.chance(0.35) ? [`The ${placeName(rng, theme)} ${cap(arch.id.split('-')[0])}`] : [],
    summary,
    tags: [arch.id, KIND_BY_ARCHETYPE[arch.id] ?? 'other'],
    fields: {
      kind: KIND_BY_ARCHETYPE[arch.id] ?? 'other',
      description,
      size: cap(pickSlot(rng, arch, 'sizes')),
      ...(structure ? { structure } : {}),
      goals: goals.map(cap),
      methods: some(rng, arch, 'methods', 3).map(cap),
      ideology,
      ...(leader ? { leader } : {}),
      ...(members ? { members } : {}),
      ...(headquarters ? { headquarters } : {}),
      ...(controlsLocations ? { controlsLocations } : {}),
    },
  };
}

export const factionsPack: TypePack = {
  type: 'factions',
  archetypes: ARCHETYPES,
  generate: (rng, arch, ctx) => generateFactionDraft(rng, arch, ctx),
};
