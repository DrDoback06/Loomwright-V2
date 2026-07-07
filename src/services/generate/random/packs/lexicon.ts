import type { Rng } from '../rng';

/** Theme ids the random engine understands. 'any' in the UI means "no
 * constraint" and resolves to a random theme per generation. */
export type ThemeId = 'high-fantasy' | 'grimdark' | 'science-fiction' | 'modern' | 'mythic';

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'high-fantasy', label: 'High fantasy' },
  { id: 'grimdark', label: 'Grimdark' },
  { id: 'science-fiction', label: 'Science fiction' },
  { id: 'modern', label: 'Modern / urban' },
  { id: 'mythic', label: 'Mythic' },
];

interface NamePools {
  /** Person-name syllables: onset + middle(optional) + coda. */
  onsets: string[];
  middles: string[];
  codas: string[];
  surnames: string[];
  /** Place-name stems + suffixes. */
  placeStems: string[];
  placeSuffixes: string[];
  /** Flavor pools. */
  adjectives: string[];
  nouns: string[];
  materials: string[];
  epithets: string[];
}

const POOLS: Record<ThemeId, NamePools> = {
  'high-fantasy': {
    onsets: ['Ael', 'Ber', 'Cael', 'Dor', 'El', 'Fae', 'Gal', 'Hal', 'Il', 'Kel', 'Lor', 'Mer', 'Nim', 'Or', 'Per', 'Quel', 'Ro', 'Syl', 'Tam', 'Vael', 'Wyn', 'Yl'],
    middles: ['a', 'e', 'i', 'o', 'ar', 'en', 'il', 'or', 'ath', 'em', 'un', 'ael'],
    codas: ['dan', 'dor', 'fin', 'gorn', 'ia', 'ien', 'is', 'lin', 'mir', 'nor', 'ra', 'rick', 'rin', 'ros', 'th', 'wen', 'wyn'],
    surnames: ['Ashveil', 'Briarwood', 'Duskmere', 'Elmsong', 'Fairwind', 'Goldenbough', 'Hartfall', 'Ivorane', 'Larkspur', 'Mistvale', 'Nightbloom', 'Oakenshield', 'Silverbrook', 'Thornfield', 'Windrose'],
    placeStems: ['Alder', 'Bright', 'Cinder', 'Dawn', 'Elder', 'Frost', 'Glimmer', 'Haven', 'Iron', 'Moon', 'Raven', 'Silver', 'Star', 'Thorn', 'Willow'],
    placeSuffixes: ['crest', 'dale', 'fall', 'ford', 'gate', 'glen', 'hollow', 'keep', 'mere', 'moor', 'reach', 'spire', 'vale', 'watch', 'wood'],
    adjectives: ['ancient', 'gilded', 'moonlit', 'runic', 'silvered', 'storm-touched', 'verdant', 'whispering', 'wind-worn', 'starlit'],
    nouns: ['blade', 'crown', 'grove', 'lantern', 'oath', 'raven', 'rose', 'sigil', 'song', 'ward'],
    materials: ['elderwood', 'moonsilver', 'dragonbone', 'star-iron', 'spun glass', 'living oak', 'white gold'],
    epithets: ['the Bold', 'the Evergreen', 'the Lightbearer', 'the Oathkeeper', 'the Quiet', 'the Wanderer', 'the Wise'],
  },
  grimdark: {
    onsets: ['Bal', 'Cor', 'Drav', 'Fen', 'Gor', 'Hark', 'Jor', 'Kaz', 'Mal', 'Mor', 'Rag', 'Skar', 'Thar', 'Ul', 'Var', 'Vex', 'Wrek', 'Zar'],
    middles: ['a', 'o', 'u', 'ak', 'ar', 'og', 'ur', 'eth', 'ug'],
    codas: ['bane', 'dak', 'gar', 'gash', 'grim', 'kul', 'mar', 'moth', 'nak', 'rek', 'roth', 'thane', 'tooth', 'vak'],
    surnames: ['Blackgallow', 'Bonecarver', 'Crowfeeder', 'Dreadmoor', 'Gallowglass', 'Gravesend', 'Hollowcost', 'Ironmaw', 'Rotwater', 'Sallowfen', 'Threnody', 'Vulture'],
    placeStems: ['Ash', 'Bleak', 'Bone', 'Carrion', 'Dread', 'Gall', 'Grim', 'Gut', 'Mire', 'Rot', 'Rust', 'Scab', 'Sorrow', 'Wretch'],
    placeSuffixes: ['barrow', 'ditch', 'fen', 'gallows', 'gash', 'grave', 'gutter', 'maw', 'pit', 'scar', 'shamble', 'sump', 'warren'],
    adjectives: ['blighted', 'flayed', 'gangrenous', 'hollow-eyed', 'lightless', 'plague-marked', 'rusted', 'starving', 'tallow-pale', 'weeping'],
    nouns: ['gibbet', 'knife', 'leech', 'noose', 'plague', 'reliquary', 'shroud', 'tithe', 'wound', 'vermin'],
    materials: ['scorched iron', 'gallows-oak', 'tanned hide', 'grave-lead', 'knotted sinew', 'blackened bronze'],
    epithets: ['the Flayed', 'the Godless', 'the Hollow', 'the Thrice-Hanged', 'the Unforgiven', 'the Vulture'],
  },
  'science-fiction': {
    onsets: ['Ax', 'Cal', 'Dex', 'Ery', 'Hal', 'Ix', 'Jun', 'Kai', 'Lex', 'Mira', 'Nova', 'Oz', 'Rho', 'Sol', 'Tau', 'Vex', 'Yuri', 'Zen'],
    middles: ['a', 'e', 'i', 'o', 'an', 'en', 'ex', 'ia', 'on'],
    codas: ['a', 'dar', 'den', 'dra', 'ka', 'los', 'n', 'ra', 'ris', 'son', 'tek', 'ton', 'x'],
    surnames: ['Arclight', 'Bellwether-9', 'Corvane', 'Delacroix', 'Eidolon', 'Hyperion', 'Kessler', 'Meridian', 'Okafor', 'Reyes-Tan', 'Ueda', 'Voss'],
    placeStems: ['Anchor', 'Apex', 'Beacon', 'Cryo', 'Drift', 'Flux', 'Helix', 'Kepler', 'Nadir', 'Orbital', 'Relay', 'Vector', 'Zenith'],
    placeSuffixes: ['Station', 'Spire', 'Ring', 'Reach', 'Terminal', 'Verge', 'Deck', 'Array', 'Dock', 'Habitat', 'Prime'],
    adjectives: ['augmented', 'cryo-cooled', 'derelict', 'ion-scarred', 'low-orbit', 'quantum-locked', 'retrofitted', 'sterile', 'vacuum-sealed'],
    nouns: ['airlock', 'beacon', 'cortex', 'drive', 'lattice', 'protocol', 'reactor', 'relay', 'servo', 'uplink'],
    materials: ['graphene weave', 'ceramic composite', 'salvaged hull-plate', 'printed titanium', 'optical fiber', 'ferrofluid'],
    epithets: ['of the Long Drift', 'Mk. IV', 'the Untethered', 'of Meridian Ring', 'the Decommissioned'],
  },
  modern: {
    onsets: ['Ad', 'Bea', 'Cass', 'Dan', 'El', 'Fran', 'Gray', 'Har', 'Iris', 'Jo', 'Kit', 'Lena', 'Marc', 'Nina', 'Owen', 'Pri', 'Ruth', 'Sam', 'Theo', 'Zo'],
    middles: ['', 'a', 'e', 'i', 'o'],
    codas: ['a', 'die', 'e', 'ie', 'l', 'n', 'ra', 'ry', 's', 'son', 'ya'],
    surnames: ['Adeyemi', 'Calloway', 'Delgado', 'Fitzgerald', 'Haas', 'Ishikawa', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Osei', 'Petrov', 'Quinn', 'Reyes', 'Sørensen', 'Vance'],
    placeStems: ['Ash', 'Bay', 'Cedar', 'Dock', 'East', 'Fair', 'Grand', 'Hill', 'King', 'Lake', 'North', 'Old', 'Park', 'West'],
    placeSuffixes: ['borough', 'bridge', 'field', 'gate', 'haven', 'market', 'port', 'row', 'side', 'town', 'view', 'ward'],
    adjectives: ['all-night', 'back-alley', 'corporate', 'half-renovated', 'neon-lit', 'off-grid', 'rain-slick', 'undercover'],
    nouns: ['badge', 'burner', 'dossier', 'favor', 'ledger', 'lockup', 'shortcut', 'stakeout', 'wire'],
    materials: ['brushed steel', 'poured concrete', 'cracked leather', 'tempered glass', 'reclaimed brick'],
    epithets: ['from the Docks', 'the Fixer', 'the Ghost', 'Jr.', 'the Third'],
  },
  mythic: {
    onsets: ['Ach', 'Bry', 'Cir', 'Dio', 'Eir', 'Gan', 'Her', 'Ish', 'Kal', 'Lug', 'Mor', 'Nep', 'Ody', 'Per', 'Rhi', 'Sig', 'Tal', 'Ur', 'Vor'],
    middles: ['a', 'e', 'i', 'o', 'an', 'ei', 'ia', 'ys'],
    codas: ['a', 'dine', 'dra', 'gard', 'los', 'mund', 'nos', 'ra', 'seus', 'tha', 'tis', 'ur'],
    surnames: ['Allfather-born', 'Delphi-sworn', 'Half-Divine', 'of the Nine Rivers', 'Oracle-marked', 'Stormline', 'Sunblooded', 'Wavecalled'],
    placeStems: ['Amber', 'Delph', 'Ember', 'Gods', 'Helio', 'Myrr', 'Olymp', 'Oracle', 'Styg', 'Sun', 'Thunder', 'Under'],
    placeSuffixes: ['fane', 'gard', 'grove', 'mount', 'os', 'reach', 'shrine', 'spring', 'throne', 'well'],
    adjectives: ['deathless', 'fate-bound', 'god-touched', 'oath-sworn', 'omen-read', 'sun-crowned', 'tide-born', 'thrice-blessed'],
    nouns: ['augury', 'chalice', 'labyrinth', 'laurel', 'oracle', 'pyre', 'thunderbolt', 'tribute', 'underworld'],
    materials: ['hammered bronze', 'olivewood', 'river-gold', 'sacred marble', 'serpent-scale', 'sky-iron'],
    epithets: ['Giant-Slayer', 'the Deathless', 'the Fate-Touched', 'the Storm-Sired', 'Twice-Born'],
  },
};

export function pools(theme: ThemeId): NamePools {
  return POOLS[theme];
}

export function personName(rng: Rng, theme: ThemeId): string {
  const p = POOLS[theme];
  const first =
    rng.pick(p.onsets) + (rng.chance(0.55) ? rng.pick(p.middles) : '') + rng.pick(p.codas);
  if (rng.chance(0.25)) return `${first} ${rng.pick(p.epithets)}`;
  return `${first} ${rng.pick(p.surnames)}`;
}

export function placeName(rng: Rng, theme: ThemeId): string {
  const p = POOLS[theme];
  const base = rng.pick(p.placeStems) + rng.pick(p.placeSuffixes);
  return theme === 'science-fiction' ? `${rng.pick(p.placeStems)} ${rng.pick(p.placeSuffixes)}` : base;
}

export function creatureName(rng: Rng, theme: ThemeId): string {
  const p = POOLS[theme];
  return `${cap(rng.pick(p.adjectives))} ${cap(rng.pick(p.nouns))}${rng.chance(0.3) ? ` of ${placeName(rng, theme)}` : ''}`;
}

export function itemName(rng: Rng, theme: ThemeId): string {
  const p = POOLS[theme];
  return rng.chance(0.5)
    ? `${cap(rng.pick(p.adjectives))} ${cap(rng.pick(p.nouns))}`
    : `${cap(rng.pick(p.nouns))} of ${cap(rng.pick(p.materials))}`;
}

export function factionName(rng: Rng, theme: ThemeId): string {
  const p = POOLS[theme];
  const forms = [
    () => `The ${cap(rng.pick(p.adjectives))} ${cap(rng.pick(p.nouns))}s`,
    () => `Order of the ${cap(rng.pick(p.nouns))}`,
    () => `The ${placeName(rng, theme)} ${rng.pick(['Pact', 'Court', 'Circle', 'Syndicate', 'Company'])}`,
  ];
  return rng.pick(forms)();
}

/** Quest/event/lore-style titles: "The Weeping of Silvermere". */
export function abstractTitle(rng: Rng, theme: ThemeId): string {
  const p = POOLS[theme];
  const forms = [
    () => `The ${cap(rng.pick(p.nouns))} of ${placeName(rng, theme)}`,
    () => `The ${cap(rng.pick(p.adjectives))} ${cap(rng.pick(p.nouns))}`,
    () => `${cap(rng.pick(p.nouns))} and ${cap(rng.pick(p.nouns))}`,
  ];
  return rng.pick(forms)();
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Indefinite article for a word — "an" before a vowel sound, else "a".
 * A light heuristic (ignores silent-h / vowel-y edge cases), good enough
 * for generated flavor text: "an age-worn idol", "a great cat". */
export function article(next: string): 'a' | 'an' {
  return /^[aeiou]/i.test(next.trim()) ? 'an' : 'a';
}

/** Pull usable flavor words from the user's hint so "sorcerer skill tree"
 * names actually mention sorcery even without a keyword match. */
export function hintWords(hint: string): string[] {
  return hint
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'new', 'skill', 'tree', 'entity',
  'make', 'create', 'generate', 'some', 'about', 'into', 'them', 'they', 'want', 'need',
]);
