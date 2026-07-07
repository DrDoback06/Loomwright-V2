import { newId } from '@/lib/id';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import type { Archetype, TypePack } from './index';
import { cap, personName, placeName, pools } from './lexicon';
import type { GenCtx } from './generic';

/** Deep cast pack: each archetype is one coherent kind of person — their
 * trade, wants, fears, scars, and speech all pull from the same well, so
 * a generated smuggler is smuggler from summary to shoe leather. */

const ARCHETYPES: Archetype[] = [
  {
    id: 'rogue',
    keywords: ['rogue', 'thief', 'smuggler', 'criminal', 'heist', 'cutpurse', 'underworld', 'con', 'burglar'],
    themes: 'any',
    lexicon: {
      traits: ['quick-fingered', 'glib', 'wary', 'charming', 'restless', 'superstitious', 'loyal to a fault', 'unsentimental'],
      nouns: ['ledger of debts', 'marked deck', 'skeleton key', 'safehouse', 'old crew', 'fence', 'tunnel under the wall', 'stolen seal'],
      occupations: ['smuggler', 'second-storey thief', 'fence of small treasures', 'forger of papers and seals', 'card sharp', 'lock-breaker for hire', 'courier of unmarked parcels', 'confidence artist'],
      honorifics: ['"Fingers"', 'the Magpie', 'Quickhand', 'the Gentleman'],
      goals: ['clear one impossible debt', 'pull a last job and vanish', 'buy back a family heirloom', 'keep the old crew out of prison', 'own something honestly for once', 'find out who sold them out', 'retire somewhere with no locks', 'earn a name the guild respects'],
      fears: ['locked cells', 'the crew learning the truth', 'dying unremembered', 'dogs', 'going straight and failing at it', 'the fence calling in the favour', 'open water', 'being predictable'],
      flaws: ['cannot resist an unopened lock', 'lies when the truth would do', 'gambles the escape money', 'trusts flattery', 'keeps trophies', 'allergic to plans that survive contact'],
      strengths: ['reads a room in a heartbeat', 'never forgets a floor plan', 'loyal to the crew', 'steady hands under pressure', 'improvises beautifully', 'knows everyone worth bribing'],
      marks: ['a coin-flip callus', 'faded rope scar on one wrist', "a tattoo they claim is someone else's", 'nine fingers and a good story', 'ink-stained fingertips', 'a crooked, often-broken nose'],
      looks: ['moves like someone counting exits', 'has quick eyes that inventory every pocket in the room', 'is smaller than the stories claim', 'keeps their back to the wall out of habit', 'smiles easily and means it rarely', 'wears their hood up indoors'],
      garb: ['soft-soled boots and too many pockets', 'a coat cut for running', 'gloves worn thin at the fingertips', 'nothing that catches the light', 'a lockpick sewn into every hem', 'clothes a shade too fine to be honest'],
      tics: ['"first rule of the trade—"', '"easy, easy"', 'counts under their breath', '"call it a loan"', 'whistles when lying', '"doors are just suggestions"'],
      morals: ['steals from those who can afford lawyers', 'never leaves a crew member behind', 'anything but blood', 'marks are chosen, never children', 'a deal kept is a deal kept, even with enemies', "won't rob the poor twice"],
      pasts: ['grew up running rooftops for a beggar-king', 'was the youngest ever taken into the guild', "did five years for someone else's job", "burned a famous crew's luck and fled the city", 'was born to honest people and disappointed them', 'learned locks from the inside of a cell', 'once stole something that should have stayed buried', 'still owes the fence who raised them'],
      talents: ['sleight of hand', 'silent entry', 'forgery', 'fast talk', 'escape artistry', 'appraising a mark at a glance'],
      statNames: ['Nerve', 'Fingers', 'Stealth', 'Charm', 'Luck'],
      wealth: ['a hidden cache in three cities', 'rich on paper, poor in pocket', 'one bad week from broke', 'a purse that is never theirs for long'],
      roles: ['Ally', 'Rival', 'Foil', 'Deuteragonist', 'Antagonist', 'Love interest', 'Protagonist'],
      voices: ['wry', 'colloquial', 'clipped', 'performative'],
      ages: ['young adult', 'adult', 'middle-aged'],
    },
  },
  {
    id: 'noble',
    keywords: ['noble', 'courtier', 'aristocrat', 'lord', 'lady', 'heir', 'court', 'dynasty', 'socialite'],
    themes: ['high-fantasy', 'grimdark', 'mythic', 'modern'],
    lexicon: {
      traits: ['poised', 'calculating', 'gracious', 'proud', 'bored', 'image-obsessed', 'privately kind', 'ruthless when cornered'],
      nouns: ['bloodline', 'estate', 'signet ring', 'inheritance', 'scandal', 'marriage contract', 'family portrait', 'debt of honour'],
      occupations: ['courtier and patron', 'heir to a diminished estate', 'master of protocol', 'envoy between rival houses', 'patron of unfashionable artists', 'keeper of the family seat', 'professional guest', 'arranger of advantageous marriages'],
      honorifics: ['Lady', 'Lord', 'the Honourable', 'Heir-Apparent'],
      goals: ['restore the family name', 'escape an arranged match', 'be loved for something they did', 'ruin the house that ruined theirs', 'secure the succession', 'matter beyond the dinner table', "keep the estate out of creditors' hands", 'be underestimated exactly once more'],
      fears: ['genteel poverty', 'the scandal surfacing', 'dying as a footnote', "their mother's verdict", 'being seen trying', "the servants' honest opinion", 'irrelevance', 'love without advantage'],
      flaws: ['mistakes etiquette for ethics', 'cannot apologise first', 'spends to be seen', 'collects grudges like heirlooms', 'assumes staff are furniture', "wagers what isn't theirs"],
      strengths: ['never forgets a name or a slight', 'commands a room by entering it', 'impeccable self-control', 'reads intent beneath courtesy', 'generous when it counts', 'educated in everything twice'],
      marks: ['a signet worn on a chain, not a finger', 'posture you could hang a coat on', 'an old fencing scar, elegantly placed', 'hands that have never dug anything', 'a laugh rationed like coin', 'the family nose'],
      looks: ['stands as if a portraitist might arrive any moment', 'has tired eyes above an untired smile', 'is handsome in the way of expensive things', 'looks best in candlelight and knows it', 'carries age like a title', 'wears composure as armour'],
      garb: ["last season's fashion maintained flawlessly", 'mourning colours regardless of occasion', 'one heirloom jewel and quiet everything else', 'tailoring sharp enough to draw blood', 'gloves for every hour of the day', 'a cloak worth more than the horse'],
      tics: ['"how charming"', '"my grandmother used to say—"', 'never asks, always wonders aloud', '"one hears things"', 'addresses everyone by full title', 'declines with compliments'],
      morals: ['the family before everything, including the family', 'cruelty is vulgar; ruin them politely', 'never lie where a ledger can check', 'the staff are protected, the peers are fair game', 'honour is what survives the audit', 'keeps promises made in writing'],
      pasts: ['was traded in a marriage contract at nine', 'watched the estate sold room by room', 'won a duel they still dream about', 'was the spare until the heir vanished', 'spent a season in disgrace abroad', 'was raised by servants and loves them better', 'carries the debts of three generations', 'once fled to live plainly, and came back'],
      talents: ['court protocol', 'genealogy and precedent', 'exhibition fencing', 'patronage and favours', 'the cutting compliment', 'hosting as warfare'],
      statNames: ['Poise', 'Influence', 'Wit', 'Lineage', 'Resolve'],
      wealth: ['land-rich and coin-poor', 'an allowance with conditions', 'old money, older debts', 'enough to be dangerous'],
      roles: ['Antagonist', 'Foil', 'Love interest', 'Ally', 'Deuteragonist', 'Rival', 'Mentor'],
      voices: ['formal', 'over-precise', 'wry', 'archaic'],
      ages: ['young adult', 'adult', 'middle-aged', 'elderly'],
    },
  },
  {
    id: 'veteran',
    keywords: ['soldier', 'veteran', 'war', 'sergeant', 'mercenary', 'guard', 'army', 'captain', 'warrior'],
    themes: 'any',
    lexicon: {
      traits: ['steady', 'tired', 'dry-humoured', 'dutiful', 'haunted', 'patient', 'blunt', 'protective'],
      nouns: ['old company', 'last order', 'service medal', 'lost campaign', 'muster roll', 'watch rotation', 'field kit', 'buried friend'],
      occupations: ['sergeant turned caravan guard', 'drill instructor nobody argues with', 'discharged scout', 'siege engineer between wars', 'bodyguard who reads the exits', 'quartermaster with a long memory', 'mercenary on the honest side of the ledger', 'watch captain of a quiet gate'],
      honorifics: ['Sergeant', 'Captain', 'Old', 'Warden'],
      goals: ['bring the last of the company home', 'die in a bed, not a ditch', 'keep one green recruit alive', 'get the pension they were promised', 'find who gave the order', "build something that isn't a wall", 'a quiet posting and no surprises', "teach the next war's soldiers to survive it"],
      fears: ['loud silences before an attack', 'outliving everyone again', 'being needed and slow', 'the war finding them retired', 'forgetting the names', 'crowds with no exits', 'giving the wrong order twice', 'being only good at one thing'],
      flaws: ['follows bad orders too long', 'drinks to sleep', 'cannot leave a fight unbalanced', 'treats civilians like recruits', 'volunteers for the worst of it', 'keeps everything, grieves nothing'],
      strengths: ['unshakeable under fire', 'reads terrain like scripture', 'logistics down to the last nail', 'earns trust by standing still', 'a memory for every face that served', 'knows when not to fight'],
      marks: ['shrapnel scars in a fan across one side', 'a regimental tattoo, half removed', 'two fingers that never healed straight', 'a limp that vanishes in a crisis', 'burn-mottled forearms', 'ears that ring in the quiet'],
      looks: ['stands at ease the way others stand at attention', 'has a face weathered into a permanent squint', 'is broader than the doorframe expects', 'moves with an economy that unsettles young toughs', 'keeps their boots better than their beard', 'scans rooflines without meaning to'],
      garb: ['a uniform coat stripped of insignia', 'boots resoled five times and kept', "a blade tied with a dead friend's cord", 'everything olive, grey, and mended', 'a pack ready by the door', 'one medal, worn inside the collar'],
      tics: ['"in the war—" then stops', '"eyes up"', '"we move at dawn"', 'answers questions with headcounts', '"that\'ll do, soldier"', 'taps the table like drum orders'],
      morals: ['the mission never outranks the people', "no orders that can't be said out loud", 'never leave the wounded', 'fights only what fights back', 'the surrendered get water', 'owes the dead honesty, not silence'],
      pasts: ['survived a company sold out by its own commander', 'held a gate for three days that history forgot', "signed at fifteen with someone else's papers", 'was decorated for the day they regret most', 'buried more friends than they can name sober', 'marched home to find home moved on', 'served both sides and prefers not to say the order', "trained the enemy's best, years before"],
      talents: ['small-unit tactics', 'field medicine', 'fortification', 'weapons drill', 'keeping the watch', 'reading morale'],
      statNames: ['Grit', 'Discipline', 'Aim', 'Endurance', 'Command'],
      wealth: ['back pay, still owed', 'a pension in a jar', 'poor, but never unequipped', 'buried coin under a milestone'],
      roles: ['Mentor', 'Ally', 'Deuteragonist', 'Protagonist', 'Foil', 'Background'],
      voices: ['terse', 'blunt', 'clipped', 'quiet'],
      ages: ['adult', 'middle-aged', 'elderly'],
    },
  },
  {
    id: 'scholar',
    keywords: ['scholar', 'archivist', 'librarian', 'professor', 'sage', 'researcher', 'scribe', 'historian', 'translator'],
    themes: 'any',
    lexicon: {
      traits: ['meticulous', 'curious past the point of sense', 'absent-minded', 'defensive of footnotes', 'gentle', 'stubborn on facts', 'nocturnal', 'quietly heretical'],
      nouns: ['forbidden index', 'marginalia', 'catalogue', 'first edition', 'burned library', 'translation', 'ink recipe', 'misfiled folio'],
      occupations: ['archivist of a collection nobody funds', 'translator of dead scripts', 'cataloguer of the restricted stacks', 'itinerant lecturer', 'forensic genealogist', 'keeper of maps that disagree', 'copyist with opinions', 'curator of a private, dubious collection'],
      honorifics: ['Doctor', 'Archivist', 'Professor', 'Keeper'],
      goals: ['finish the catalogue before the funding dies', 'recover the volume that was burned', 'prove the heresy was right', 'publish under their own name at last', 'protect the stacks from patriotic editing', 'decipher the marginalia in their own hand', 'train one student worth the effort', 'read the restricted shelf, just once, completely'],
      fears: ['fire, in any form', 'being cited and wrong', 'the collection dispersed at auction', 'their own fading memory', 'patrons with strong opinions', 'the answer being boring', 'dying mid-sentence', 'damp'],
      flaws: ['corrects people at funerals', 'hoards sources like a dragon', 'cannot summarise', 'forgets meals, names, and wars', 'lies only in the footnotes', 'values the book over the reader'],
      strengths: ['total recall for shelf and page', 'reads six scripts, argues in four', 'patience measured in decades', 'sees the forgery in the third line', 'connects archives no one else has read', 'teaches complexity kindly'],
      marks: ['ink permanently in the fingerprint whorls', 'spectacles repaired with wire', 'a paper-cut history across both hands', 'a stoop shaped like a reading desk', 'candle-singed cuffs', 'one eye that squints from close work'],
      looks: ['blinks at daylight like a translation error', 'is younger than the dust suggests', 'carries three books at all times, none of them finished', 'has the pallor of the stacks', 'gestures with whatever pen is nearest', 'looks through you toward a better source'],
      garb: ['robes with more pockets than dignity', 'a scarf against the archive chill in all seasons', 'cuffs shiny with graphite and wax', 'a satchel that outweighs them', 'the same coat, footnoted with patches', 'reading glasses pushed into wild hair'],
      tics: ['"well, actually, the earlier source—"', '"citation, please"', 'trails off mid-sentence to write', '"fascinating" (whispered)', 'alphabetises while talking', '"the margin says otherwise"'],
      morals: ['knowledge belongs to whoever will care for it', 'never burn a book, even that one', 'truth over patron, quietly', 'sources are protected like witnesses', 'credit given exactly where due', 'some indexes are safer unfinished'],
      pasts: ['smuggled a library out ahead of the fire, one satchel at a time', "was expelled for proving a founder's diary fake", 'apprenticed to an archivist who vanished into the stacks', "wrote a famous book published under a rival's name", "catalogued a war's dead until the names blurred", 'found their own family in the restricted files', 'traded a comfortable chair for a dangerous question', 'taught letters in secret where letters were banned'],
      talents: ['palaeography', 'cross-referencing', 'dead languages', 'forgery detection', 'mnemonic indexing', 'restoration binding'],
      statNames: ['Lore', 'Recall', 'Focus', 'Languages', 'Insight'],
      wealth: ['paid in access, not coin', 'a stipend and a cot in the stacks', 'comfortable, if books count', 'one priceless volume they will never sell'],
      roles: ['Mentor', 'Ally', 'Deuteragonist', 'Foil', 'Background', 'Protagonist'],
      voices: ['over-precise', 'formal', 'stream-of-consciousness', 'quiet'],
      ages: ['adult', 'middle-aged', 'elderly', 'ancient'],
    },
  },
  {
    id: 'zealot',
    keywords: ['priest', 'zealot', 'cleric', 'monk', 'faith', 'preacher', 'prophet', 'inquisitor', 'missionary', 'temple'],
    themes: ['high-fantasy', 'grimdark', 'mythic'],
    lexicon: {
      traits: ['serene', 'burning', 'austere', 'compassionate by discipline', 'certain', 'sleepless', 'charismatic', 'privately doubting'],
      nouns: ['calling', 'relic', 'congregation', 'vow', 'heresy', 'ordeal', 'scripture', 'long silence'],
      occupations: ['itinerant preacher', 'confessor to dangerous people', 'keeper of a roadside shrine', 'inquisitor, retired or otherwise', 'hospitaller of the plague quarter', 'translator of scripture into gutter-tongue', 'exorcist of modest fees', 'missionary to places with opinions'],
      honorifics: ['Mother', 'Father', 'Brother', 'Sister', 'Elder'],
      goals: ['see the relic returned to its house', 'convert one particular unbeliever', 'be worthy of the voice they heard once', 'root out the heresy — or join it honestly', 'build the mission with their own hands', 'die usefully', 'keep the congregation fed through winter', 'hear the voice a second time'],
      fears: ['that the silence is the answer', 'their own certainty', 'the relic being ordinary', 'loving the flock more than the faith', 'the old fire returning', 'being right about the end', 'confession with no one to hear it', 'doubt, contagious as plague'],
      flaws: ['mercy rationed by doctrine', 'hears omens in coincidence', 'fasts past usefulness', 'forgives enemies faster than friends', 'burns bridges as offerings', 'mistakes fervour for proof'],
      strengths: ['fearless in the way of the already-promised', 'a voice that carries and convinces', 'tends the sick without flinching', 'doctrine sharp enough for any debate', 'keeps vows like other people keep breathing', 'sees the person under the sin'],
      marks: ['a brand or tonsure grown half out', 'scarred knees', 'a holy symbol worn to smoothness', 'ash rubbed into the knuckle creases', 'self-inscribed verses up one arm', 'eyes lit from somewhere private'],
      looks: ['is gaunt in a way that looks deliberate', 'radiates a calm that unsettles', 'is younger than the sermons sound', 'stands like a candle: straight, consumed', 'has hands cracked from cold-water rites', 'smiles as if forgiving you in advance'],
      garb: ['robes patched with rope and pride', 'a travelling shrine on a back-strap', 'vestments too fine for the road, worn anyway', 'grey wool, no ornament, one relic', 'sandals in defiance of the season', 'a stole embroidered by the congregation'],
      tics: ['"as is written—"', 'blesses food, doors, and enemies', '"the flame remembers"', 'prays audibly mid-conversation', '"be at peace" (it is an order)', 'counts beads through every silence'],
      morals: ['every soul is owed a chance; a second is negotiable', 'doctrine bends before a hungry child', 'the wicked are warned once', 'lies are ash in the mouth — omissions are incense', 'the relic is worth lives, but not these lives', 'judges the sin loudly, the sinner gently'],
      pasts: ['heard a voice at the bottom of a well and climbed out changed', 'was the inquisitor whose name villages still whisper', 'grew up in the temple orphanage they now run', 'lost a congregation to plague and stayed to bury them', 'walked barefoot across a border to found the mission', 'was excommunicated, and continues anyway', 'burned the heretical texts, then memorised the rest', "swapped a soldier's oath for a monk's in one night"],
      talents: ['sermonising', 'rites and consecration', 'tending the sick', 'doctrine and debate', 'fasting and vigil', 'reading guilt in faces'],
      statNames: ['Faith', 'Zeal', 'Compassion', 'Presence', 'Endurance'],
      wealth: ['vowed to poverty, meticulously', 'the mission box, never touched', 'tithes held in trust', 'one relic beyond price'],
      roles: ['Mentor', 'Antagonist', 'Ally', 'Foil', 'Deuteragonist', 'Narrator'],
      voices: ['performative', 'archaic', 'quiet', 'formal', 'lyrical'],
      ages: ['young adult', 'adult', 'middle-aged', 'elderly'],
    },
  },
  {
    id: 'fixer',
    keywords: ['merchant', 'fixer', 'trader', 'broker', 'dealer', 'moneylender', 'pawnbroker', 'tycoon', 'businessman'],
    themes: 'any',
    lexicon: {
      traits: ['affable', 'transactional', 'unflappable', 'nosy', 'generous with strings attached', 'punctual', 'discreet', 'ambitious'],
      nouns: ['favour ledger', 'warehouse', 'trade route', 'handshake deal', 'commission', 'manifest', 'contact book', 'margin'],
      occupations: ['broker of favours and freight', 'importer of the technically legal', 'pawnbroker who remembers everything', 'caravan financier', 'procurer of the unprocurable', 'auctioneer of estates and secrets', 'shipping agent with flexible manifests', 'moneylender of last resort'],
      honorifics: ['Master', 'Madame', 'Boss', 'Agent'],
      goals: ['own the route, not just ride it', 'be owed by everyone who matters', 'retire before the debts mature', 'a seat at the cartel table', 'settle one score entered in red ink', 'launder the family name clean', 'find one honest partner', 'corner the market once, just to know the feeling'],
      fears: ["a ledger they can't balance", "owing more than they're owed", "the one client they couldn't refuse", 'audits, of any theology', 'handshakes from smiling strangers', 'the warehouse burning uninsured', 'being the mark', 'retiring and being no one'],
      flaws: ['prices friendship by the hour', 'cannot let an insult depreciate', 'smells profit in tragedies', 'over-promises delivery', 'keeps hostile ledgers on loved ones', 'trusts contracts over people, always'],
      strengths: ['knows the price of everything moving', 'turns enemies into customers', 'liquidity in five currencies', 'a courier network that beats the news', 'negotiates like water finding cracks', "never signs what they haven't read twice"],
      marks: ['rings that double as seals', 'an abacus callus on one thumb', 'a smile with a going rate', 'a warehouse-fire scar they sell differently each telling', 'a merchant house tattoo, bought out', 'pockets that never jingle'],
      looks: ['dresses one notch below their means, deliberately', 'has the handshake of a professional', "counts the room's worth on entering", 'is always mid-errand, even seated', 'laughs generously and watches while doing it', 'ages only in the ledgers'],
      garb: ['a travelling coat with hidden seams full of samples', 'sober cloth, extravagant buttons', 'a money belt worn like a spine', 'guild colours, subtly wrong', 'weatherproof everything — goods before glamour', 'one ostentatious ring for negotiations'],
      tics: ['"call it market rate"', '"I know a fellow"', 'rounds every number aloud', '"strictly business"', 'taps a ring on the table before deciding', '"you\'ll thank me at delivery"'],
      morals: ['a contract honoured is a reputation compounding', 'never sell what kills the customer twice', "family discounts exist; family exemptions don't", 'cheat the cheaters, carry the honest', 'information is stock: sold, never given', 'debts are sacred in both directions'],
      pasts: ['started as a dock-runner counting crates by lantern', "bought their first warehouse with a rival's forgotten debt", 'survived a cartel war by supplying both sides', 'was cheated once, spectacularly, and never again', 'inherited a ruined house and a brilliant contact book', 'smuggled medicine through a siege at cost, and denies it', 'lost a fortune to a storm and rebuilt on salvage rights', 'apprenticed to a moneylender who taught with fines'],
      talents: ['valuation at a glance', 'contract law, several jurisdictions', 'logistics', 'haggling as theatre', 'risk arithmetic', 'remembering who owes whom'],
      statNames: ['Shrewdness', 'Networks', 'Nerve', 'Liquidity', 'Patience'],
      wealth: ['diversified beyond easy counting', 'asset-rich, sentiment-poor', "a fortune, mostly in other people's debts", 'comfortable, with contingencies'],
      roles: ['Ally', 'Foil', 'Antagonist', 'Background', 'Rival', 'Deuteragonist'],
      voices: ['colloquial', 'wry', 'blunt', 'performative'],
      ages: ['adult', 'middle-aged', 'elderly'],
    },
  },
  {
    id: 'hunter',
    keywords: ['hunter', 'bounty', 'tracker', 'outlaw', 'manhunter', 'ranger', 'warden', 'marshal', 'trapper'],
    themes: 'any',
    lexicon: {
      traits: ['patient', 'laconic', 'single-minded', 'fair by code', 'watchful', 'unhurried', 'pragmatic', 'lonely and used to it'],
      nouns: ['warrant', 'trail', 'bounty board', 'quarry', 'snare', 'old wound', 'saddle', 'name on a list'],
      occupations: ['bounty hunter of the licensed sort', 'tracker for hire', 'warden of the far roads', 'skip-tracer of vanished debtors', 'game warden turned manhunter', 'guide through the badlands', "stalker of things others won't name", 'retriever of the stolen and the strayed'],
      honorifics: ['Tracker', 'Warden', 'Huntsman', 'Marshal'],
      goals: ['close the one warrant they never speak of', 'earn enough to burn the list', 'bring this one back alive, for a change', 'find who wrote their name on a bounty', 'hang up the snares somewhere green', 'end the trade with them — train no successor', 'a clean record and a cold trail behind them', 'learn what the quarry knew'],
      fears: ['becoming the thing on the wanted poster', 'a trail going truly cold', 'sympathy for the quarry', "sleeping soundly (something's wrong)", 'towns', 'the day their knees give', 'being hunted by someone with their patience', 'the wrong name on the warrant'],
      flaws: ['finishes hunts that should be dropped', 'trusts animals over people', 'keeps the last promise past all sense', 'goes silent for weeks', 'collects mementos from every capture', 'cannot watch a cage without opening it or filling it'],
      strengths: ['reads a week-old trail like morning news', 'endless, even-tempered patience', 'strikes exactly once', 'field-craft in any weather', 'an instinct for lies about routes', 'keeps prisoners alive and unharmed, on principle'],
      marks: ['a lattice of animal scars, none regretted', 'frost-bitten fingertips', 'a brand from someone they caught', 'boots worn to the shape of the road', 'one eye pale from an old strike', 'a necklace of spent charms, unexplained'],
      looks: ['is weather-tanned to the colour of the road', 'stands still the way trees do', 'watches doorways, not faces', 'travels light and armed like luggage', 'smells of woodsmoke and oiled leather', 'has a horizon-squint indoors'],
      garb: ['oilcloth and leather, all of it quiet', 'a long coat with a story per stain', 'traps and cord looped like jewellery', 'muted colours the land forgets', 'a wide-brimmed hat older than most grudges', 'a blanket-roll that has been a bed, a stretcher, and a shroud'],
      tics: ['"trail\'s never cold, just patient"', 'points with the chin', '"alive costs extra"', 'answers questions a full minute late', '"we walk from here"', 'whistles bird-calls in cities'],
      morals: ['the warrant is the law; the manner is theirs', 'no bounty on children, no exceptions', 'the quarry eats when they eat', "kills only what can't be caged or carried", "won't hunt for revenge — theirs or a client's", 'a surrendered name is safe with them'],
      pasts: ['was quarry once, and remembers which knots slipped', 'learned tracking from a parent the law took', 'hunted the far ranges until the ranges emptied', 'brought in a famous name and gave away the purse', 'lost a partner to a bounty gone sideways', 'was a lawman until the law changed underneath them', 'grew up with trappers on a border no map agrees on', 'has one uncollected warrant folded in a boot'],
      talents: ['tracking', 'snares and ambush', 'wilderness survival', 'gentle interrogation', 'knots and restraints', 'reading weather and men'],
      statNames: ['Patience', 'Tracking', 'Aim', 'Survival', 'Resolve'],
      wealth: ['bounties banked in three names', 'poor in coin, rich in favours owed by sheriffs', 'everything they own is on the horse', 'a strongbox buried under a lightning tree'],
      roles: ['Antagonist', 'Rival', 'Ally', 'Deuteragonist', 'Protagonist', 'Foil'],
      voices: ['terse', 'quiet', 'blunt', 'clipped'],
      ages: ['adult', 'middle-aged', 'elderly'],
    },
  },
  {
    id: 'seer',
    keywords: ['mystic', 'seer', 'oracle', 'prophet', 'augur', 'fortune', 'vision', 'dream', 'fate', 'witch'],
    themes: ['high-fantasy', 'grimdark', 'mythic'],
    lexicon: {
      traits: ['fey', 'gentle', 'unsettling', 'distracted by the invisible', 'kind at strange angles', 'fatalistic', 'mischievous', 'burdened'],
      nouns: ['omen', 'third dream', 'veil', 'reading', 'thread of fate', 'offering bowl', 'trance', 'unspoken name'],
      occupations: ['reader of fates at the crossroads', 'oracle of a shrinking shrine', 'dream-interpreter to the powerful', 'wandering augur', 'keeper of the bone lots', 'medium between reluctant parties', 'court seer, officially decorative', 'hermit consulted by the desperate'],
      honorifics: ['Oracle', 'Seer', 'Elder', 'the Veiled'],
      goals: ['avert the one vision that repeats', 'find someone who hears the warning in time', 'pass the sight on before it passes them', 'see their own thread, just once', 'be wrong, gloriously wrong, about the end', 'free the shrine from its patron', 'a single night of dreamless sleep', 'learn who is watching back through the veil'],
      fears: ['the vision that repeats', 'mirrors, after dark', 'being believed too late', 'being believed too soon', 'the silence where the omens were', 'their own funeral, already seen', 'the question they must not answer', 'losing the sight and staying strange'],
      flaws: ['speaks in answers to unasked questions', 'withholds the merciful lie', 'bargains with forces on a first-name basis', 'forgets which year it is locally', 'tests prophecies on bystanders', 'cannot resist reading a palm mid-handshake'],
      strengths: ['sees the shape of things before they arrive', 'uncannily calm in catastrophe', 'reads people like weather', 'remembers every dream, theirs and others', 'frightens the arrogant into honesty', 'knows which small kindness moves the thread'],
      marks: ['clouded or mismatched eyes', 'symbols hennaed or scarred along the arms', 'white hair from a single night', 'a burn in the shape of nothing anyone recognises', 'fingers stained with omen-ash', 'a shadow that lags, slightly, in lamplight'],
      looks: ['focuses two inches behind your eyes', 'moves as if rehearsing something already seen', 'is older or younger every time you look', "dresses for a weather that hasn't arrived yet", 'hums chords that make dogs sit', 'smiles at empty chairs, politely'],
      garb: ['veils and layers in unfixable colours', 'a mantle sewn with tokens from petitioners', 'robes hemmed with tiny bells, all silenced', 'charms strung until the coat clicks', 'one glove, always; ask and be sorry', 'shawls that smell of smoke and rain'],
      tics: ['"I have seen this table before"', '"not yet" (to nothing)', "answers tomorrow's question", '"the threads dislike that plan"', 'pauses to listen to nothing', '"you were taller in the dream"'],
      morals: ['warn once; fate hates a nag', 'never sell a doom, only a chance', "the veil's secrets stay behind the veil", "no reading for those who'd harm the read", 'truth in visions, kindness in the telling', 'free prophecy for children and the dying'],
      pasts: ['drowned for three minutes and came back bilingual in omens', 'was the seventh child of a seventh child, as advertised', 'read the fall of a dynasty and wisely left town first', 'apprenticed to an oracle who saw their meeting coming', 'wandered out of a fog no map contains', 'was a sceptic, professionally, until the third dream', 'traded an eye, a name, or a year — accounts differ', 'has been avoiding one prophecy since childhood'],
      talents: ['augury', 'dream-reading', 'trance-work', 'omens and portents', 'soothing the fated', 'misdirecting the curious'],
      statNames: ['Sight', 'Intuition', 'Serenity', 'Presence', 'Willpower'],
      wealth: ['paid in eggs, secrets, and rare coins', 'a bowl of offerings, redistributed nightly', "owns nothing the wind can't carry", 'wealthy in favours from the frightened'],
      roles: ['Mentor', 'Foil', 'Narrator', 'Ally', 'Background', 'Deuteragonist'],
      voices: ['lyrical', 'archaic', 'quiet', 'stream-of-consciousness'],
      ages: ['young adult', 'middle-aged', 'elderly', 'ancient', 'timeless'],
    },
  },
];

/** Pronoun spread (values must match the cast config's options verbatim). */
const PRONOUN_ROWS = [
  { value: 'she/her', weight: 8 },
  { value: 'he/him', weight: 8 },
  { value: 'they/them', weight: 5 },
  { value: 'xe/xem', weight: 1 },
  { value: 'ze/zir', weight: 1 },
  { value: 'unknown', weight: 1 },
];

/** Plausible numeric spans per age-range pill; unmapped ranges (ancient,
 * timeless, unknown) leave the numeric age blank. */
const AGE_SPANS: Record<string, [number, number]> = {
  child: [8, 12],
  teen: [13, 17],
  'young adult': [18, 27],
  adult: [28, 42],
  'middle-aged': [43, 60],
  elderly: [61, 88],
};

function pickSlot(rng: Rng, arch: Archetype, slot: string): string {
  const pool = arch.lexicon[slot];
  return pool?.length ? rng.pick(pool) : '';
}

/** A few distinct entries from one slot — chips fields (goals, fears…). */
function pickChips(rng: Rng, arch: Archetype, slot: string, min: number, max: number): string[] {
  const pool = arch.lexicon[slot] ?? [];
  return rng.shuffle(pool).slice(0, rng.int(min, Math.min(max, pool.length)));
}

/** One fully-fielded character. Every prose field draws from the same
 * archetype pools, so the summary, secrets, and scars all agree. */
export function generateCastDraft(rng: Rng, arch: Archetype, ctx: GenCtx): BundleEntityDraft {
  const theme = ctx.theme;
  const p = pools(theme);
  const name = personName(rng, theme);
  const first = name.split(' ')[0];
  const trait = () => pickSlot(rng, arch, 'traits');
  const noun = () => pickSlot(rng, arch, 'nouns');
  const past = () => pickSlot(rng, arch, 'pasts');
  const look = () => pickSlot(rng, arch, 'looks');

  const occupation = pickSlot(rng, arch, 'occupations');
  const voice = pickSlot(rng, arch, 'voices');
  const ageRange = pickSlot(rng, arch, 'ages');
  const goals = pickChips(rng, arch, 'goals', 2, 3);
  const fears = pickChips(rng, arch, 'fears', 2, 3);
  const flaws = pickChips(rng, arch, 'flaws', 1, 2);
  const strengths = pickChips(rng, arch, 'strengths', 1, 2);

  const summary = rng.pick([
    () => `A ${trait()} ${occupation} who means to ${goals[0]}.`,
    () => `${cap(occupation)} by trade, ${trait()} by nature — and still tangled up with the ${noun()}.`,
    () => `Everyone knows the ${trait()} ${occupation}; nobody knows about the ${noun()}.`,
  ])();

  const description = rng.pick([
    () =>
      `${name} is a ${trait()} ${occupation}, ${ageRange} and ${trait()}. Years ago ${first} ${past()}, and the ${noun()} has followed ever since. These days the goal is simpler and harder: ${goals[0]}.`,
    () =>
      `Ask around and you hear the same two words about ${first}: ${trait()}, ${trait()}. What the stories skip is that ${first} once ${past()} — which explains the ${noun()}, and most of the rest.`,
  ])();

  const personality = `${cap(trait())} on first meeting, ${trait()} once it matters. ${cap(strengths[0])}, but ${flaws[0]} — and quietly afraid of ${fears[0]}.`;

  const secrets = rng.pick([
    () => `Nobody left alive knows that ${first} ${past()}.`,
    () => `The ${noun()} is not what ${first} claims it is — and they know exactly why.`,
    () => `Privately terrified of ${fears[0]}, and hiding it behind the ${occupation}'s calm.`,
  ])();

  const backstory = rng.pick([
    () =>
      `Long before the story finds them, ${first} ${past()}. The ${noun()} dates from those years, and so does the fear of ${fears[1] ?? fears[0]}.`,
    () =>
      `${first} ${past()}, then spent years near ${placeName(rng, theme)} pretending otherwise. It almost worked.`,
  ])();

  const arcSummary = `Starts the story ${trait()}, certain of the ${noun()}; ends it having to choose between "${goals[0]}" and ${goals[1] ? `"${goals[1]}"` : 'the people standing beside them'}.`;

  const currentStatus = rng.pick([
    () => `Working as a ${occupation} and quietly manoeuvring to ${goals[0]}.`,
    () => `Lying low since the business with the ${noun()}; the ${p.nouns[0]} rumours have not helped.`,
  ])();

  const speechStyle = `${cap(voice)}, with a habit of ${rng.pick([
    `steering every conversation back to the ${noun()}`,
    'going quiet instead of lying',
    'answering questions with better questions',
    `sizing people up like a ${occupation.split(' ')[0]} would`,
  ])}.`;

  const physicalDescription = `${first} ${look()}, and ${look()}. ${cap(pickSlot(rng, arch, 'marks'))} completes the picture.`;

  const pronouns = rng.weightedPick(PRONOUN_ROWS).value;
  const span = AGE_SPANS[ageRange];

  const fields: Record<string, unknown> = {};
  const set = (id: string, value: unknown): void => {
    if (value !== undefined) fields[id] = value;
  };

  set('description', description);
  set('role', pickSlot(rng, arch, 'roles'));
  set('pronouns', pronouns);
  set('ageRange', ageRange);
  set('age', span && rng.chance(0.5) ? String(rng.int(span[0], span[1])) : undefined);
  set('honorific', rng.chance(0.5) ? pickSlot(rng, arch, 'honorifics') : undefined);
  set('occupation', occupation);
  set('physicalDescription', physicalDescription);
  set('clothing', `${cap(pickSlot(rng, arch, 'garb'))}. ${cap(pickSlot(rng, arch, 'garb'))}.`);
  set('distinguishingMarks', pickChips(rng, arch, 'marks', 1, 2));
  set('voiceProfile', voice);
  set('speechStyle', speechStyle);
  set('verbalTics', pickChips(rng, arch, 'tics', 1, 2));
  set('personality', personality);
  set('goals', goals);
  set('fears', fears);
  set('secrets', secrets);
  set('flaws', flaws);
  set('strengths', strengths);
  set('moralCompass', pickSlot(rng, arch, 'morals'));
  set('arcSummary', arcSummary);
  set('backstory', backstory);
  set('currentStatus', currentStatus);
  set(
    'presence',
    rng.weightedPick([
      { value: 'on-stage', weight: 7 },
      { value: 'off-stage', weight: 2 },
      { value: 'mentioned only', weight: 1 },
      { value: 'missing', weight: 1 },
    ]).value
  );
  if (rng.chance(0.5)) {
    set(
      'stats',
      rng
        .shuffle(arch.lexicon.statNames)
        .slice(0, rng.int(3, 4))
        .map((statName) => ({ name: statName, value: String(rng.int(2, 9)) }))
    );
  }
  set('abilities', rng.chance(0.6) ? pickChips(rng, arch, 'talents', 2, 3) : undefined);
  set('wealth', rng.chance(0.6) ? pickSlot(rng, arch, 'wealth') : undefined);
  if (rng.chance(0.5)) {
    set(
      'writingInstructions',
      `Keep the dialogue ${voice}; let the ${noun()} surface only in subtext. Never let ${first} explain their own ${rng.pick(['secret', 'past', 'fear'])} out loud.`
    );
  }

  // Refs into the project: single related fields link a known entity of
  // the right type when one exists (as generic.ts does), else stay blank.
  const refTo = (type: string, chance: number) => {
    const candidates = ctx.known.filter((k) => k.type === type);
    if (!candidates.length || !rng.chance(chance)) return undefined;
    const k = rng.pick(candidates);
    return { id: k.id, type: k.type, name: k.name };
  };
  set('species', refTo('races', 0.6));
  set('class', refTo('classes', 0.6));
  set('faction', refTo('factions', 0.6));
  set('currentLocation', refTo('locations', 0.5));
  set('homeLocation', refTo('locations', 0.4));

  const knownSkills = ctx.known.filter((k) => k.type === 'skills');
  if (knownSkills.length && rng.chance(0.5)) {
    set(
      'skills',
      rng
        .shuffle(knownSkills)
        .slice(0, rng.int(1, Math.min(2, knownSkills.length)))
        .map((k) => ({ id: k.id, type: k.type, name: k.name }))
    );
  }

  // Deal known cast from a single shuffled deck so the same person never
  // lands in both `allies` and `enemies`.
  const castDeck = rng.shuffle(ctx.known.filter((k) => k.type === 'cast'));
  const deal = (max: number) => {
    if (!castDeck.length) return undefined;
    return castDeck
      .splice(0, rng.int(1, Math.min(max, castDeck.length)))
      .map((k) => ({ id: k.id, type: k.type, name: k.name }));
  };
  if (rng.chance(0.5)) set('allies', deal(2));
  if (rng.chance(0.4)) set('enemies', deal(1));
  if (rng.chance(0.3)) set('rivals', deal(1));
  if (rng.chance(0.25)) set('mentors', deal(1));

  return {
    localId: newId(),
    type: 'cast',
    name,
    aliases: rng.chance(0.3) ? [`${first} ${rng.pick(p.epithets)}`] : [],
    summary,
    tags: [arch.id, trait()],
    fields,
  };
}

export const castPack: TypePack = {
  type: 'cast',
  archetypes: ARCHETYPES,
  generate: (rng, arch, ctx) => generateCastDraft(rng, arch, ctx),
};
