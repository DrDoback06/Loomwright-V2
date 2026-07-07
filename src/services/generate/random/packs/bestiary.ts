import { newId } from '@/lib/id';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import type { Archetype, TypePack } from './index';
import { article, cap, creatureName, placeName, type ThemeId } from './lexicon';
import type { GenCtx } from './generic';

/** Deep bestiary pack: each archetype is one coherent kind of monster —
 * its shape, habits, hunting style, and weaknesses all pull from the same
 * well, so a swarm behaves like a swarm from its diet down to its dread.
 *
 * Slot conventions: `speciesTypes` seed the "type / species" line, `parts`
 * are anatomy nouns for description ("mandibles", "many eyes"), `verbs`
 * are how it acts on prey, `habits` are third-person behaviour clauses,
 * `stages` are lifecycle clauses. Option-backed slots (`categories`,
 * `threats`, `dispositions`) hold exact lowercase strings from the
 * bestiary entity config — duplicates act as weights. */

const ARCHETYPES: Archetype[] = [
  {
    id: 'apex',
    keywords: ['predator', 'apex', 'hunter', 'beast', 'wolf', 'cat', 'stalker', 'alpha', 'pack'],
    themes: 'any',
    lexicon: {
      speciesTypes: ['great predatory cat', 'dire wolf-kin', 'crag-drake', 'horned hunting-beast', 'six-limbed stalker', 'pack-hunting reptile'],
      parts: ['claws', 'jaws', 'shoulders', 'hindquarters', 'hackles', 'fangs', 'eyes', 'sinews'],
      verbs: ['stalks', 'runs down', 'pins', 'throat-crushes', 'drags off', 'circles', 'scatters'],
      abilities: ['silent stalk', 'burst sprint', 'throat-lock bite', 'pack coordination', 'scent tracking', 'night-eyes', 'bone-crushing jaws', 'lunging pounce'],
      weaknesses: ['fire', 'open ground', 'loud noise', 'a full belly', 'wounded pride', 'the young are vulnerable'],
      habitats: ['the high crags above the tree line', 'old-growth forest and its game-trails', 'the cold scrub at the edge of settled land', 'a hunting range it patrols for miles'],
      regions: ['the Frostmark', 'the Greenmarch', 'the Crag Reaches', 'the Shadowed Wolds', 'the Broken Hills'],
      diets: ['large grazing beasts, and the occasional careless shepherd', 'whatever it can run down before dark', 'anything slower and warmer than itself', 'the herds, in lean months the herders'],
      postures: ['Stalks, then pounces', 'Runs its prey to exhaustion', 'Ambushes from cover, once', 'Tests the herd, culls the weak'],
      challenges: ['CR 9 · solitary apex', 'CR 7 · hunts in a pack of four', 'Apex · clears a valley of rivals', 'Major threat to travellers, minor to a war-band'],
      habits: ['marks the bounds of its range and defends them to the death', 'goes silent for days, then takes prey in a single heartbeat', 'follows caravans for a week before it strikes', 'will not share a kill, even with its own'],
      stages: ['whelped in a hidden den, driven off at two winters to claim its own range', 'the largest of a litter eats the rest — only the hungriest survive', 'takes a decade to reach full size and never stops growing after'],
      activeTimes: ['dusk', 'the dead of night', 'the lean end of winter', 'the hour before dawn'],
      categories: ['Beast', 'Beast', 'Hybrid'],
      threats: ['major', 'apex', 'apex', 'moderate'],
      dispositions: ['territorial', 'hostile', 'ambush', 'wary'],
    },
  },
  {
    id: 'swarm',
    keywords: ['swarm', 'insects', 'locust', 'rats', 'flock', 'plague', 'horde', 'infestation', 'hive'],
    themes: 'any',
    lexicon: {
      speciesTypes: ['carrion-swarm', 'biting cloud-insect', 'plague of tunnel-rats', 'chittering hive-thing', 'flensing beetle-drift', 'devouring locust-front'],
      parts: ['mandibles', 'wing-cases', 'countless legs', 'antennae', 'stingers', 'clicking jaws', 'single moving mass'],
      verbs: ['engulfs', 'strips', 'boils over', 'pours through', 'blankets', 'devours', 'floods'],
      abilities: ['stripping bite', 'suffocating mass', 'squeeze through any gap', 'blot out lantern-light', 'devour in seconds', 'split and re-form', 'follow warmth'],
      weaknesses: ['fire', 'smoke', 'deep water', 'cold snaps', 'a single killing frost', 'sealed doors'],
      habitats: ['warm middens and the dark beneath granaries', 'the flooded undercity where nothing else will nest', 'rotting fields after the rains', 'any place with food and no light'],
      regions: ['the Rotwater Fens', 'the Undercroft', 'the Blighted Lowlands', 'the Sump District', 'the grain-country'],
      diets: ['everything organic, and it is never full', 'crops, carrion, and anything left too long', 'grain stores, then the granary cats, then the granary keeper', 'flesh, cloth, and paper alike'],
      postures: ['Engulfs, then moves on', 'Follows the food and the warmth', 'Floods a space and drowns it', 'Retreats from flame, returns by dark'],
      challenges: ['CR 6 · lethal in a closed room, harmless in the open', 'Swarm · scale-dependent — a nuisance or a catastrophe', 'Moderate · kills the sleeping, spares the ready', 'Major threat to a village, minor to a torch'],
      habits: ['moves as one body with no head to cut off', 'is drawn to warmth, blood, and the smell of the dying', 'goes to ground at the first flame and pours back the moment it gutters', 'leaves nothing but clean bone and stripped fields'],
      stages: ['breeds in weeks, doubling with every warm season', 'a queen or nest-heart births thousands; kill it and the swarm scatters and dies', 'lies dormant as eggs through winter, hatches all at once in the first thaw'],
      activeTimes: ['high summer', 'after the rains', 'the warm hours', 'any time it is dark'],
      categories: ['Beast', 'Aberration', 'Hybrid'],
      threats: ['moderate', 'major', 'minor', 'moderate'],
      dispositions: ['hostile', 'ambush', 'territorial'],
    },
  },
  {
    id: 'undead',
    keywords: ['undead', 'ghoul', 'skeleton', 'wight', 'zombie', 'revenant', 'corpse', 'grave', 'risen'],
    themes: ['high-fantasy', 'grimdark', 'mythic'],
    lexicon: {
      speciesTypes: ['grave-risen wight', 'barrow-ghoul', 'shambling corpse-thing', 'bound revenant', 'hunger-driven ghast', 'cairn-guardian'],
      parts: ['grave-cold hands', 'lipless grin', 'hollowed sockets', 'rope-scarred throat', 'blackened fingernails', 'bared and yellow teeth'],
      verbs: ['claws', 'drags', 'reaches for', 'shambles after', 'clutches at', 'moans toward'],
      abilities: ['feels no pain', 'grip that will not loosen', 'chilling touch', 'endless patience', 'cannot be reasoned with', 'reknits severed limbs', 'sees warmth in the dark'],
      weaknesses: ['fire', 'salt', 'consecrated ground', 'severing the head', 'a name spoken true', 'daylight'],
      habitats: ['old barrows and forgotten graveyards', 'the flooded crypts below the cathedral', 'a battlefield that was never given rites', 'wherever it was buried wrong'],
      regions: ['the Barrow Downs', 'the Ossuary Quarter', 'the Gallowsfield', 'the Silent Reaches', 'the Threnody Hills'],
      diets: ['nothing — it is driven by hunger it cannot sate', 'the warmth of the living, which it envies', 'grave-goods and the flesh of the newly dead', 'it does not eat; it only wants'],
      postures: ['Shambles forward, never stops', 'Waits in the dark of its tomb', 'Rises when the ground is disturbed', 'Guards its cairn until the world ends'],
      challenges: ['CR 5 · relentless, not fast', 'Moderate · deadly in numbers, slow alone', 'Major · a grave-tide of them', 'Minor · until you run out of daylight'],
      habits: ['remembers, dimly, the grudge that raised it', 'walks the same path it walked in life, over and over', 'will not cross running water or consecrated stone', 'answers to whoever raised it, if anyone still holds the binding'],
      stages: ['raised by a curse, a broken rite, or a debt left unpaid; it does not age, only rots', 'when the binding that holds it breaks, it falls still forever', 'each one it kills without rites may rise to walk beside it'],
      activeTimes: ['moonless nights', 'the witching hour', 'the anniversary of its death', 'whenever its grave is opened'],
      categories: ['Undead', 'Undead', 'Undead', 'Spirit'],
      threats: ['moderate', 'major', 'minor', 'apex'],
      dispositions: ['hostile', 'ambush', 'unknowable', 'corrupted'],
    },
  },
  {
    id: 'construct',
    keywords: ['construct', 'golem', 'automaton', 'machine', 'clockwork', 'guardian', 'sentinel', 'drone', 'android'],
    themes: 'any',
    lexicon: {
      speciesTypes: ['stone-and-sigil golem', 'clockwork sentinel', 'bound elemental engine', 'salvaged war-automaton', 'ritual guardian', 'humming ward-construct'],
      parts: ['iron joints', 'graven core', 'grinding gears', 'single lens-eye', 'plated shoulders', 'rune-lit chest'],
      verbs: ['crushes', 'seizes', 'sweeps aside', 'pins', 'processes', 'grinds down'],
      abilities: ['tireless', 'immune to pain and fear', 'crushing grip', 'follows its last order forever', 'ignores poison and disease', 'self-repairs given time', 'sees through illusion'],
      weaknesses: ['its command-word', 'a shattered core', 'rust and neglect', 'water in the works', 'lightning', 'the sigil that binds it'],
      habitats: ['the ruined workshop that built it', 'a vault it was set to guard an age ago', 'the halls of a fallen order', 'wherever its maker abandoned it'],
      regions: ['the Cinder Foundries', 'the Vaulted City', 'the Deep Manufactory', 'the Sunken Archive', 'the Clockwork Reach'],
      diets: ['nothing — it runs on the power bound into it', 'a slow trickle of the energy that animates it', 'it neither eats nor tires nor sleeps', 'the last of a reservoir that will one day run dry'],
      postures: ['Stands guard until provoked', 'Executes its orders without mercy', 'Advances at a measured, unstoppable pace', 'Ignores all who give the right sign'],
      challenges: ['CR 8 · slow, patient, nearly unkillable', 'Major · defence is everything, speed is nothing', 'Moderate · trivial if you know the word', 'Apex · a war-engine out of its age'],
      habits: ['repeats the last command it was given, long after the giver is dust', 'ignores anyone bearing the right sigil or password', 'stands utterly still for years, then moves without warning', 'cannot be reasoned with, only redirected or destroyed'],
      stages: ['built, bound, and set to a task; it does not grow, only wears down', 'runs until its core cracks or its binding fails, then falls silent forever', 'a skilled artificer can wake it, reforge it, or turn it to a new master'],
      activeTimes: ['whenever its vault is entered', 'on a schedule no one remembers setting', 'the moment a ward is tripped', 'always — it never rests'],
      categories: ['Construct', 'Construct', 'Construct', 'Aberration'],
      threats: ['major', 'apex', 'moderate', 'major'],
      dispositions: ['territorial', 'hostile', 'wary', 'unknowable'],
    },
  },
  {
    id: 'spirit',
    keywords: ['spirit', 'ghost', 'wraith', 'phantom', 'haunt', 'shade', 'apparition', 'poltergeist', 'ancestor'],
    themes: ['high-fantasy', 'grimdark', 'mythic', 'modern'],
    lexicon: {
      speciesTypes: ['restless haunting', 'grief-bound shade', 'vengeful wraith', 'ancestor-spirit', 'drowned phantom', 'threshold-haunt'],
      parts: ['cold that has no source', 'half-seen shape', 'eyes that hold on you', 'voice at the edge of hearing', 'fingers of frost', 'face you almost recognise'],
      verbs: ['chills', 'whispers to', 'follows', 'reaches through', 'weeps over', 'reaches for'],
      abilities: ['passes through walls', 'unfelt until it is too late', 'chills the blood to fear', 'moves objects unseen', 'shows the manner of its death', 'cannot be struck by steel', 'knows your name'],
      weaknesses: ['salt and iron', 'its unfinished business resolved', 'the truth of its death spoken aloud', 'consecration', 'a proper burial', 'dawn'],
      habitats: ['the house where it died', 'a crossroads it cannot leave', 'the still water that drowned it', 'the room where the wrong was done'],
      regions: ['the Old Quarter', 'the Weeping Marshes', 'the Hollow Manor', 'the Fogbound Coast', 'the Mourner’s Reach'],
      diets: ['nothing of flesh — it hungers for what it lost', 'the fear and grief of the living', 'attention, memory, acknowledgement', 'it does not eat; it only lingers'],
      postures: ['Haunts, warns, then rages', 'Appears at the same hour, the same place', 'Follows one soul until its wrong is righted', 'Guards the threshold of its death'],
      challenges: ['CR 6 · cannot be fought, only laid to rest', 'Moderate · dangerous to the mind, not the body', 'Major · when grief curdles to malice', 'Minor · frightening, rarely lethal'],
      habits: ['re-enacts the moment of its death at the same hour each night', 'grows stronger where it is feared and weaker where it is pitied', 'cannot rest until a specific wrong is set right', 'means no harm at first, and every harm at last'],
      stages: ['born of a death gone wrong — betrayal, drowning, a promise unkept', 'fades the moment its unfinished business is resolved', 'left to fester, a mournful shade curdles into a killing wraith'],
      activeTimes: ['the anniversary of its death', 'the small hours', 'in fog and rain', 'whenever its name is spoken'],
      categories: ['Spirit', 'Spirit', 'Undead', 'Unique'],
      threats: ['moderate', 'major', 'minor', 'unknown'],
      dispositions: ['unknowable', 'wary', 'corrupted', 'hostile'],
    },
  },
  {
    id: 'aberration',
    keywords: ['aberration', 'horror', 'eldritch', 'mutant', 'thing', 'wrong', 'tentacle', 'nightmare', 'anomaly'],
    themes: ['grimdark', 'science-fiction', 'mythic'],
    lexicon: {
      speciesTypes: ['thing that should not be', 'flesh-warped horror', 'deep-dweller from below', 'many-mouthed anomaly', 'star-fallen aberration', 'reality-torn nightmare'],
      parts: ['too many limbs', 'mouths where there should be none', 'eyes that open in the wrong places', 'shape that hurts to hold in mind', 'grasping fronds', 'wound in the air around it'],
      verbs: ['unmakes', 'infests', 'rewrites', 'engulfs', 'whispers into', 'reaches through'],
      abilities: ['warps flesh it touches', 'sees where the eye cannot', 'sows madness by its mere shape', 'reknits itself from any wound', 'is in two places when it should be one', 'silences steel and prayer alike', 'hungers across walls'],
      weaknesses: ['it does not understand fire, so fire works', 'anchoring wards', 'a mind too stubborn to break', 'the thing it fell from', 'true names', 'the light of a clear noon'],
      habitats: ['the deep places light has never reached', 'a rift where the world wore thin', 'the wreck of something that fell from the sky', 'the space behind a locked and forgotten door'],
      regions: ['the Sunless Deep', 'the Scar', 'the Fallow Between', 'the Drowned Vault', 'the Unmapped Reaches'],
      diets: ['the shape and sanity of whatever it meets', 'meaning itself, unravelled thread by thread', 'flesh, but only as an afterthought', 'it consumes in ways the living lack words for'],
      postures: ['Infests, then reveals itself', 'Waits behind the walls of the world', 'Draws the curious in, one by one', 'Spreads like a stain and cannot be reasoned with'],
      challenges: ['CR 10 · not a fight so much as a survival', 'Mythic · the rules bend around it', 'Major · corrupts before it kills', 'Unknown · no two accounts agree'],
      habits: ['corrupts the land and the minds of those who linger near it', 'is never quite where it was a moment ago', 'cannot be understood, only survived or sealed', 'leaves witnesses changed, if it leaves them at all'],
      stages: ['it did not hatch or grow — it arrived, or was always here and only now noticed', 'sealing the rift it came through starves it back to dormancy', 'each thing it warps becomes a lesser horror in its wake'],
      activeTimes: ['the dark of the moon', 'when the stars are wrong', 'the moment its seal weakens', 'it does not keep to time'],
      categories: ['Aberration', 'Aberration', 'Aberration', 'Unique'],
      threats: ['major', 'mythic', 'apex', 'unknown'],
      dispositions: ['unknowable', 'corrupted', 'ambush', 'hostile'],
    },
  },
  {
    id: 'mount',
    keywords: ['mount', 'steed', 'beast', 'companion', 'tame', 'domestic', 'herd', 'draft', 'riding'],
    themes: 'any',
    lexicon: {
      speciesTypes: ['broad-backed riding-beast', 'draft-bred pack animal', 'swift courser', 'loyal war-mount', 'herd-bred grazer', 'half-tamed wild steed'],
      parts: ['strong flanks', 'proud neck', 'sure hooves', 'shaggy coat', 'patient eyes', 'deep chest'],
      verbs: ['carries', 'pulls', 'bears', 'outruns', 'stands by', 'wades through'],
      abilities: ['tireless over distance', 'sure-footed on bad ground', 'calm under fire', 'carries a heavy load', 'finds the way home', 'wades cold water without flinching', 'bonds to one rider'],
      weaknesses: ['predators', 'poor forage', 'a cruel hand', 'panic in close quarters', 'lameness on hard roads', 'thirst'],
      habitats: ['open grassland and the herds that graze it', 'the stables and paddocks of settled country', 'high pasture in the warm months', 'the drovers’ roads between towns'],
      regions: ['the Greenmarch', 'the Long Plains', 'the Downs', 'the river-valleys', 'the drovers’ country'],
      diets: ['grass, grain, and whatever the drovers can spare', 'good pasture, and a great deal of it', 'forage on the move, oats at journey’s end', 'browse and hay through the cold season'],
      postures: ['Flees danger, defends its rider', 'Stands its ground for one it trusts', 'Bolts at first, learns courage slowly', 'Places itself between threat and herd'],
      challenges: ['Mundane · a beast of burden, not a fight', 'Minor · dangerous only when cornered', 'CR 2 · a war-trained mount kicks hard', 'Mundane · worth more alive than dead'],
      habits: ['bonds to a single rider and pines when parted', 'startles easily but calms to a familiar voice', 'knows the road home better than any map', 'earns its keep and expects fair treatment'],
      stages: ['foaled in spring, broken to the saddle at three years, worked for a decade or more', 'gentled by patient handling or ruined by a heavy hand', 'the finest are bred deliberately, the hardiest run half-wild'],
      activeTimes: ['daylight', 'the working hours', 'dawn to dusk', 'the grazing hours'],
      categories: ['Beast', 'Beast', 'Sapient'],
      threats: ['mundane', 'minor', 'mundane', 'moderate'],
      dispositions: ['docile', 'wary', 'docile', 'intelligent'],
    },
  },
  {
    id: 'trickster',
    keywords: ['trickster', 'fey', 'sprite', 'shapeshifter', 'imp', 'spirit', 'fox', 'mischief', 'changeling'],
    themes: ['high-fantasy', 'mythic', 'modern'],
    lexicon: {
      speciesTypes: ['shape-borrowing fey', 'grinning hearth-imp', 'bargain-striking spirit', 'nine-tailed fox-thing', 'changeling of the old woods', 'riddle-keeping sprite'],
      parts: ['too-wide smile', 'eyes that catch the light wrong', 'quick and clever hands', 'shape it wears like a coat', 'laugh you feel more than hear', 'fingers with an extra joint'],
      verbs: ['tricks', 'bargains with', 'leads astray', 'mimics', 'charms', 'slips past'],
      abilities: ['wears a borrowed face', 'strikes bargains you regret', 'leads travellers in circles', 'mimics a familiar voice', 'vanishes mid-sentence', 'knows a secret you thought safe', 'cannot lie, but will not tell the truth plainly'],
      weaknesses: ['iron', 'its true name', 'a bargain honoured to the letter', 'running water', 'a gift freely given', 'being outwitted'],
      habitats: ['the old woods where the paths move', 'the space between one village and the next', 'a crossroads at twilight', 'the hearth of a house that leaves out milk'],
      regions: ['the Whispering Wood', 'the Twilight Marches', 'the Hollow Hills', 'the old fey-roads', 'the Between'],
      diets: ['laughter, secrets, and the occasional stolen pie', 'milk and honey left on the doorstep', 'favours owed and bargains struck', 'it eats little; it collects much'],
      postures: ['Bargains, tricks, then flees', 'Tests the traveller with riddles', 'Leads astray for sport, not malice', 'Vanishes the moment iron is drawn'],
      challenges: ['CR 4 · a battle of wits, not blades', 'Minor · rarely deadly, always costly', 'Moderate · when a bargain sours', 'Unique · dangerous to the careless tongue'],
      habits: ['deals only in bargains and always keeps the letter, never the spirit', 'cannot resist a riddle, a wager, or an unlocked door', 'punishes rudeness and rewards a clever guest', 'wears the face of someone you trust'],
      stages: ['it was not born so much as it wandered in from an older story', 'bound by a name or a bargain, it serves — reluctantly, and to the letter', 'it does not age; it merely tires of one shape and takes another'],
      activeTimes: ['twilight', 'the turning of the seasons', 'moonlit nights', 'whenever a bargain is on offer'],
      categories: ['Spirit', 'Hybrid', 'Sapient', 'Unique'],
      threats: ['minor', 'moderate', 'unknown', 'unique'],
      dispositions: ['intelligent', 'wary', 'unknowable', 'ambush'],
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

/** Creature names blend theme grammar (lexicon.creatureName) with archetype
 * flavor: "Ashen Stalker", "The Grave-Risen Wight of Barrowmere". */
export function creatureNameFor(rng: Rng, arch: Archetype, theme: ThemeId): string {
  const base = creatureName(rng, theme);
  if (rng.chance(0.35)) {
    const kind = pickSlot(rng, arch, 'speciesTypes');
    return `The ${cap(kind)} of ${placeName(rng, theme)}`;
  }
  return base;
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

/** One fully-fielded creature. Every field is driven by the same archetype
 * + rng, so an "undead" roll stays undead across shape, hunt, and lore. */
export function generateBestiaryDraft(rng: Rng, arch: Archetype, ctx: GenCtx): BundleEntityDraft {
  const theme = ctx.theme;
  const part = () => pickSlot(rng, arch, 'parts');
  const verb = () => pickSlot(rng, arch, 'verbs');
  const habit = () => pickSlot(rng, arch, 'habits');
  const species = pickSlot(rng, arch, 'speciesTypes');
  const [partA, partB] = pickPair(rng, arch, 'parts');
  const [stageA, stageB] = pickPair(rng, arch, 'stages');

  const name = creatureNameFor(rng, arch, theme);
  const summary = `${cap(article(species))} ${species} that ${verb()} its prey; it ${habit()}.`;
  const description = `${cap(name)} is ${article(species)} ${species}. Look for the ${partA} and the ${partB} first. It ${verb()} what it hunts, and ${habit()}.${
    rng.chance(0.5) ? ` Those who have survived it speak of the ${part()}.` : ''
  }`;

  const fields: Record<string, unknown> = {
    speciesType: species,
    category: pickSlot(rng, arch, 'categories'),
    description,
    threatLevel: pickSlot(rng, arch, 'threats'),
    disposition: pickSlot(rng, arch, 'dispositions'),
    challenge: pickSlot(rng, arch, 'challenges'),
    fightOrFlight: pickSlot(rng, arch, 'postures'),
    habitat: pickSlot(rng, arch, 'habitats'),
    regions: pickSome(rng, arch, 'regions', 1, 3),
    activeTimes: pickSome(rng, arch, 'activeTimes', 1, 2),
    behaviour: `${cap(habit())}. In an encounter it ${verb()} the unwary, and ${habit()}.`,
    abilities: pickSome(rng, arch, 'abilities', 2, 4),
    weaknesses: pickSome(rng, arch, 'weaknesses', 1, 3),
    diet: pickSlot(rng, arch, 'diets'),
    lifecycle: `${cap(stageA)}. ${cap(stageB)}.`,
  };

  // Link into the project where entities of the right type already exist.
  if (rng.chance(0.6)) {
    const locs = someRefs(rng, ctx, 'locations', 2);
    if (locs.length) fields.encounterLocations = locs;
  }
  if (rng.chance(0.45)) {
    const locs = someRefs(rng, ctx, 'locations', 2);
    if (locs.length) fields.relatedLocations = locs;
  }
  if (rng.chance(0.4)) {
    const race = refFrom(rng, ctx, 'races');
    if (race) fields.relatedRace = [race];
  }
  if (rng.chance(0.35)) {
    const faction = refFrom(rng, ctx, 'factions');
    if (faction) fields.relatedFactions = [faction];
  }
  if (rng.chance(0.35)) {
    const quest = refFrom(rng, ctx, 'quests');
    if (quest) fields.relatedQuests = [quest];
  }

  return {
    localId: newId(),
    type: 'bestiary',
    name,
    aliases: [],
    summary,
    tags: [arch.id, pickSlot(rng, arch, 'dispositions')],
    fields,
  };
}

export const bestiaryPack: TypePack = {
  type: 'bestiary',
  archetypes: ARCHETYPES,
  generate: (rng, arch, ctx) => generateBestiaryDraft(rng, arch, ctx),
};
