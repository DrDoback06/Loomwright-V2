import { newId } from '@/lib/id';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import type { Archetype, TypePack } from './index';
import { cap, placeName } from './lexicon';
import type { GenCtx } from './generic';

/** Deep locations pack: each archetype is one coherent kind of place — its
 * sights, locals, hazards, and hooks all pull from the same well, so a
 * smugglers' den stays lamp-blacked from threshold to back exit. */

const ARCHETYPES: Archetype[] = [
  {
    id: 'port',
    keywords: ['city', 'port', 'harbor', 'harbour', 'dock', 'capital', 'market', 'trade', 'urban', 'ship'],
    themes: 'any',
    lexicon: {
      kinds: ['City', 'Port', 'Capital City', 'Town', 'District'],
      ilk: ['port city', 'harbor town', 'trading port', 'free port', 'river port'],
      titles: ['Port', 'Harbor', 'Docks', 'Anchorage'],
      adjectives: ['salt-stained', 'clamorous', 'mercantile', 'fog-bound', 'tide-worn', 'lantern-lit', 'gull-haunted', 'brine-scoured', 'restless', 'crowded'],
      features: ['a crane-forest of masts', 'the customs house and its long queue', 'a fish market louder than a battle', 'the tide bell tolling the hour', 'a lighthouse older than the city charter', "the smugglers' quay everyone pretends not to see", 'a sea wall patched after every storm', 'counting houses with barred windows'],
      inhabitants: ['dockhands', 'pilots and tide-readers', 'foreign factors', 'fishwives', 'harbor guards', 'ship-chandlers', 'press-gangs', 'moneylenders'],
      perils: ['press-gangs working the taverns', 'cutpurses thick as gulls', 'a tariff war turning bloody', 'plague ships waved through for a bribe', 'warehouse fires set for the insurance', "the harbormaster's private tolls"],
      rumors: ['a ship came in flying no colors and paid its fees in century-old coin', 'the lighthouse keeper signals to someone beyond the shoals', 'a whole crew vanished between anchoring and dawn', 'the customs ledgers burned the night before the audit', 'something in the harbor takes one swimmer every spring tide', "the harbormaster's daughter buys silence in three taverns", 'a chart of the old smuggling channels has been sold twice this month'],
      statuses: ['open for trade, watched by excisemen', 'under harbor quarantine', "gripped by a dockworkers' strike", 'flush from a record catch', 'half-blockaded by rival ships', 'rebuilding after the storm season'],
      climates: ['salt wind and sudden squalls', 'fog off the water most mornings', 'mild wet winters; roaring spring tides', 'humid summers that rot the pilings'],
      dangers: ['watched', 'risky', 'safe'],
    },
  },
  {
    id: 'fortress',
    keywords: ['fortress', 'keep', 'castle', 'citadel', 'garrison', 'wall', 'siege', 'stronghold', 'bastion'],
    themes: 'any',
    lexicon: {
      kinds: ['Fortress', 'Barracks', 'Palace', 'Prison', 'Gate'],
      ilk: ['border fortress', 'garrison keep', 'citadel', 'stronghold', 'walled redoubt'],
      titles: ['Keep', 'Citadel', 'Bastion', 'Garrison'],
      adjectives: ['unbreached', 'grim-walled', 'wind-scoured', 'garrisoned', 'battle-scarred', 'frost-rimed', 'looming', 'watchful', 'provisioned', 'stubborn'],
      features: ['murder holes above the gate', 'a double portcullis', 'the long stair to the beacon tower', 'cisterns cut deep into the rock', 'an armory smelling of oil and cold iron', 'banners of garrisons long rotated home', 'a killing ground of cleared earth', "the commandant's map room"],
      inhabitants: ['a proud, under-paid garrison', 'veteran sergeants', 'a commandant nursing old grudges', 'siege engineers', 'camp followers in the outer ward', 'quartermasters', 'signal-keepers', 'a chirurgeon and her orderlies'],
      perils: ['a garrison two winters behind on pay', "sappers' tunnels no one has mapped", 'the beacon lit by mistake — or not', 'a commandant quietly selling the stores', 'old breaches patched with rubble and hope', 'deserters who know the postern gate'],
      rumors: ['a postern gate was left unlocked the night the last commandant died', 'the garrison buries more men than the rolls admit', 'there is a room in the north tower nobody is posted to', 'the beacon was lit last winter and no one will say who answered', "sappers' tunnels run under the east wall, older than the wall itself", 'the pay chest has arrived light three musters running'],
      statuses: ['fully garrisoned and on alert', 'held by a skeleton watch', 'under a quiet siege of supply', 'recently changed hands', 'awaiting relief that is overdue', 'gates sealed by order from the capital'],
      climates: ['high, cold, and windward', 'built where the winters do the sentry work', 'dry summers, mud-season sieges', 'fog that swallows the valley below'],
      dangers: ['watched', 'risky', 'dangerous'],
    },
  },
  {
    id: 'wilds',
    keywords: ['forest', 'wood', 'mountain', 'wild', 'wilderness', 'peak', 'grove', 'valley', 'river', 'moor'],
    themes: ['high-fantasy', 'grimdark', 'mythic', 'modern'],
    lexicon: {
      kinds: ['Forest', 'Mountain', 'Valley', 'Swamp', 'Mountain Pass', 'River', 'Lake'],
      ilk: ['stretch of wilderness', 'old forest', 'mountain country', 'wild valley', 'trackless upland'],
      titles: ['Wilds', 'Deepwood', 'Heights', 'Reaches'],
      adjectives: ['trackless', 'old-growth', 'mist-wreathed', 'root-tangled', 'unmapped', 'moss-shrouded', 'snow-fed', 'pathless', 'green-dark', 'echoing'],
      features: ['a canopy that never quite lets the sun through', 'game trails that circle back on themselves', 'a river cold enough to stop the heart', 'standing stones swallowed by moss', 'a treeline that ends too abruptly', 'claw-marks higher than a man can reach', 'a hollow where no birds sing', 'cairns left by travellers who wanted to be found'],
      inhabitants: ['charcoal burners at the margins', 'a hermit who trades in weather-lore', 'wolves that follow but never close', 'poachers and the wardens who hunt them', 'things glimpsed only as movement', 'a woodcutter clan of few words', 'migrating herds', "the last keepers of old shrines"],
      perils: ['flash floods down the gorges', 'a false trail that has killed before', 'rockslides loosened by spring melt', 'whatever keeps the deer out of the eastern stands', 'sinkholes under innocent turf', 'cold that comes down off the peaks without warning'],
      rumors: ['lights move under the canopy on moonless nights', 'a trapper came back speaking a language he never learned', "the standing stones are further apart every time they're counted", 'the river gives back what it takes, a year later and downstream', 'no map of the interior agrees with any other', 'the wolves here answer to something'],
      statuses: ['unclaimed by any crown', 'closed by the wardens after the disappearances', 'logged at the fringes, untouched at the heart', 'crossed only in high summer'],
      climates: ['deep snows and short thaws', 'wet, green, and cold at the root', 'mountain weather — four seasons before noon', 'mist until midday, downpour by dusk'],
      dangers: ['risky', 'dangerous', 'forbidden'],
    },
  },
  {
    id: 'ruins',
    keywords: ['ruin', 'ruins', 'dungeon', 'tomb', 'crypt', 'barrow', 'abandoned', 'sunken', 'buried', 'forgotten'],
    themes: 'any',
    lexicon: {
      kinds: ['Ruins', 'Dungeon', 'Battlefield', 'Graveyard', 'Cave', 'Tunnel'],
      ilk: ['ruin', 'fallen city', 'buried complex', 'plundered tomb-field', 'drowned quarter'],
      titles: ['Ruins', 'Barrows', 'Vaults', 'Bones'],
      adjectives: ['toppled', 'half-buried', 'vine-strangled', 'sunken', 'plundered', 'sealed', 'collapsed', 'time-eaten', 'silent', 'echoing'],
      features: ['a gate carved for something taller than men', 'stairs descending past the reach of torchlight', 'friezes defaced with deliberate care', 'a hall where every door was barred from the inside', 'roots prying the flagstones apart', 'an altar swept clean when nothing else is', 'inscriptions in a script no one reads anymore', "looters' scaffolding, abandoned mid-job"],
      inhabitants: ['scavengers picking the shallow halls', "an antiquarian who won't say who funds her", 'beasts denned in the fallen towers', 'ghost-stories with too many witnesses', 'tomb-bees nesting in the dry vaults', 'a mad survivor of the last expedition'],
      perils: ['floors rotted over deep cellars', 'wards that never lapsed', 'the weight of everything above', 'looters who dislike company', 'bad air in the lower galleries', 'whatever the last expedition woke'],
      rumors: ["the last expedition came out one lantern short and won't say why", 'coins from the deep halls spend badly — luck follows them home', 'a scholar bought every survey of the site, then burned her notes', 'singing rises, some nights, from under the fallen dome', 'the sealed door was found open, and nobody admits to it', 'looters mark the safe halls with chalk, and the marks keep moving'],
      statuses: ['picked over, but only near the surface', 'sealed by decree after the last dig', 'freshly exposed by the landslide', 'claimed by three parties, held by none'],
      climates: ['dry, still air that tastes of dust', 'a cold that has nothing to do with weather', 'damp galleries and dripping stone', 'overgrown and humming with insects'],
      dangers: ['dangerous', 'forbidden', 'risky'],
    },
  },
  {
    id: 'hamlet',
    keywords: ['village', 'hamlet', 'town', 'farm', 'rural', 'mill', 'inn', 'crossroads', 'pastoral'],
    themes: ['high-fantasy', 'grimdark', 'mythic', 'modern'],
    lexicon: {
      kinds: ['Village', 'Town', 'Farm', 'Tavern / Inn', 'Bridge'],
      ilk: ['village', 'farming hamlet', 'crossroads town', 'parish', 'mill town'],
      titles: ['Village', 'Hamlet', 'Crossing', 'Commons'],
      adjectives: ['sleepy', 'tight-knit', 'weatherworn', 'stubborn', 'hedge-bound', 'smoke-wisped', 'close-mouthed', 'muddy', 'harvest-proud', 'honest'],
      features: ['one inn, one well, and one story everyone tells differently', 'a mill that grinds for three villages', 'a shrine no larger than a wardrobe', 'the crossroads gallows, long unused', 'dry-stone walls older than the parish rolls', 'a green where all disputes are settled', 'the big barn everyone helped raise', 'a bell rung only for fire, flood, or war'],
      inhabitants: ['farmers who read the sky like scripture', 'a blacksmith who came from elsewhere and never says where', "the miller's sprawling family", 'a healer paid in eggs and gratitude', 'shepherds who winter in the high folds', 'the innkeeper, who hears everything', 'a priest of a very small congregation', 'elders who remember the last bad year'],
      perils: ['a bad harvest one storm away', 'wolves pushing closer each winter', "a landlord's rising rents", 'feuds older than their causes', 'conscription officers on the roads', 'something taking sheep on the far pastures'],
      rumors: ["the miller's youngest saw lights over the far pasture again", 'the innkeeper keeps a room ready for someone who never comes', 'the last bad year ended with a bargain no one will describe', 'a stranger asks after the same grave every spring', 'the well runs sweet except for one week a year', 'the elders pay a tithe nobody collects in daylight'],
      statuses: ['quiet, prospering, and wary of strangers', 'half-emptied by the levy', 'feuding over water rights', 'saving up its courage to ask for help'],
      climates: ['mild valleys and honest rain', 'long winters the granaries just outlast', 'dry uplands where every well matters', 'river-mist mornings, golden evenings'],
      dangers: ['safe', 'watched'],
    },
  },
  {
    id: 'sanctum',
    keywords: ['temple', 'shrine', 'holy', 'sacred', 'monastery', 'sanctuary', 'pilgrim', 'altar', 'abbey', 'divine'],
    themes: ['high-fantasy', 'grimdark', 'mythic'],
    lexicon: {
      kinds: ['Temple / Shrine', 'Landmark', 'Library', 'Portal'],
      ilk: ['holy site', 'temple complex', 'pilgrim shrine', 'cloistered sanctuary', 'high fane'],
      titles: ['Shrine', 'Sanctum', 'Temple', 'Cloister'],
      adjectives: ['consecrated', 'candle-lit', 'vaulted', 'hushed', 'incense-sweet', 'pilgrim-worn', 'cloistered', 'gilded', 'austere', 'vigilant'],
      features: ['a reliquary behind three locks and one prayer', 'steps worn hollow by ten generations of knees', 'bells cast with the names of the dead', 'a garden where silence is the rule', 'icons whose eyes have been carefully scratched out — or restored', 'a font that never quite freezes', 'cells for penitents and the occasional fugitive', 'offering-nooks stuffed with wax and wishes'],
      inhabitants: ['an aging hierophant and ambitious deacons', 'pilgrims arrived by three roads', 'novices with more doubt than they admit', 'a warden of relics', 'anchorites walled into the east cloister', 'beggars who know the kitchen door', 'choristers', 'a sacristan who counts everything twice'],
      perils: ['sanctuary claimed by dangerous guests', 'a heresy taking root among the novices', 'relic-thieves with inside help', 'a rite that must not be interrupted', 'tithes that attract the wrong attention', "the god's attention, if the stories are true"],
      rumors: ['the relic sweats in its case when war is coming', 'a novice took the anchorite her meal and came back changed', 'the crypts hold one coffin more than the records do', 'the god answered a prayer here once, and the fee is still being paid', 'the bells rang by themselves the night the old hierophant died', 'a pilgrim was healed last spring, and the priests seem worried rather than glad'],
      statuses: ['open to pilgrims at all hours', 'closed for a rite of purification', 'divided by a quiet schism', 'under the protection of an uneasy patron'],
      climates: ['still air, candle-warm even in winter', 'mountain cold the braziers barely blunt', 'cloister gardens green out of season', 'incense haze and slanted light'],
      dangers: ['safe', 'watched', 'forbidden'],
    },
  },
  {
    id: 'den',
    keywords: ['thieves', 'criminal', 'den', 'underworld', 'smuggler', 'gang', 'black', 'hideout', 'syndicate', 'sewer'],
    themes: 'any',
    lexicon: {
      kinds: ['District', 'Sewer', 'Tavern / Inn', 'Shop', 'Building'],
      ilk: ['den of thieves', "smugglers' warren", 'underworld haunt', 'black market', 'safe-house quarter'],
      titles: ['Warrens', 'Den', 'Undermarket', 'Burrows'],
      adjectives: ['lamp-blacked', 'password-locked', 'smoke-hazed', 'ill-lit', 'knife-quiet', 'counterfeit', 'watchful', 'low-ceilinged', 'deniable', 'loyal'],
      features: ['a door that opens to the right knock only', 'a false cellar under an honest shop', "ledgers written in butcher's cipher", "an exit no one mentions until it's needed", 'a fighting pit gone quiet since the raid', 'fencing tables sorted by how hot the goods are', 'a shrine to luck nobody jokes about', 'peepholes in every landing'],
      inhabitants: ['a boss who never raises her voice', 'fences and forgers', 'runners too young to hang', 'a bruiser with debts of his own', 'lookouts on three corners', 'a corrupt watchman on retainer', 'card sharps', 'the old poisoner everyone is polite to'],
      perils: ['a rat somewhere in the crew', 'the watch, when the bribes run late', 'a rival crew counting the same territory', 'debts called in at the worst hour', "the boss's temper, quiet as it is", 'jobs that pay too well to be safe'],
      rumors: ['the boss keeps a ledger of favors that frightens even the fences', 'someone sold the crew out before the raid, and is still at the table', 'there is a job coming that pays in pardons', 'the watch captain drinks free here, and everyone pretends not to know', 'a vault under the old bathhouse has never been cracked', 'the poisoner is retired — everyone agrees, loudly'],
      statuses: ['flush after a good season', 'lying low since the raid', 'at war with the river gangs', 'under new and unproven management'],
      climates: ['cellar-damp and candle smoke', 'warm with bodies and suspicion', 'cold enough to see your own lies', 'airless in summer, close all year'],
      dangers: ['risky', 'dangerous', 'watched'],
    },
  },
  {
    id: 'outpost',
    keywords: ['frontier', 'outpost', 'border', 'edge', 'waystation', 'colony', 'remote', 'trailhead', 'settlement'],
    themes: 'any',
    lexicon: {
      kinds: ['Fortress', 'Town', 'Village', 'Mine', 'Road'],
      ilk: ['frontier outpost', 'border settlement', 'waystation', 'far colony', 'trailhead camp'],
      titles: ['Outpost', 'Waystation', 'Camp', 'Landing'],
      adjectives: ['far-flung', 'half-built', 'palisaded', 'hard-bitten', 'windblown', 'provisional', 'stubborn', 'under-manned', 'lonely', 'raw-timbered'],
      features: ['a palisade patched with wagon boards', 'the signal tower, watched in shifts', 'a trade post that doubles as courthouse', 'graves from the first winter, kept tidy', 'maps with more hope than detail', 'a stockyard for whatever the land allows', 'one road in, weather permitting', 'stores counted twice a week'],
      inhabitants: ['settlers who bet everything on this', 'a warden with too few deputies', 'guides who know which silences matter', 'trappers and prospectors', 'a clerk keeping the only records for a hundred miles', 'natives of the land, watching the newcomers', 'deserters turned homesteaders', 'a preacher or a doctor, never both'],
      perils: ['a supply train two weeks overdue', 'winter arriving early and staying late', 'raids out of the debatable lands', 'fever with no physician nearer than the capital', 'quarrels no law is close enough to settle', 'the wilderness taking back the cleared ground'],
      rumors: ['the first expedition is still out there, some say, still mapping', "the warden burns the reports she doesn't send", 'something walks the palisade line on the dark of the moon', 'the natives\' word for this valley means "borrowed"', 'a prospector paid for his drinks in gold nobody can source', 'the last supply train carried a locked crate no manifest lists'],
      statuses: ['holding on, barely', 'growing faster than its walls', 'cut off since the pass closed', 'awaiting a garrison promised twice'],
      climates: ['weather with opinions and no witnesses', 'dust in summer, axle-deep mud in fall', 'winters measured in what survives them', 'wind that never fully stops'],
      dangers: ['risky', 'watched', 'dangerous'],
    },
  },
];

function pickSlot(rng: Rng, arch: Archetype, slot: string): string {
  const pool = arch.lexicon[slot];
  return pool?.length ? rng.pick(pool) : '';
}

/** "Silvermere", "The Ruins of Thornvale", "Frostreach Keep". */
export function locationNameFor(rng: Rng, arch: Archetype, ctx: GenCtx): string {
  const place = placeName(rng, ctx.theme);
  const title = pickSlot(rng, arch, 'titles');
  const forms = [
    () => place,
    () => place,
    () => `The ${title} of ${place}`,
    () => `${place} ${title}`,
  ];
  return rng.pick(forms)();
}

/** Related-multi filler: sample known entities of one type, or omit. */
function linkKnown(
  rng: Rng,
  ctx: GenCtx,
  type: string,
  p: number
): { id: string; type: string; name: string }[] | undefined {
  const candidates = ctx.known.filter((k) => k.type === type);
  if (!candidates.length || !rng.chance(p)) return undefined;
  return rng
    .shuffle(candidates)
    .slice(0, rng.int(1, Math.min(2, candidates.length)))
    .map((k) => ({ id: k.id, type: k.type, name: k.name }));
}

/** One fully-fielded location. Coordinates/atlas placement stay empty —
 * pinning to a map is a deliberate act, never a dice roll. */
export function generateLocationDraft(
  rng: Rng,
  arch: Archetype,
  ctx: GenCtx,
  opts: { name?: string } = {}
): BundleEntityDraft {
  const name = opts.name ?? locationNameFor(rng, arch, ctx);
  const adjective = () => pickSlot(rng, arch, 'adjectives');
  const feature = () => pickSlot(rng, arch, 'features');
  const inhabitants = () => pickSlot(rng, arch, 'inhabitants');
  const peril = () => pickSlot(rng, arch, 'perils');
  const rumor = () => pickSlot(rng, arch, 'rumors');
  const ilk = () => pickSlot(rng, arch, 'ilk');

  const summary = rng.pick([
    () => `A ${adjective()} ${ilk()} where ${inhabitants()} keep to their business and strangers are noticed.`,
    () => `${cap(adjective())} and ${adjective()} — marked on few maps, remembered by everyone who leaves.`,
    () => `A ${adjective()} ${ilk()}; travellers speak of ${feature()}, and of ${peril()}.`,
    () => `A ${adjective()} ${ilk()} known for ${feature()} — and whispered about for ${peril()}.`,
  ])();

  const description =
    `${name} is a ${adjective()} ${ilk()}. Arriving, you notice ${feature()} first, ` +
    `then ${feature()}. ${cap(inhabitants())} ${rng.pick(['come and go', 'run things in practice', 'keep the place alive', 'watch newcomers carefully'])}, ` +
    `and everyone knows about ${peril()} — though few say so aloud.`;

  const history =
    `${rng.pick(['Older than its records', 'Founded on a promise nobody kept', 'Built, burned, and built again', 'Named and renamed by every power that held it'])}, ` +
    `it has outlasted ${peril()} and worse. What it has not outlived is the story that ${rumor()}.`;

  const culture =
    `${cap(inhabitants())} and ${inhabitants()} share the place, not always easily. ` +
    `${rng.pick(['Hospitality', 'Silence', 'Debt', 'Custom', 'Reputation'])} is the local currency.`;

  const fields: Record<string, unknown> = {
    kind: pickSlot(rng, arch, 'kinds'),
    danger: pickSlot(rng, arch, 'dangers'),
    description,
    history,
    culture,
    climate: `${cap(pickSlot(rng, arch, 'climates'))}.`,
    currentStatus: cap(pickSlot(rng, arch, 'statuses')),
    routes: Array.from({ length: rng.int(2, 3) }, () => placeName(rng, ctx.theme)),
  };

  // A private hook the writer can pay off later.
  if (rng.chance(0.8)) fields.notes = `Hook: ${rumor()}.`;

  // Links resolve only against entities the project already knows.
  const parents = ctx.known.filter((k) => k.type === 'locations');
  if (parents.length && rng.chance(0.5)) {
    const parent = rng.pick(parents);
    fields.parentId = { id: parent.id, type: parent.type, name: parent.name };
  }
  const links: [string, string, number][] = [
    ['characters', 'cast', 0.5],
    ['factions', 'factions', 0.5],
    ['bestiary', 'bestiary', 0.35],
    ['items', 'items', 0.35],
    ['quests', 'quests', 0.35],
    ['events', 'events', 0.35],
  ];
  for (const [fieldId, type, p] of links) {
    const refs = linkKnown(rng, ctx, type, p);
    if (refs) fields[fieldId] = refs;
  }

  return {
    localId: newId(),
    type: 'locations',
    name,
    aliases: rng.chance(0.35) ? [`the ${adjective()} ${pickSlot(rng, arch, 'titles').toLowerCase()}`] : [],
    summary,
    tags: [arch.id, adjective()],
    fields,
  };
}

export const locationsPack: TypePack = {
  type: 'locations',
  archetypes: ARCHETYPES,
  generate: (rng, arch, ctx) => generateLocationDraft(rng, arch, ctx),
};
