import { newId } from '@/lib/id';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import type { Archetype, TypePack } from './index';
import { cap, creatureName, placeName, type ThemeId } from './lexicon';
import type { GenCtx } from './generic';

/** Deep bestiary pack: each archetype is one way of being dangerous — how it
 * hunts, what it wants, what finally stops it — and every field of a draft
 * pulls from that same well, so a swarm reads like a swarm from its diet to
 * its weaknesses. Follows `skills.ts` in structure and `quests.ts` in the
 * template-grammar approach. */

const ARCHETYPES: Archetype[] = [
  {
    id: 'apex',
    keywords: ['apex', 'predator', 'hunter', 'beast', 'alpha', 'stalker', 'wyrm', 'dragon'],
    themes: 'any',
    lexicon: {
      species: ['great cat', 'crested wyrm', 'horned bear', 'wolf-thing', 'antlered stalker', 'shore drake', 'ridge lion'],
      hunts: ['runs its prey to exhaustion', 'drops from an overhang without a sound', 'drives a herd toward water and waits', 'takes the last animal in the line', 'circles for a day before committing'],
      tells: ['a silence where birdsong should be', 'three-clawed prints deeper at the toe', 'kills cached high in the branches', 'a smell of hot copper on the wind'],
      parts: ['shoulder ridge', 'hooked dewclaw', 'double jaw', 'ribbed hide', 'blunt crown of horn'],
      habitats: ['old-growth ridgeline', 'flooded lowland forest', 'scree slopes above the treeline', 'the burnt country'],
      diets: ['large game, and whatever is slowest', 'anything it can drag', 'one heavy kill a fortnight', 'herd animals and their keepers'],
      weaknesses: ['will not cross deep water', 'poor eyesight in full dark', 'guards a kill past the point of sense', 'a wounded foreleg it favours'],
      abilities: ['bone-splitting bite', 'a charge that does not stop', 'tracking a scent for days', 'roar that scatters horses'],
      times: ['dusk', 'the hour before dawn', 'after heavy rain', 'the cold months'],
    },
  },
  {
    id: 'swarm',
    keywords: ['swarm', 'insect', 'flock', 'hive', 'locust', 'rats', 'plague', 'cloud'],
    themes: 'any',
    lexicon: {
      species: ['glass-winged locust', 'burrowing mite', 'sump rat', 'needle wasp', 'ash moth', 'carrion beetle'],
      hunts: ['strips a field in an afternoon', 'arrives as a shadow on the horizon', 'comes up through the floor at once', 'follows warmth and does not stop'],
      tells: ['a sound like rain on a roof with no rain', 'holes in the grain sacks', 'a shifting stain on the far hill', 'every dog in the village barking at nothing'],
      parts: ['single hooked leg', 'paper wing', 'segmented body no longer than a thumb', 'jaw that works sideways'],
      habitats: ['grain stores and granaries', 'the drainage tunnels', 'flood plains after the water drops', 'anywhere left standing empty'],
      diets: ['crops, cloth, and each other', 'anything with moisture in it', 'grain first, then leather, then worse'],
      weaknesses: ['smoke breaks the swarm apart', 'cold below freezing ends it', 'they will not cross running water', 'fire in a ring holds them'],
      abilities: ['numbers past counting', 'squeezing through any gap', 'stripping bone in minutes', 'moving as one body'],
      times: ['high summer', 'the wet season', 'whenever the wind turns', 'nightfall'],
    },
  },
  {
    id: 'undead',
    keywords: ['undead', 'ghoul', 'revenant', 'corpse', 'wight', 'zombie', 'barrow', 'grave'],
    themes: ['grimdark', 'high-fantasy', 'mythic'],
    lexicon: {
      species: ['barrow-wight', 'gravecrawler', 'tallow revenant', 'bound corpse', 'drowned man', 'ash-walker'],
      hunts: ['walks until something stops it', 'returns to the place it died', 'follows the person who buried it', 'goes where it went in life'],
      tells: ['grave soil turned from the inside', 'a cold that sits on the chest', 'candles guttering in still air', 'the dogs will not go near'],
      parts: ['gripping hand', 'jaw wired shut', 'ribcage packed with grave-goods', 'skin gone the colour of tallow'],
      habitats: ['the old barrow field', 'a battlefield nobody cleared', 'flooded crypts', 'the ground under a burnt house'],
      diets: ['nothing — it does not eat', 'warmth, and it never has enough', 'the memory of a meal'],
      weaknesses: ['the name it had in life', 'salt across the threshold', 'daylight slows it to a crawl', 'burning what it was buried with'],
      abilities: ['feeling no pain at all', 'a grip that does not tire', 'knowing where you buried the thing', 'walking through a night without rest'],
      times: ['the small hours', 'the anniversary of its death', 'any moonless night', 'after a grave is disturbed'],
    },
  },
  {
    id: 'construct',
    keywords: ['construct', 'golem', 'automaton', 'machine', 'guardian', 'clockwork', 'drone', 'sentinel'],
    themes: ['high-fantasy', 'science-fiction', 'mythic'],
    lexicon: {
      species: ['stone sentinel', 'clockwork warden', 'maintenance frame', 'bound servitor', 'lathe-golem', 'gate-keeper'],
      hunts: ['does not hunt — it patrols', 'repeats a route laid down long ago', 'engages anything without the mark', 'escalates one step at a time'],
      tells: ['a ticking under the flagstones', 'wear polished into a stone floor in one path', 'the same dent in every doorway', 'lamp-oil smell where no lamp burns'],
      parts: ['counterweight arm', 'governor spring', 'sigil-plate at the throat', 'articulated stone knuckle'],
      habitats: ['a vault nobody has opened', 'the approach to the old workshop', 'the ring corridor', 'wherever its maker set it down'],
      diets: ['nothing — it was never alive', 'a trickle of power from somewhere below', 'one charge a year, drawn from the floor'],
      weaknesses: ['the command phrase, if anyone remembers it', 'the sigil-plate, if you can reach it', 'water in the joints', 'it cannot follow past its boundary'],
      abilities: ['tireless strength', 'no fear of anything', 'perfect recall of one instruction', 'repairing itself overnight'],
      times: ['always — it does not sleep', 'whenever the boundary is crossed', 'on the hour', 'when the sigil is touched'],
    },
  },
  {
    id: 'spirit',
    keywords: ['spirit', 'ghost', 'wraith', 'shade', 'haunt', 'phantom', 'echo', 'fae'],
    themes: ['high-fantasy', 'mythic', 'grimdark', 'modern'],
    lexicon: {
      species: ['hearth-shade', 'weeping form', 'river spirit', 'lamplight haunt', 'the thing on the stair', 'grey woman'],
      hunts: ['does not take — it asks, and asking is the harm', 'draws people toward the water', 'repeats the last hour it had', 'appears to whoever is alone'],
      tells: ['a door that will not stay shut', 'breath fogging indoors', 'the smell of a room long since burnt', 'one set of footprints going out'],
      parts: ['a shape that is nearly a face', 'hands that leave frost', 'a hem always wet', 'no shadow at all'],
      habitats: ['the crossing', 'the upper landing', 'the mill pond', 'the room they kept locked'],
      diets: ['attention', 'grief, and there is always more', 'nothing anyone can name'],
      weaknesses: ['being answered honestly', 'the rite nobody performed', 'iron laid on the threshold', 'saying its name out loud'],
      abilities: ['passing through what is shut', 'knowing what you are ashamed of', 'being in two rooms at once', 'stopping a clock'],
      times: ['the hour it died', 'any night with fog', 'when someone is alone in the house', 'the turning of the year'],
    },
  },
  {
    id: 'aberration',
    keywords: ['aberration', 'horror', 'thing', 'wrong', 'mutant', 'anomaly', 'eldritch', 'corrupted'],
    themes: ['grimdark', 'science-fiction', 'mythic'],
    lexicon: {
      species: ['thing from the deep shaft', 'unnamed growth', 'wrong-shaped walker', 'the mistake', 'grafted horror'],
      hunts: ['takes something and leaves something', 'does not seem to be hunting at all', 'imitates what it took last', 'is simply there, and then closer'],
      tells: ['tracks that change shape halfway along', 'an animal that will not stop screaming', 'writing nobody remembers making', 'everyone recalls the night differently'],
      parts: ['limb with too many joints', 'mouth in an unhelpful place', 'skin that keeps sliding', 'an eye that is not paired'],
      habitats: ['the shaft below the workings', 'the flooded level', 'wherever the experiment was run', 'the blank spot on every map'],
      diets: ['not food, exactly', 'whatever it can incorporate', 'the part of you that could describe it'],
      weaknesses: ['being looked at directly by several people at once', 'the compound it was grown in', 'it cannot cross the old boundary stones', 'sustained, ordinary fire'],
      abilities: ['wearing a shape it has seen', 'being where it was not a moment ago', 'making a room feel wrong', 'healing what should be fatal'],
      times: ['after the pumps stop', 'the dark of the moon', 'whenever the seal is broken', 'no pattern anyone has found'],
    },
  },
  {
    id: 'mount',
    keywords: ['mount', 'steed', 'beast of burden', 'horse', 'companion', 'ride', 'draft', 'tame'],
    themes: 'any',
    lexicon: {
      species: ['long-legged courser', 'shaggy hill pony', 'six-legged drayer', 'salt camel', 'ridgeback', 'harnessed lizard'],
      hunts: ['does not hunt — it grazes and it carries', 'forages ahead of the column', 'follows the lead animal without question'],
      tells: ['cropped grass in a wide arc', 'dung still warm on the road', 'a picket line and three stakes', 'bells heard before the animal'],
      parts: ['deep chest', 'splayed foot for soft ground', 'heavy shoulder', 'coat that sheds in sheets'],
      habitats: ['upland pasture', 'the stock roads', 'wherever the caravans stop', 'the winter barns'],
      diets: ['grass, grain, and anything left unattended', 'browse and bark in a hard season', 'a bucket of mash after a long day'],
      weaknesses: ['bolts at fire', 'lame within a day on stony ground', 'will not pass the place it was frightened', 'needs more water than the party can carry'],
      abilities: ['carrying twice what it looks able to', 'sure feet on a bad path', 'sensing what the rider has not', 'a full day at pace'],
      times: ['daylight', 'the cool of the morning', 'whenever it is fed', 'all year, if sheltered'],
    },
  },
  {
    id: 'trickster',
    keywords: ['trickster', 'fey', 'shapeshifter', 'mimic', 'imp', 'thief', 'sly', 'bargain'],
    themes: ['high-fantasy', 'mythic', 'modern'],
    lexicon: {
      species: ['hedge-fey', 'coat thief', 'mimic', 'grinning small thing', 'road-sprite', 'borrower'],
      hunts: ['takes only what will be missed', 'trades, and the trade is always unfair', 'waits to be invited in', 'sets a problem and then sells the answer'],
      tells: ['a ring of flattened grass', 'the left boot gone and the right one polished', 'a bargain nobody remembers striking', 'coins that are warm'],
      parts: ['too many teeth, all small', 'hands better than the face deserves', 'a coat of borrowed cloth', 'ears that turn independently'],
      habitats: ['the hedgerow and the boundary ditch', 'markets after closing', 'the space between two houses', 'anywhere a rule is unclear'],
      diets: ['milk left out, and pride', 'whatever was promised', 'small kindnesses, taken literally'],
      weaknesses: ['bound by the exact words of a deal', 'cannot enter uninvited', 'counting — it must count spilled seed', 'its true name, held by someone patient'],
      abilities: ['wearing another shape for an hour', 'finding what was hidden', 'a bargain that always has a hook', 'vanishing between one blink and the next'],
      times: ['twilight', 'market days', 'when a promise is made', 'the nights between years'],
    },
  },
];

const CATEGORY_BY_ARCHETYPE: Record<string, string> = {
  apex: 'Beast',
  swarm: 'Beast',
  undead: 'Undead',
  construct: 'Construct',
  spirit: 'Spirit',
  aberration: 'Aberration',
  mount: 'Beast',
  trickster: 'Sapient',
};

const THREAT_BY_ARCHETYPE: Record<string, string[]> = {
  apex: ['major', 'apex', 'apex', 'mythic'],
  swarm: ['moderate', 'major', 'major'],
  undead: ['minor', 'moderate', 'major'],
  construct: ['moderate', 'major', 'unique'],
  spirit: ['minor', 'moderate', 'unknown'],
  aberration: ['major', 'apex', 'unknown', 'unique'],
  mount: ['mundane', 'mundane', 'minor'],
  trickster: ['minor', 'moderate', 'unknown'],
};

const DISPOSITION_BY_ARCHETYPE: Record<string, string[]> = {
  apex: ['territorial', 'ambush', 'hostile'],
  swarm: ['hostile', 'ambush'],
  undead: ['hostile', 'corrupted', 'unknowable'],
  construct: ['territorial', 'hostile', 'intelligent'],
  spirit: ['wary', 'unknowable', 'docile'],
  aberration: ['unknowable', 'corrupted', 'ambush'],
  mount: ['docile', 'wary'],
  trickster: ['intelligent', 'wary', 'unknowable'],
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

function relatedRefs(rng: Rng, ctx: GenCtx, type: string, max: number, p: number) {
  const candidates = ctx.known.filter((k) => k.type === type);
  if (!candidates.length || !rng.chance(p)) return undefined;
  return rng
    .shuffle([...candidates])
    .slice(0, rng.int(1, Math.min(max, candidates.length)))
    .map(refTo);
}

/** One fully-fielded creature. `name` lets a batch generator pre-title. */
export function generateCreatureDraft(
  rng: Rng,
  arch: Archetype,
  ctx: GenCtx,
  options: { name?: string } = {}
): BundleEntityDraft {
  const theme: ThemeId = ctx.theme;
  const name = options.name ?? creatureName(rng, theme);
  const species = pickSlot(rng, arch, 'species');
  const hunts = pickSlot(rng, arch, 'hunts');
  const tell = pickSlot(rng, arch, 'tells');
  const part = pickSlot(rng, arch, 'parts');
  const habitat = pickSlot(rng, arch, 'habitats');

  const summary = `A ${species} that ${hunts}.`;
  const description =
    `${cap(name)} is a ${species}, known mostly by its ${part}. It ${hunts}, and the first sign is usually ` +
    `${tell}. Those who live near ${habitat} have their own name for it and do not use it after dark.`;
  const behaviour =
    `${cap(hunts)}. It is most active ${pickSlot(rng, arch, 'times')}, and ${
      rng.chance(0.5)
        ? `will break off if the cost gets high enough`
        : `does not break off, which is what makes it a problem`
    }.`;
  const lifecycle = rng.chance(0.6)
    ? `Little is agreed on. What is certain: ${rng.pick([
        'it is rarely seen young',
        'there is never more than one in a valley',
        'the old ones are the dangerous ones',
        'it returns to the same ground to die',
      ])}, and ${rng.pick([
        'nobody has found a nest',
        'the remains rot faster than they should',
        'the carcass is worth more than the bounty',
      ])}.`
    : '';

  return {
    localId: newId(),
    type: 'bestiary',
    name,
    aliases: [],
    summary,
    tags: [arch.id, species.split(' ').pop() ?? arch.id],
    fields: {
      speciesType: cap(species),
      category: CATEGORY_BY_ARCHETYPE[arch.id] ?? 'Other',
      description,
      threatLevel: rng.pick(THREAT_BY_ARCHETYPE[arch.id] ?? ['moderate']),
      disposition: rng.pick(DISPOSITION_BY_ARCHETYPE[arch.id] ?? ['wary']),
      challenge: `${cap(arch.id)} · ${rng.pick(['solo', 'pair', 'pack of three to six', 'one, and that is enough'])}`,
      fightOrFlight: cap(hunts),
      habitat: cap(habitat),
      regions: [placeName(rng, theme), ...(rng.chance(0.5) ? [placeName(rng, theme)] : [])],
      activeTimes: some(rng, arch, 'times', 2),
      behaviour,
      abilities: some(rng, arch, 'abilities', 3).map(cap),
      weaknesses: some(rng, arch, 'weaknesses', 2).map(cap),
      diet: cap(pickSlot(rng, arch, 'diets')),
      ...(lifecycle ? { lifecycle } : {}),
      ...(relatedRefs(rng, ctx, 'locations', 2, 0.55)
        ? { encounterLocations: relatedRefs(rng, ctx, 'locations', 2, 1) }
        : {}),
      ...(relatedRefs(rng, ctx, 'factions', 1, 0.3)
        ? { relatedFactions: relatedRefs(rng, ctx, 'factions', 1, 1) }
        : {}),
    },
  };
}

export const bestiaryPack: TypePack = {
  type: 'bestiary',
  archetypes: ARCHETYPES,
  generate: (rng, arch, ctx) => generateCreatureDraft(rng, arch, ctx),
};
