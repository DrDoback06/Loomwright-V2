import { newId } from '@/lib/id';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import type { Archetype, TypePack } from './index';
import { cap, itemName, personName, pools, type ThemeId } from './lexicon';
import type { GenCtx } from './generic';

/** Deep items pack: each archetype is one coherent kind of object — its
 * shapes, materials, boons, and quirks all pull from the same well, so a
 * cursed heirloom stays cursed from its name down to its resale value.
 *
 * Slot conventions: `forms` are the object shapes ("sabre", "locket"),
 * `boons` are third-person effect clauses ("it <boon>"), `quirks` are
 * third-person flavor clauses, and `effectKinds` routes boons into the
 * config's passive/active/triggered row-lists. Option-backed slots
 * (`itemTypes`, `slots`, `rarities`, `statuses`, `conditions`) hold exact
 * strings from the items entity config — duplicates act as weights. */

const ARCHETYPES: Archetype[] = [
  {
    id: 'weapon',
    keywords: ['weapon', 'sword', 'blade', 'axe', 'spear', 'bow', 'dagger', 'gun', 'war', 'duel'],
    themes: 'any',
    lexicon: {
      forms: ['arming sword', 'sabre', 'boar-spear', 'war-axe', 'long knife', 'estoc', 'recurve bow', 'warhammer', 'glaive'],
      nouns: ['edge', 'fuller', 'hilt', 'crossguard', 'tang', 'point', 'pommel', 'haft'],
      adjectives: ['keen', 'notched', 'balanced', 'wicked', 'oiled', 'rune-etched', 'blooded', 'quenched'],
      materials: ['folded steel', 'cold iron', 'blued metal', 'whale-ivory and brass', 'oil-dark ashwood', 'sharkskin-wrapped steel'],
      boons: ['bites deeper against armoured foes', 'never dulls, no matter the work', 'warns its bearer of ambush with a low hum', 'strikes true in total darkness', 'drinks the shock of a parried blow', 'remembers every duel it has won', 'cuts rope, chain, and excuses with equal ease', 'turns in the hand to meet a blow the bearer never saw'],
      activations: ['Salute with it', "Speak the smith's name", 'Draw it slowly', 'Strike it against stone'],
      triggers: ['When blood is drawn', 'On the killing blow', 'When drawn under an open sky', 'When its true name is spoken', 'When the bearer is outnumbered'],
      bearers: ['the wielder', 'whoever draws it', 'its sworn bearer', 'the hand that holds it'],
      quirks: ['never seems to dull', 'hums faintly before a fight', "sits heavier in a coward's hand", 'always comes free of the scabbard silently'],
      stats: ['Might', 'Reflex', 'Menace', 'Precision'],
      values: ["a soldier's year of wages", '40 crowns, more to a collector', 'whatever the last duel decided', 'priceless to the right family'],
      weights: ['2.6 lb', '3.4 lb', '4.8 lb', '7 lb'],
      itemTypes: ['Weapon'],
      slots: ['Main Hand', 'Main Hand', 'Off Hand'],
      rarities: ['Common', 'Uncommon', 'Uncommon', 'Rare', 'Rare', 'Heirloom', 'Legendary'],
      effectKinds: ['active', 'triggered'],
      statuses: ['equipped', 'carried', 'stored'],
      conditions: ['Used', 'Used', 'Worn', 'Pristine', 'Damaged'],
    },
  },
  {
    id: 'armor',
    keywords: ['armor', 'armour', 'shield', 'helm', 'plate', 'mail', 'cuirass', 'guard', 'protection'],
    themes: 'any',
    lexicon: {
      forms: ['cuirass', 'hauberk', 'round shield', 'greathelm', 'lamellar coat', 'tower shield', 'brigandine', 'pair of gauntlets', 'scale vest'],
      nouns: ['strap', 'rivet', 'visor', 'buckle', 'plate', 'lining', 'boss', 'chinstrap'],
      adjectives: ['dented', 'proofed', 'burnished', 'battle-scarred', 'well-oiled', 'heavy', 'close-fitting', 'riveted'],
      materials: ['boiled leather', 'riveted mail', 'case-hardened steel', 'laminated horn', 'padded linen and iron', 'bronze scale'],
      boons: ['turns aside the first blow of every fight', 'spreads the force of a charge across the whole body', 'keeps its wearer warm through frost and vigil', 'never chafes, however long the march', 'shrugs off arrows loosed at long range', "quiets the wearer's footfalls despite its bulk", 'holds its shape even when the straps are cut', 'lets the wearer breathe easy in a shield-wall press'],
      triggers: ['When the wearer is knocked down', 'When struck square on', 'When the wearer stands their ground', 'At the first wound of a battle'],
      bearers: ['its wearer', 'whoever buckles it on', 'the one who bears it'],
      quirks: ['still carries the dent that killed its last owner', 'smells of oil, smoke, and old campaigns', "bears a maker's mark no armourer alive recognises", 'has been re-strapped so many times none of the leather is original'],
      stats: ['Guard', 'Endurance', 'Presence', 'Resolve'],
      values: ['a season of caravan-guard pay', '30 crowns as it stands, twice that restored', 'its weight in good grain', "more than the wearer's life, by some accounting"],
      weights: ['8 lb', '11 lb', '18 lb', '24 lb'],
      worn: ['worn', 'buckled on'],
      itemTypes: ['Armour'],
      slots: ['Body', 'Body', 'Head', 'Off Hand', 'Hands'],
      rarities: ['Common', 'Uncommon', 'Uncommon', 'Rare', 'Rare', 'Heirloom'],
      effectKinds: ['passive', 'triggered'],
      statuses: ['equipped', 'stored', 'carried'],
      conditions: ['Used', 'Worn', 'Worn', 'Damaged', 'Pristine'],
    },
  },
  {
    id: 'relic',
    keywords: ['relic', 'artifact', 'artefact', 'ancient', 'sacred', 'holy', 'legendary', 'power', 'lost'],
    themes: ['high-fantasy', 'mythic', 'grimdark'],
    lexicon: {
      forms: ['reliquary', 'orb', 'crown', 'sceptre', 'idol', 'chalice', 'mask', 'shard', 'astrolabe'],
      nouns: ['covenant', 'age', 'saint', 'dynasty', 'vigil', 'prophecy', 'throne', 'rite'],
      adjectives: ['unblinking', 'age-worn', 'sanctified', 'humming', 'impossibly heavy', 'warm to the touch', 'half-remembered', 'sleeping'],
      materials: ['gold that never tarnishes', 'stone older than the mountains', 'bone of something enormous', 'glass with light trapped inside', 'meteoric iron', 'ivory dark with centuries of handling'],
      boons: ['grants visions of the age that made it', 'steadies the faithful against despair', 'speaks, rarely, and only the truth', 'turns aside harm meant for its keeper', 'remembers every hand that has held it', 'ripens crops, calms storms, or curdles both — accounts differ', 'wakes older powers simply by being near them', 'burns the unworthy who grip it too long'],
      triggers: ['When brought into a holy place', 'At the turning of the season', 'When its keeper swears an oath', 'When two who covet it stand in the same room', 'On the anniversary of its making'],
      bearers: ['its keeper', 'the current custodian', 'whoever dares carry it'],
      quirks: ['is always slightly warmer than the room', 'appears in older paintings than can be explained', 'has outlived every institution built to guard it', 'makes candles gutter when it is uncovered'],
      stats: ['Faith', 'Fate', 'Awe', 'Will'],
      values: ['beyond price; wars have been fought over less', 'whatever a desperate kingdom will pay', 'officially worthless — the church says so, nervously', 'three fortunes and a bloodline, at last sale'],
      weights: ['1.2 lb', '6 lb', 'half what it should weigh', 'more each year, the keeper swears'],
      worn: ['kept close', 'carried'],
      itemTypes: ['Relic', 'Artefact', 'Magical'],
      slots: ['Relic', 'Relic', 'Accessory'],
      rarities: ['Rare', 'Heirloom', 'Legendary', 'Legendary', 'Unique', 'Unique'],
      effectKinds: ['passive', 'triggered'],
      statuses: ['stored', 'carried', 'dormant'],
      conditions: ['Worn', 'Used', 'Pristine', 'Damaged'],
    },
  },
  {
    id: 'tool',
    keywords: ['tool', 'kit', 'instrument', 'lantern', 'lockpick', 'compass', 'rope', 'gear', 'tinker'],
    themes: 'any',
    lexicon: {
      forms: ['lockpick roll', "surveyor's compass", 'storm lantern', 'folding spade', "field surgeon's kit", 'climbing rig', "tinker's toolkit", 'signal mirror', 'coil of rope'],
      nouns: ['clasp', 'hinge', 'tine', 'gauge', 'handle', 'bevel', 'strap', 'casing'],
      adjectives: ['well-worn', 'dependable', 'cleverly made', 'oft-mended', 'compact', 'scuffed', 'precise', 'ingenious'],
      materials: ['brass and ashwood', 'spring steel', 'waxed canvas and iron', 'hardened tool-steel', 'oiled walnut', 'aluminium and cord'],
      boons: ['does its one job faster than any rival make', 'folds down to half the size it has any right to', 'works in rain, frost, and pitch dark alike', 'has a hidden compartment its maker never mentioned', 'never rusts, though it is never oiled', 'can be repaired with whatever is lying around', 'doubles as a passable weapon in a pinch', "earns respect from tradesfolk who recognise the maker's mark"],
      activations: ['Unfold it', 'Set it to the work', 'Wind the mechanism', 'Strike a light'],
      bearers: ['its owner', 'a practiced hand', 'whoever packs it'],
      quirks: ["has its owner's initials scratched somewhere hard to find", 'rattles unless packed exactly right', 'was clearly repaired once by someone brilliant and once by someone drunk', 'carries the smell of every workshop it has passed through'],
      stats: ['Craft', 'Wits', 'Precision', 'Grit'],
      values: ["a fair week's wages", "12 crowns new; this one's worth more, broken in", 'its price in saved fingers', 'cheap to buy, dear to replace mid-job'],
      weights: ['0.8 lb', '1.5 lb', '3 lb', '5.5 lb'],
      worn: ['on the belt', 'in the pack', 'to hand'],
      itemTypes: ['Tool'],
      slots: ['Tool', 'Tool', 'Pack'],
      rarities: ['Common', 'Common', 'Uncommon', 'Uncommon', 'Rare'],
      effectKinds: ['active', 'passive'],
      statuses: ['carried', 'carried', 'stored', 'active'],
      conditions: ['Used', 'Used', 'Worn', 'Pristine'],
    },
  },
  {
    id: 'consumable',
    keywords: ['potion', 'elixir', 'draught', 'tonic', 'salve', 'poison', 'consumable', 'brew', 'philtre', 'dose'],
    themes: 'any',
    lexicon: {
      forms: ['stoppered vial', 'wax-sealed flask', 'paper twist of powder', 'clay ampoule', 'tin of salve', 'hip flask', 'dried herb bundle', 'sugared lozenge'],
      nouns: ['dose', 'dram', 'residue', 'stopper', 'label', 'sediment', 'fume', 'aftertaste'],
      adjectives: ['bitter', 'cloudy', 'luminous', 'syrup-thick', 'sharp-smelling', 'chalky', 'iridescent', 'suspiciously pleasant'],
      materials: ['crushed nightbloom', 'distilled riverlight', 'rendered marrow', 'fermented honey and ash', 'powdered lodestone', 'moth-wing tincture'],
      boons: ['knits a fresh wound closed in minutes', 'banishes sleep for a night and collects the debt later', 'steadies shaking hands before desperate work', 'lets the drinker see clearly in the dark', 'deadens pain without dulling wit', 'loosens tongues better than any interrogation', 'purges most common poisons', 'grants one hour of borrowed, reckless courage'],
      activations: ['Uncork and drink it', 'Rub it into the skin', 'Dissolve it under the tongue', 'Burn it and breathe the fumes'],
      bearers: ['the drinker', 'whoever takes the dose', 'the patient'],
      quirks: ['tastes worse than whatever it cures', 'stains the lips faintly blue for a day', 'must be shaken awake before use', 'loses potency if it ever sees direct sun'],
      stats: ['Vigor', 'Nerve', 'Clarity', 'Fortitude'],
      values: ['2 crowns a dose from any honest apothecary', 'ten times its price when the plague is near', 'one favour, payable to the brewer', "a day's wages — or a life, depending when you need it"],
      weights: ['0.2 lb', '0.3 lb', '0.5 lb', 'a few ounces'],
      itemTypes: ['Consumable'],
      slots: ['Pack'],
      rarities: ['Common', 'Common', 'Uncommon', 'Uncommon', 'Rare'],
      effectKinds: ['active'],
      statuses: ['carried', 'carried', 'stored'],
      conditions: ['Pristine', 'Pristine', 'Used'],
    },
  },
  {
    id: 'trinket',
    keywords: ['ring', 'amulet', 'locket', 'charm', 'pendant', 'jewelry', 'jewellery', 'trinket', 'brooch', 'token'],
    themes: 'any',
    lexicon: {
      forms: ['signet ring', 'locket', 'string of beads', 'brooch', 'charm bracelet', 'pendant', 'hairpin', 'pocket token'],
      nouns: ['clasp', 'setting', 'engraving', 'chain', 'inlay', 'facet', 'hinge', 'keepsake'],
      adjectives: ['delicate', 'tarnished', 'sentimental', 'finely wrought', 'unassuming', 'cold', 'glittering', 'old-fashioned'],
      materials: ['rose gold', 'jet and silver wire', 'river pearl', 'polished amber with something inside', 'pale jade', 'tin, lovingly polished'],
      boons: ['warms when someone lies to its wearer', 'brings small, deniable strokes of luck', 'opens to reveal a portrait no one can identify', "calms the wearer's nerves when gripped", 'always finds its way back when lost', 'marks its wearer as a friend to certain circles', 'keeps bad dreams at arm’s length', 'points, very faintly, toward home'],
      triggers: ['When its wearer weeps', 'When worn to a funeral or a wedding', "When someone speaks the previous owner's name", 'At the new moon'],
      bearers: ['its wearer', 'whoever wears it knowingly', 'the one it has chosen'],
      quirks: ['is always the last thing its owner removes', 'shows a different engraving by candlelight', 'has been pawned and redeemed eleven recorded times', 'fits any finger it is offered to'],
      stats: ['Charm', 'Luck', 'Poise', 'Insight'],
      values: ['a few coins to a jeweller, everything to the right person', '8 crowns for the metal; the story costs extra', 'one heartfelt promise', 'pawnable anywhere, missed everywhere'],
      weights: ['0.1 lb', '0.2 lb', 'an ounce or so'],
      worn: ['worn', 'next to the skin'],
      itemTypes: ['Symbol', 'Magical', 'Mundane'],
      slots: ['Accessory'],
      rarities: ['Common', 'Uncommon', 'Uncommon', 'Rare', 'Heirloom', 'Heirloom'],
      effectKinds: ['passive', 'triggered'],
      statuses: ['equipped', 'carried', 'stored'],
      conditions: ['Worn', 'Used', 'Pristine'],
    },
  },
  {
    id: 'tome',
    keywords: ['book', 'tome', 'scroll', 'map', 'letter', 'document', 'journal', 'grimoire', 'ledger', 'codex'],
    themes: 'any',
    lexicon: {
      forms: ['leather-bound journal', 'sea chart', 'bundle of letters', 'ledger', 'illuminated codex', 'folded map', 'shipping manifest', 'signed confession', 'field notebook'],
      nouns: ['margin', 'cipher', 'folio', 'watermark', 'binding', 'annotation', 'colophon', 'errata'],
      adjectives: ['water-stained', 'annotated', 'coded', 'dog-eared', 'forbidden', 'meticulous', 'incomplete', 'mis-shelved'],
      materials: ['vellum and cracked leather', 'rag paper sewn with waxed thread', 'birch bark', 'pressed reed and squid ink', 'onionskin carbon copies', 'parchment scraped and rewritten twice'],
      boons: ['names names its subjects assumed were safe', 'contains a route no living navigator remembers', 'teaches, page by patient page, a dangerous skill', 'proves ownership of something currently stolen', 'contradicts the official history in verifiable detail', 'holds a pressed flower that matters more than the text', "can be read three ways, each to a different faction's ruin", 'ends mid-sentence, on purpose'],
      activations: ['Break the cipher', 'Read it cover to cover', 'Cross-reference the margins', 'Hold the pages to heat or light'],
      triggers: ['When read aloud', 'When the right page is found', 'When the wrong person learns it exists'],
      bearers: ['the reader', 'whoever holds the original', 'its current keeper'],
      quirks: ['smells of salt and old smoke', 'has one page razored out, recently', 'is written in at least three hands', 'falls open to the same page every time'],
      stats: ['Lore', 'Wits', 'Intrigue', 'Memory'],
      values: ["a scribe's ransom", 'worthless to most; lethal to a few', '20 crowns at auction, a knife in the dark otherwise', 'exactly what someone will pay to see it burned'],
      weights: ['0.4 lb', '1.8 lb', '3 lb', "a satchel's worth"],
      itemTypes: ['Book', 'Document', 'Map'],
      slots: ['Pack', 'Pack', 'Quest'],
      rarities: ['Uncommon', 'Rare', 'Rare', 'Unique', 'Heirloom'],
      effectKinds: ['active', 'triggered'],
      statuses: ['carried', 'stored', 'stored'],
      conditions: ['Worn', 'Used', 'Damaged', 'Pristine'],
    },
  },
  {
    id: 'cursed',
    keywords: ['cursed', 'curse', 'haunted', 'hex', 'doom', 'forbidden', 'blighted', 'unlucky', 'possessed'],
    themes: ['high-fantasy', 'grimdark', 'mythic'],
    lexicon: {
      forms: ['music box', 'porcelain doll', 'iron crown', 'mirror shard', 'coin that always lands wrong', 'wedding band', 'hunting horn', 'black candle', "child's shoe"],
      nouns: ['bargain', 'grudge', 'debt', 'omen', 'whisper', 'shadow', 'hunger', 'toll'],
      adjectives: ['patient', 'cold', 'covetous', 'wrong-angled', 'beautiful', 'spiteful', 'heavier-than-it-looks', 'inescapable'],
      materials: ['bog oak', 'grave-iron', 'wax mixed with ash', 'silver gone black', 'bone, provenance unknown', 'glass that will not reflect its holder'],
      boons: ['grants exactly what is wished for, worded poorly', "sharpens its keeper's luck while dulling everyone else's", 'cannot be sold, only given — or inherited', 'whispers the location of things better left buried', 'protects its keeper from every death but one', 'makes its keeper unforgettable, and then unwelcome', 'feeds on small misfortunes and pays out large ones', 'returns within three days of any attempt to discard it'],
      triggers: ['When its keeper sleeps', 'When accepted as a gift', 'When someone laughs in its presence', "At each new owner's first regret", 'When burned, buried, or drowned'],
      bearers: ['its keeper', 'the poor soul holding it', 'whoever owns it — or is owned by it'],
      quirks: ['is always found again, never bought', 'spoils every portrait or photograph it appears in', 'makes animals leave the room', 'has a list of previous owners no one finished compiling'],
      stats: ['Doom', 'Dread', 'Fortune', 'Will'],
      values: ['free — that is the trap', 'whatever the last owner paid, plus interest', 'no pawnshop in the city will take it twice', 'a life, eventually'],
      weights: ['0.9 lb', '2 lb', 'feels heavier every year'],
      worn: ['kept, reluctantly', 'locked away'],
      itemTypes: ['Magical', 'Relic', 'Other'],
      slots: ['Relic', 'Accessory', 'Custom'],
      rarities: ['Cursed', 'Cursed', 'Cursed', 'Unique'],
      effectKinds: ['passive', 'triggered'],
      statuses: ['dormant', 'stored', 'carried', 'lost'],
      conditions: ['Worn', 'Used', 'Damaged'],
    },
  },
];

function pickSlot(rng: Rng, arch: Archetype, slot: string): string {
  const pool = arch.lexicon[slot];
  return pool?.length ? rng.pick(pool) : '';
}

/** Item names blend theme grammar (lexicon.itemName) with archetype
 * shapes: "Quenched Estoc", "Kelrin's Music Box", "Locket of the Omen". */
export function itemNameFor(rng: Rng, arch: Archetype, theme: ThemeId): string {
  const form = () => pickSlot(rng, arch, 'forms');
  const noun = () => pickSlot(rng, arch, 'nouns');
  const adjective = () => pickSlot(rng, arch, 'adjectives');
  const forms = [
    () => itemName(rng, theme),
    () => `${cap(adjective())} ${cap(form())}`,
    () => `${cap(form())} of the ${cap(noun())}`,
    () => `${personName(rng, theme).split(' ')[0]}'s ${cap(form())}`,
    () => `The ${cap(adjective())} ${cap(noun())}`,
  ];
  return rng.pick(forms)();
}

/** First entity of `type` ctx knows about, as an EntityRef — or undefined,
 * so related fields only link things that actually exist in the project. */
function refFrom(rng: Rng, ctx: GenCtx, type: string): { id: string; type: string; name: string } | undefined {
  const candidates = ctx.known.filter((k) => k.type === type);
  if (!candidates.length) return undefined;
  const picked = rng.pick(candidates);
  return { id: picked.id, type: picked.type, name: picked.name };
}

/** One fully-fielded item. Every field is driven by the same archetype +
 * rng, so a "cursed" roll stays cursed across name, effects, and value. */
export function generateItemDraft(rng: Rng, arch: Archetype, ctx: GenCtx): BundleEntityDraft {
  const theme = ctx.theme;
  const p = pools(theme);
  const form = () => pickSlot(rng, arch, 'forms');
  const noun = () => pickSlot(rng, arch, 'nouns');
  const adjective = () => pickSlot(rng, arch, 'adjectives');
  const boon = () => pickSlot(rng, arch, 'boons');
  const quirk = () => pickSlot(rng, arch, 'quirks');
  const bearer = () => pickSlot(rng, arch, 'bearers');
  const stat = () => pickSlot(rng, arch, 'stats');

  const name = itemNameFor(rng, arch, theme);
  // Archetype materials keep the flavor; theme materials keep the genre.
  const material = rng.chance(0.65) ? pickSlot(rng, arch, 'materials') : rng.pick(p.materials);
  const status = pickSlot(rng, arch, 'statuses');

  const summary = `A ${adjective()} ${form()} that ${rng.chance(0.6) ? boon() : quirk()}.`;
  const description = `A ${adjective()} ${form()} of ${material}. It ${quirk()}.${
    rng.chance(0.6) ? ` ${cap(bearer())} would know it anywhere by the ${noun()}.` : ''
  }`;

  const fields: Record<string, unknown> = {
    itemType: pickSlot(rng, arch, 'itemTypes'),
    rarity: pickSlot(rng, arch, 'rarities'),
    description,
    condition: pickSlot(rng, arch, 'conditions'),
    weight: pickSlot(rng, arch, 'weights'),
    value: pickSlot(rng, arch, 'values'),
    slot: pickSlot(rng, arch, 'slots'),
    status,
    icon: name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(),
  };
  if (status === 'equipped' || status === 'carried') fields.carried = true;
  if (status === 'equipped') fields.equipped = true;

  // Charges for gear, doses for consumables; relics keep their mystery.
  if (arch.id === 'consumable') {
    const doses = rng.int(1, 4);
    fields.durability = `${doses} dose${doses === 1 ? '' : 's'}`;
  } else if (rng.chance(0.4)) {
    const max = rng.int(2, 6);
    fields.durability = `${rng.int(1, max)} / ${max}`;
  }

  // Boons route into whichever effect row-lists the archetype uses.
  const kinds = arch.lexicon.effectKinds ?? [];
  if (kinds.includes('passive')) {
    const worn = () => pickSlot(rng, arch, 'worn');
    fields.passive = [
      `While ${worn()}, it ${boon()}.`,
      ...(rng.chance(0.35) ? [`It ${boon()}, ${rng.pick(['quietly', 'always', 'whether asked or not'])}.`] : []),
    ];
  }
  if (kinds.includes('active')) {
    const activation = () => pickSlot(rng, arch, 'activations');
    fields.active = [
      `${activation()} — it ${boon()}.`,
      ...(rng.chance(0.3) ? [`${activation()}; the effect ${rng.pick(['lasts a scene', 'fades by dawn', 'works once per day'])}.`] : []),
    ];
  }
  if (kinds.includes('triggered')) {
    const trigger = () => pickSlot(rng, arch, 'triggers');
    fields.triggered = [`${trigger()}, it ${boon()}.`];
  }

  // Consumables spend themselves; everything else can carry stat rows.
  if (arch.id !== 'consumable' && rng.chance(0.75)) {
    fields.modifiers = [
      `${stat()} +${rng.int(1, 3)}`,
      ...(arch.id === 'cursed' || rng.chance(0.25) ? [`${stat()} -${rng.int(1, 2)}`] : []),
    ];
  }
  if (rng.chance(0.6)) {
    fields.affixes = [cap(adjective()), ...(rng.chance(0.4) ? [`${cap(noun())}-marked`] : [])];
  }
  if (rng.chance(0.4)) {
    fields.restrictions = rng.chance(0.5)
      ? `Meant for ${bearer()}; in any other hands it is just a ${adjective()} ${form()}.`
      : `Useless until its ${noun()} is ${rng.pick(['understood', 'restored', 'earned'])}.`;
  }
  if (rng.chance(0.6)) {
    fields.ownershipHistory = `Last held by ${personName(rng, theme)}, who ${rng.pick([
      'won it in a wager',
      'inherited it and regretted it',
      'bought it for a song',
      'took it from a corpse and told no one',
      'was given it as payment for silence',
    ])}. Before that, the trail goes ${rng.pick(['cold', 'bloody', 'back three generations', 'through a pawnshop with no records'])}.`;
  }

  // Link into the project where entities of the right type already exist.
  if (rng.chance(0.6)) {
    const owner = refFrom(rng, ctx, 'cast');
    if (owner) fields.currentOwner = owner;
  }
  if (rng.chance(0.5)) {
    const loc = refFrom(rng, ctx, 'locations');
    if (loc) fields.currentLocation = loc;
  }
  if (rng.chance(0.4)) {
    const found = refFrom(rng, ctx, 'locations');
    if (found) fields.foundLocation = found;
  }
  if (rng.chance(0.35)) {
    const skill = refFrom(rng, ctx, 'skills');
    if (skill) fields.linkedSkills = [skill];
  }
  if (rng.chance(0.35)) {
    const klass = refFrom(rng, ctx, 'classes');
    if (klass) fields.compatibleClasses = [klass];
  }

  return {
    localId: newId(),
    type: 'items',
    name,
    aliases: [],
    summary,
    tags: [arch.id, adjective()],
    fields,
  };
}

export const itemsPack: TypePack = {
  type: 'items',
  archetypes: ARCHETYPES,
  generate: (rng, arch, ctx) => generateItemDraft(rng, arch, ctx),
};
