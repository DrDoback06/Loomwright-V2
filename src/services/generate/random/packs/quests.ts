import { newId } from '@/lib/id';
import type { BundleEntityDraft } from '../../types';
import type { Rng } from '../rng';
import type { Archetype, TypePack } from './index';
import { cap, placeName, type ThemeId } from './lexicon';
import type { GenCtx } from './generic';

/** Deep quests pack: each archetype is one job shape — its prize, its
 * opposition, its venues, and its beats all pull from the same well, so
 * a heist reads like a heist from hook to final step. Slot templates use
 * `{token}` markers ({prize}, {mark}, {venue}, {complication}, {reward},
 * {noun}, {verb}, {adjective}, {place}) filled per draft by one rng. */

const ARCHETYPES: Archetype[] = [
  {
    id: 'heist',
    keywords: ['heist', 'steal', 'thief', 'burglary', 'vault', 'robbery', 'score', 'infiltrate', 'smuggle'],
    themes: 'any',
    lexicon: {
      verbs: ['crack', 'lift', 'spring', 'case', 'forge', 'fence', 'palm', 'infiltrate'],
      nouns: ['vault', 'score', 'strongbox', 'ledger', 'seal', 'key', 'take', 'lockbox'],
      adjectives: ['airtight', 'crooked', 'gilded', 'well-guarded', 'audacious', 'quiet', 'inside'],
      prizes: ["the magistrate's sealed ledger", 'a strongbox of unmarked coin', "the guild's master key", "a deed signed in someone else's blood", "the collector's prize piece", 'three bars of tax-stamped bullion', 'the only copy of the debt rolls', 'a signet ring that opens every door in the quarter'],
      marks: ["the Provost's hired blades", 'a vault-keeper who never sleeps', 'the counting-house guards', 'a rival crew with the same idea', "the owner's private enforcer", 'a warded lock no one has beaten', 'the toll-masters and their dogs', 'an informant already inside'],
      venues: ['a counting-house with one door', 'the strongroom beneath the exchange', 'a moving vault that never stops', 'the auction floor at closing bell', 'a pleasure-barge owned by the mark', "the archive's sealed lower stacks", 'a townhouse mapped only from outside', 'the mint during the changing of shifts'],
      complications: ['the floor plans are ten years stale', 'the inside contact has gone quiet', 'the lock was changed a week ago', 'half the take is already promised away', 'someone tipped off the watch', 'the prize is heavier than reported', 'a rival crew moves the same night', 'the buyer wants it undamaged — and unopened'],
      rewards: ['a cut worth retiring on', 'a favor from the fence who wants it', 'leverage over the mark for years', "the crew's reputation, made", 'enough coin to buy silence twice over', 'a standing invitation from the underworld'],
      hooks: [
        '{prize} sits in {venue}, and {mark} would like to keep it that way.',
        'The buyer pays triple for {prize} — the trouble is {venue}, and everyone guarding it.',
        'One night, one way in, one chance at {prize}. But {complication}.',
        'Everyone says {venue} cannot be cracked. The fence is betting {reward} that it can.',
      ],
      goals: [
        'lift {prize} from {venue} without {mark} ever learning who did it',
        "get {prize} out clean and into the buyer's hands",
        'crack {venue}, take {prize}, and leave nothing behind but questions',
      ],
      openings: [
        'Case {venue} and chart every watcher, lock, and blind spot.',
        'Buy, bribe, or forge a way past the outer doors of {venue}.',
        'Find the one person inside who can be bought.',
        'Assemble the crew — every hand chosen for one job only.',
      ],
      middles: [
        'Copy the key, the seal, or the face that opens the inner door.',
        'Arrange a distraction loud enough to move {mark}.',
        'Slip inside during the changing of the watch.',
        'Disable the wards without waking the whole quarter.',
        'Locate {prize} — it is never kept where the maps say.',
        'Deal with the guard who was not on the schedule.',
        'Keep the inside contact calm and useful.',
      ],
      twists: [
        'Discover that {complication} — and improvise.',
        'A rival crew hits {venue} the same night.',
        'The inside contact names a new price, mid-job.',
        '{prize} is not what the buyer described.',
      ],
      climaxes: [
        'Take {prize} and get out before the alarm is rung.',
        'Walk {prize} past {mark} in plain sight.',
        'Escape across the rooftops with {prize} in hand.',
        'Trade the decoy for {prize} in the space of a breath.',
      ],
      closings: [
        'Fence {prize} and scatter until the heat dies.',
        'Divide the take and swear the crew to silence.',
        'Deliver {prize} to the buyer and learn who they really are.',
        'Vanish before {mark} work out what was lost.',
      ],
      questTypes: ['Side quest', 'Task', 'Faction objective', 'Challenge'],
    },
  },
  {
    id: 'escort',
    keywords: ['escort', 'guard', 'protect', 'caravan', 'bodyguard', 'convoy', 'safeguard', 'shepherd'],
    themes: 'any',
    lexicon: {
      verbs: ['shepherd', 'guard', 'convoy', 'shield', 'escort', 'chaperone', 'ferry', 'deliver'],
      nouns: ['road', 'charge', 'convoy', 'caravan', 'crossing', 'passage', 'escort', 'waypoint'],
      adjectives: ['long', 'hostile', 'watched', 'lonely', 'unmapped', 'contested', 'treacherous'],
      prizes: ['a witness who has seen too much', 'the heir nobody was supposed to find', 'a diplomat carrying an unsigned treaty', 'a healer sworn to reach the front', 'the last engineer who knows the old works', 'a bride whose wedding will end a war', 'a prisoner worth more alive', 'an old friend who will not say why they are hunted'],
      marks: ['bounty hunters working in relays', 'a warband that owns the passes', "assassins with the charge's description", 'deserters turned road-agents', 'a spy already inside the party', "the charge's own family", 'wolves — the four-legged kind, then the other kind', 'a rival escort paid to fail'],
      venues: ['the toll-road through the marshes', 'a mountain pass that closes with the first snow', 'river country with too few bridges', 'a border crossing crawling with informants', 'three days of open country with no cover', 'the night ferry and its unlicensed captain', 'backroads that appear on no honest map', 'the dry road where nothing grows and everything watches'],
      complications: ['the charge keeps trying to slip away', 'someone is selling the route ahead', 'the safe house is no longer safe', 'the charge is not who they claimed', 'winter arrives three weeks early', 'the pursuers stay exactly half a day behind', 'supplies run short at the worst mile', "the charge's enemies have posted a price no one refuses"],
      rewards: ['payment on delivery, doubled for silence', 'the gratitude of someone who will matter', 'safe passage rights for life', 'a debt the charge intends to honor', 'letters of passage worth more than gold', 'a friend where a friend is rarest'],
      hooks: [
        '{prize} must reach {place} alive, and {mark} are paid to see otherwise.',
        'The route runs through {venue}; the charge is {prize}; the rest is negotiable.',
        'Getting {prize} to {place} would be simple, except {complication}.',
        'Nobody takes {venue} anymore. That is why the job pays what it pays.',
      ],
      goals: [
        'see {prize} safely to {place}, whatever follows on the road',
        'bring {prize} through {venue} without losing them or the party',
        'deliver {prize} alive, unbought, and on time',
      ],
      openings: [
        'Meet the charge and learn what the contract left out.',
        'Plan the route: {venue}, or somewhere worse.',
        'Provision for the road and hide the charge in plain sight.',
        'Choose the route no one expects, and tell no one.',
      ],
      middles: [
        'Cross {venue} before word of the party travels faster.',
        'Shake the riders who have followed since the first gate.',
        'Find shelter when the weather turns against the road.',
        'Talk, pay, or fight the way through a checkpoint.',
        'Keep the charge fed, hidden, and speaking to no one.',
        'Replace what was lost at the last crossing.',
        'Learn why {mark} want the charge so badly.',
      ],
      twists: [
        'Discover that {complication}.',
        'The charge confesses the truth of who they are.',
        'An ambush at the one place the route could not avoid.',
        'A traveler joins the party — too helpful, too well-armed.',
      ],
      climaxes: [
        'Break through the last cordon before {place}.',
        'Stand between the charge and {mark} when the road runs out.',
        'Run the final gate with everything the party has left.',
        'Make the last crossing at night, in silence, all at once.',
      ],
      closings: [
        'Hand over the charge and watch the doors close behind them.',
        'Collect the fee and decide whether it was worth it.',
        'Part ways with {prize}, richer and marked by the road.',
        'Learn what the delivery set in motion.',
      ],
      questTypes: ['Task', 'Side quest', 'Promise', 'Main quest'],
    },
  },
  {
    id: 'rescue',
    keywords: ['rescue', 'save', 'captive', 'hostage', 'prisoner', 'kidnapped', 'free', 'ransom'],
    themes: 'any',
    lexicon: {
      verbs: ['free', 'save', 'break', 'unchain', 'recover', 'ransom', 'retrieve', 'reach'],
      nouns: ['cage', 'ransom', 'cell', 'chain', 'captive', 'gaol', 'shackle', 'reckoning'],
      adjectives: ['desperate', 'overdue', 'reckless', 'quiet', 'impossible', 'unpaid', 'last-hour'],
      prizes: ['a child taken from the harvest road', 'the captain who surrendered to save her crew', 'a scholar who read the wrong archive', 'the hostage whose ransom was refused', 'a healer press-ganged for their gift', "someone's father, held for another man's debt", 'the informant the party still owes', 'a stranger who begged the party by name'],
      marks: ['slavers working the back roads', 'a garrison that answers to no court', 'a cult that calls captives "guests"', 'kidnappers whose ransom notes keep changing', 'a warlord collecting hostages like coin', 'gaolers paid to forget names', 'a creditor with a private prison', 'raiders already moving their camp'],
      venues: ['a hill-fort with one gate and forty spears', 'the prison barge anchored off the point', 'a camp that moves every third night', 'the cellars beneath a respectable house', 'a mine worked by the unransomed', 'the tower where guests are kept, not held', 'a stockade at the edge of the maps', "the temple's locked and quiet undercroft"],
      complications: ['the captive has been moved once already', 'the ransom was a trap all along', 'a guard has recognized someone in the party', 'the captive will not leave without the others', 'the captors expect a rescue — and planned for it', 'time is shorter than anyone admitted', 'the captive no longer wants saving', 'someone paid to keep the captive exactly where they are'],
      rewards: ['a family made whole, and a debt of honor', 'the ransom money, unspent', "the captive's knowledge, freely given at last", 'an ally who will answer any future call', 'the gratitude of people who never forget', 'a name cleared and a door opened'],
      hooks: [
        '{prize} is held in {venue}, and every day the trail grows colder.',
        '{mark} took {prize}. The ransom has failed. What remains is the direct approach.',
        'Someone must reach {venue} and bring {prize} out — before {complication}.',
        'The law will not go where {prize} is kept. Someone else will have to.',
      ],
      goals: [
        'bring {prize} out of {venue} alive',
        'free {prize} before {mark} move them beyond reach',
        'get in, find {prize}, and get everyone home',
      ],
      openings: [
        'Follow the trail to {venue} before it goes cold.',
        "Learn the captors' routine: meals, watches, and mercies.",
        'Make contact — a note, a signal, a bribed guard.',
        'Confirm {prize} still lives, and where they sleep.',
      ],
      middles: [
        'Find the way in that {mark} have not thought to guard.',
        'Get close under a borrowed name or a darker night.',
        'Reach the cells and keep the captive quiet through the fear.',
        'Deal with the guard who cannot be avoided.',
        'Cut the captive loose and dress them as one of the party.',
        'Hold the route out open just long enough.',
        'Silence the alarm before it finishes ringing.',
      ],
      twists: [
        'Discover that {complication}.',
        'There are more captives than the party came for.',
        'The captive knows why they were taken — and it changes everything.',
        '{mark} begin striking camp mid-rescue.',
      ],
      climaxes: [
        'Run for the walls with {prize} and the whole camp waking.',
        'Face {mark} at the gate with no plan left but nerve.',
        'Carry the captive out through the one unwatched way.',
        'Buy the last hundred yards with everything in the purse — or the scabbard.',
      ],
      closings: [
        'Get {prize} somewhere the captors cannot follow.',
        'Return the rescued to those who never stopped waiting.',
        "Hear the captive's story, and decide what to do about it.",
        'Count the cost, and remember who is owed.',
      ],
      questTypes: ['Main quest', 'Promise', 'Character goal', 'Side quest'],
    },
  },
  {
    id: 'investigation',
    keywords: ['investigate', 'mystery', 'murder', 'clue', 'detective', 'missing', 'secret', 'truth', 'disappearance'],
    themes: 'any',
    lexicon: {
      verbs: ['unravel', 'trace', 'question', 'expose', 'follow', 'uncover', 'sift', 'name'],
      nouns: ['thread', 'witness', 'alibi', 'cipher', 'motive', 'rumor', 'confession', 'truth'],
      adjectives: ['cold', 'tangled', 'buried', 'delicate', 'unofficial', 'half-forgotten', 'dangerous'],
      prizes: ['the truth of what happened that night', 'the name behind three unsigned letters', 'proof of who really paid the killer', 'what became of the ones who vanished', 'the reason the records were burned', 'the face beneath the borrowed name', 'why the witness changed her story', 'what the dead man knew, and who he told'],
      marks: ['a suspect with too perfect an alibi', 'witnesses who forget things for a fee', 'an official who wants the matter closed', 'whoever keeps cleaning up the evidence', 'a family with reasons to stay silent', 'the investigator who came before — and stopped', 'someone erasing the trail a step ahead', 'a liar so good even they believe it'],
      venues: ['a quarter where questions cost extra', 'the archive with the missing year', 'a tavern where everyone saw nothing', 'the scene — cold now, but not silent', 'a household of locked doors and rehearsed answers', "the coroner's untidy back room", 'the docks after the lamps go out', 'a courtroom where the verdict came too fast'],
      complications: ['the chief witness has disappeared', 'the evidence points somewhere no one wants to look', 'someone is following the investigators', 'a second crime interrupts the first', 'the client is lying about why they care', 'every trail loops back to a friend', 'the official record has been rewritten', 'the deeper it goes, the older it gets'],
      rewards: ['the truth, and the choice of what to do with it', "a client's silence-heavy purse", 'leverage over people who thought themselves safe', 'an innocent name restored', 'the enmity of the guilty — and their fear', 'answers that open three new questions'],
      hooks: [
        '{prize} is buried under alibis and paid silences — someone wants it dug up.',
        'Everyone has agreed on a story. The evidence has not. The difference is {prize}.',
        'The official inquiry closed in a week. The real one starts in {venue}.',
        'A client pays well to learn {prize} — and better to keep the asking quiet.',
      ],
      goals: [
        'learn {prize} and survive knowing it',
        'follow the thread through {venue} until it names a name',
        'find {prize} before whoever is erasing the trail finishes',
      ],
      openings: [
        'Walk the scene and note what the first report ignored.',
        'List who profits, who lied, and who left town.',
        "Take the client's story apart before trusting it.",
        'Read everything: ledgers, letters, and what was burned.',
      ],
      middles: [
        'Question {mark} without showing how much is known.',
        'Find the witness everyone else overlooked.',
        'Follow the money through {venue}.',
        'Break the alibi that everyone accepted.',
        'Match the cipher, the handwriting, or the boot-print.',
        'Trade a small secret for a larger one.',
        'Set a lure and watch who comes to check it.',
      ],
      twists: [
        'Discover that {complication}.',
        "The client's story falls apart under one question.",
        'A second body, arranged like an answer.',
        'The trail bends toward someone the party trusts.',
      ],
      climaxes: [
        'Lay out the proof where the guilty cannot look away.',
        'Confront {mark} with the one fact they cannot explain.',
        'Force the confession before the evidence disappears again.',
        'Name the name aloud, in the room where it matters.',
      ],
      closings: [
        'Decide who gets the truth — the client, the law, or no one.',
        'Watch the consequences arrive on schedule.',
        'Collect the fee and burn the notes, or keep them.',
        'Close the file, knowing which questions stayed open.',
      ],
      questTypes: ['Investigation', 'Mystery', 'Main quest', 'Side quest'],
    },
  },
  {
    id: 'delivery',
    keywords: ['deliver', 'delivery', 'courier', 'package', 'message', 'letter', 'cargo', 'carry', 'parcel'],
    themes: 'any',
    lexicon: {
      verbs: ['carry', 'run', 'smuggle', 'post', 'ferry', 'courier', 'convey', 'outride'],
      nouns: ['parcel', 'letter', 'seal', 'satchel', 'manifest', 'road', 'consignment', 'errand'],
      adjectives: ['sealed', 'urgent', 'unmarked', 'fragile', 'overdue', 'contraband', 'unquestioned'],
      prizes: ['a letter sealed three times over', 'a parcel that is warm to the touch', 'medicine that will not keep', 'a box the sender wept to part with', 'documents worth a border war', 'an heirloom going home after fifty years', 'a package the last three couriers failed to deliver', 'something small, heavy, and never to be opened'],
      marks: ['customs men with a description', 'a rival courier paid to arrive first', 'highwaymen who know the schedule', 'whoever keeps intercepting the mail', "the sender's enemies, patient at every gate", 'a recipient who may not want it after all', 'weather with a grudge', 'inspectors who ask one question too many'],
      venues: ['the long road with no honest inns', 'a checkpoint at every bridge', 'the pass where the last courier vanished', 'a city under curfew at both ends', 'the ferry crossing that runs once a week', 'backcountry where maps politely give up', "a border drawn in fresher ink than the map's", 'streets that rearrange themselves after dark'],
      complications: ['the seal must remain unbroken, no matter what', 'the recipient has moved and left no address', 'the parcel is being tracked somehow', 'the deadline was closer than the sender said', 'the cargo is not what the manifest claims', 'someone offers triple to deliver it elsewhere', 'the package makes sounds at night', 'the sender is dead by the second day'],
      rewards: ["payment on the recipient's signature, plus silence", "a courier's reputation that opens gates", "the sender's considerable gratitude", 'standing work at twice the rate', 'a look inside, if curiosity wins', 'a favor redeemable anywhere on the route'],
      hooks: [
        '{prize} must reach {place} by the appointed day — through {venue}.',
        'Simple work: carry {prize}, ask nothing, open nothing. Except {complication}.',
        'The pay is too good for an honest errand, and the parcel is {prize}.',
        'Every courier before has failed. The sender is down to hiring strangers.',
      ],
      goals: [
        'put {prize} in the right hands, sealed and on time',
        'carry {prize} through {venue} without opening it or losing it',
        'deliver {prize} and walk away without questions',
      ],
      openings: [
        'Take the commission and memorize the terms — all of them.',
        'Study the route: {venue}, and the parts nobody mentions.',
        'Secure {prize} against weather, thieves, and curiosity.',
        'Leave quietly, before the wrong people learn a courier was hired.',
      ],
      middles: [
        'Pass the first checkpoint with papers that almost match.',
        'Outpace the rival who left half a day earlier.',
        'Trade horses, boats, or names at the halfway house.',
        'Resist the urge to look inside — again.',
        'Detour around {venue} when the road proves watched.',
        'Talk the way past inspectors at the bridge.',
        'Guard the parcel through a night that feels arranged.',
      ],
      twists: [
        'Discover that {complication}.',
        'The recipient is not where — or who — the contract said.',
        'Someone offers to buy the cargo: no questions, triple the fee.',
        'The pursuers are not after the courier. They are after {prize}.',
      ],
      climaxes: [
        'Make the final leg with {mark} closing behind.',
        'Reach the recipient before the appointed hour runs out.',
        'Choose: the contract as written, or what now seems right.',
        'Hand over {prize} and watch the seal finally break.',
      ],
      closings: [
        'Take the signature, the payment, and the hint to forget.',
        'Learn — or refuse to learn — what was carried.',
        'Leave town ahead of the consequences of a job well done.',
        'Add the route to the private map of roads never to take again.',
      ],
      questTypes: ['Task', 'Side quest', 'Promise'],
    },
  },
  {
    id: 'revenge',
    keywords: ['revenge', 'vengeance', 'betrayal', 'vendetta', 'grudge', 'wrong', 'justice', 'reckoning', 'betrayer'],
    themes: 'any',
    lexicon: {
      verbs: ['repay', 'ruin', 'hunt', 'settle', 'answer', 'unmake', 'confront', 'reckon'],
      nouns: ['debt', 'grudge', 'reckoning', 'oath', 'scar', 'vendetta', 'account', 'ashes'],
      adjectives: ['old', 'patient', 'cold-served', 'unforgiven', 'slow-burning', 'earned', 'ruinous'],
      prizes: ['the burning of the family holding', 'a betrayal sold for a commission', 'the verdict bought with blood money', 'a partner left for dead at the crossing', "the theft of a life's work", 'an oath broken in front of witnesses', 'the massacre everyone agreed to forget', 'a name ruined with three whispers'],
      marks: ['the old partner, now respectable', 'a magistrate the law cannot touch', 'the captain who gave the order', 'a betrayer who thinks the debt forgotten', 'the family that profited and prospered', 'a killer living quietly under a new name', 'the guild that closed ranks and lied', 'someone protected by everyone who matters'],
      venues: ["the mark's own well-lit halls", 'the city where the wrong was done', 'a reunion the mark cannot decline', 'the courts, if they can be made to work', 'the roads the mark travels each season', "the mark's web of debts and dependents", 'a public stage the mark cannot walk away from', 'the place it happened, rebuilt and renamed'],
      complications: ['the mark knows someone is coming', 'the trail of guilt runs wider than one name', 'an innocent stands squarely in the way', 'the mark has grown genuinely powerful', 'the evidence of the wrong is nearly gone', 'someone else wants the mark dead first — messily', 'the wrong looks different up close', 'the law protects the guilty better than it ever protected the wronged'],
      rewards: ['the account settled, whatever settling costs', 'the truth of the wrong spoken aloud at last', "the mark's ruin, itemized", 'a quiet that may or may not be peace', 'the wronged dead given their due', 'a lesson the powerful will retell nervously'],
      hooks: [
        '{prize} went unanswered for years. The reckoning starts now.',
        '{mark} believes the debt is buried. It has only been gathering interest.',
        'The law had its chance at {mark}. This is what comes after the law.',
        'Someone remembers {prize} — and has finally found {mark}.',
      ],
      goals: [
        'make {mark} answer for {prize}',
        'bring the reckoning to {mark} on terms they cannot buy out of',
        'settle the account for {prize} — publicly, completely, and once',
      ],
      openings: [
        'Say the grievance aloud once, then begin.',
        'Find where {mark} lives now, and how well they sleep.',
        'Gather proof of {prize} while proof still exists.',
        'Decide what "settled" means — and what it must not cost.',
      ],
      middles: [
        "Strip away the mark's first layer of protection.",
        "Turn one of the mark's own people.",
        "Learn the mark's routines, debts, and weaknesses.",
        'Take from {mark} what they took: piece by piece.',
        'Resist the shortcut that would make the avenger the villain.',
        "Survive the mark's answer when they realize the game.",
        'Follow the guilt upward to whoever gave the order.',
      ],
      twists: [
        'Discover that {complication}.',
        'The mark offers restitution — generous, sincere, and insufficient.',
        'An ally counsels mercy at the worst possible moment.',
        'The wrong had a second author no one suspected.',
      ],
      climaxes: [
        'Confront {mark} where no protection reaches.',
        'Put the proof of {prize} before the world.',
        'Offer the mark the choice they never offered.',
        'End it — with steel, with ruin, or with the truth.',
      ],
      closings: [
        'Stand in the quiet after, and take its measure.',
        "Pay what the reckoning cost and call it fair, or don't.",
        'Tell the ones who were wronged that it is done.',
        'Walk away before vengeance asks for an encore.',
      ],
      questTypes: ['Character goal', 'Arc', 'Unresolved thread', 'Main quest'],
    },
  },
  {
    id: 'siege',
    keywords: ['siege', 'defend', 'defense', 'hold', 'fortress', 'walls', 'garrison', 'stand', 'assault'],
    themes: ['high-fantasy', 'grimdark', 'mythic', 'science-fiction'],
    lexicon: {
      verbs: ['hold', 'fortify', 'man', 'repel', 'garrison', 'withstand', 'rally', 'outlast'],
      nouns: ['wall', 'gate', 'garrison', 'breach', 'watch', 'rampart', 'stand', 'signal-fire'],
      adjectives: ['last', 'unbroken', 'outnumbered', 'starving', 'stubborn', 'sleepless', 'desperate'],
      prizes: ['the last bridge over the river', 'a town that refused to kneel', 'the granary that feeds three valleys', 'a shrine the enemy means to erase', 'the pass that keeps the war out', 'a keep held by too few and too young', 'the harbor and everyone who fled to it', 'the archive that must not burn'],
      marks: ['a host that darkens the far ridge', 'raiders who have burned every holdout so far', 'an enemy commander famous for patience', 'sappers already under the walls', 'a fleet standing off the harbor mouth', 'mercenaries paid by the day — and in no hurry', 'an army with engines the walls were never built for', 'traitors inside the gates, counting the stores'],
      venues: ['walls raised for a smaller war', 'a gatehouse with a cracked hinge', 'ramparts patched with cart-beds and pews', 'a cistern that will decide everything', 'the narrow field before the gate', 'towers manned by farmers and oaths', 'the postern everyone pretends not to know about', "a perimeter one night's work too long"],
      complications: ['relief is ten days out and the food is six', 'the well has begun to fail', 'plague travels faster than the enemy', 'someone inside is signaling the besiegers', 'the walls have a flaw only the enemy seems to know', 'the commander is losing the garrison', 'a storm is coming that favors the attackers', 'the enemy offers terms that half the town wants'],
      rewards: ['the ground held, and the name it earns', 'the gratitude of everyone behind the walls', "the enemy's timetable, wrecked", 'a legend measured in days withstood', "the relief force's arrival — to something worth relieving", 'peace bought at a price the walls will remember'],
      hooks: [
        '{mark} have come for {prize}, and the defenses are {venue}.',
        'Hold {prize} until relief comes — if relief comes. Meanwhile, {complication}.',
        'The enemy needs the gate open by winter. The defenders need one more week. Someone will be wrong.',
        'Everyone able has fled or taken up a spear. What remains is {prize}, and the will to keep it.',
      ],
      goals: [
        'hold {prize} until the relief arrives',
        'keep {mark} outside the walls, whatever it takes',
        'make the siege cost more than {prize} is worth to the enemy',
      ],
      openings: [
        'Survey the defenses and count what is actually there.',
        'Ration the stores and post the first true watch.',
        'Send riders for relief before the ring closes.',
        'Arm everyone who can stand, and assign the walls.',
      ],
      middles: [
        'Repel the probing attack that tests the gate.',
        "Repair the breach by torchlight before dawn's assault.",
        'Root out the one signaling from inside the walls.',
        'Raid the siege lines to burn the engines.',
        'Hold the wall through the long assault.',
        'Keep order as the rations thin and tempers fray.',
        'Guard the cistern — the enemy knows about the water.',
      ],
      twists: [
        'Discover that {complication}.',
        'The enemy sends an envoy with terms — and a threat folded inside them.',
        'The relief force is not coming. Something else might be.',
        'The postern gate opens in the night — from the inside.',
      ],
      climaxes: [
        'Meet the great assault at the breach.',
        'Hold the gate for the one hour that decides the siege.',
        "Lead the sortie that breaks the enemy's will — or the defenders'.",
        'Stand the walls as the engines find their range.',
      ],
      closings: [
        'Count the standing, mourn the rest, and rebuild the gate.',
        'Watch the enemy strike camp, and not believe it for a day.',
        'Greet the relief with the flag still flying.',
        "Bury the traitor's name with the traitor.",
      ],
      questTypes: ['Main quest', 'Faction objective', 'Challenge'],
    },
  },
  {
    id: 'pilgrimage',
    keywords: ['pilgrimage', 'journey', 'shrine', 'sacred', 'vow', 'holy', 'temple', 'relic', 'wander'],
    themes: ['high-fantasy', 'mythic', 'grimdark'],
    lexicon: {
      verbs: ['walk', 'seek', 'atone', 'ascend', 'vow', 'wander', 'kneel', 'arrive'],
      nouns: ['shrine', 'vow', 'relic', 'road', 'candle', 'offering', 'threshold', 'blessing'],
      adjectives: ['sacred', 'penitent', 'far', 'barefoot', 'forgotten', 'unmapped', 'weathered'],
      prizes: ["the shrine at the world's worn edge", 'a blessing that is only given once', 'absolution for a sin that has a name', 'the answer the oracles keep for those who walk', 'a relic that must be returned, not kept', 'the grave of the founder, lost to maps', 'healing that no nearer altar grants', "the vow's end, wherever the road puts it"],
      marks: ['a road that tests before it teaches', 'bandits who prey on the faithful', 'a rival pilgrim with darker intent', 'the doubt that walks a half-step behind', 'guardians who admit only the worthy', 'weather sent, the faithful say, on purpose', 'a toll at every holy threshold', "the pilgrim's own past, keeping pace"],
      venues: ['the waymarked road of seven shrines', 'a desert that burns the unready', 'mountain stairs cut by forgotten hands', 'the drowned causeway, passable at low tide', 'a forest where the path shows itself only to some', 'the last stretch that must be walked alone', 'a river crossed by ferrymen who take strange fares', 'ruins where the old faith still keeps hours'],
      complications: ['the shrine may no longer stand', 'the vow forbids the easiest road', "a companion's faith is failing", 'the pilgrimage has a deadline written in stars', 'the offering was stolen at the second waypoint', 'the faith itself is outlawed where the road leads', 'what waits at the end is not what was promised', 'the pilgrim is being followed by someone patient'],
      rewards: ['the blessing, or the truth about blessings', 'a vow fulfilled and a weight set down', 'welcome among the faithful anywhere', "the relic home, and the road's long lesson", 'peace — the kind that has to be walked to', 'a story that will outlive the walker'],
      hooks: [
        'The vow was spoken; now it must be walked — all the way to {prize}.',
        '{prize} lies beyond {venue}, and the road accepts no shortcuts.',
        'Pilgrims set out for {prize} every year. Fewer arrive. This year matters more.',
        'Atonement, the old rite says, is measured in miles. The debt is {prize}.',
      ],
      goals: [
        'reach {prize} with the vow unbroken',
        'walk the road to {prize} and be changed by the walking',
        'carry the offering to {prize} through {venue}',
      ],
      openings: [
        'Speak the vow before witnesses and take the first step.',
        'Prepare the offering and learn the rites of the road.',
        "Join the pilgrim band leaving at the season's turn.",
        'Study the old itineraries — and the newer warnings.',
      ],
      middles: [
        'Pass the first waymark and leave the proper token.',
        'Cross {venue} as the rite demands.',
        'Aid a fellow pilgrim the road has broken.',
        'Keep the vow when keeping it costs most.',
        'Face {mark} without abandoning the path.',
        'Earn passage at a threshold that tests the worthy.',
        'Endure the stretch where the road gives nothing back.',
      ],
      twists: [
        'Discover that {complication}.',
        'A companion reveals why they truly walk.',
        "The shrine's guardians set a trial no itinerary mentioned.",
        'The road offers an ending early — the wrong one.',
      ],
      climaxes: [
        'Walk the last stretch alone, as the rite requires.',
        'Stand at {prize} and make the offering.',
        "Face what actually waits at the road's end.",
        'Choose between the vow and what the vow was for.',
      ],
      closings: [
        'Receive what the shrine gives — which is never quite what was asked.',
        'Set down the burden carried all this way.',
        'Turn homeward, counting what the road kept as its fee.',
        'Record the pilgrimage so the next walker knows the way.',
      ],
      questTypes: ['Arc', 'Character goal', 'Main quest', 'Promise'],
    },
  },
];

/** `{token}` → lexicon slot; `{place}` resolves through the theme's
 * place-name grammar so quests point at plausible map locations. */
const SLOT_OF: Record<string, string> = {
  prize: 'prizes',
  mark: 'marks',
  venue: 'venues',
  complication: 'complications',
  reward: 'rewards',
  noun: 'nouns',
  verb: 'verbs',
  adjective: 'adjectives',
};

function pickSlot(rng: Rng, arch: Archetype, slot: string): string {
  const pool = arch.lexicon[slot];
  return pool?.length ? rng.pick(pool) : '';
}

/** Fill a template's {token} markers from the archetype's pools. Each
 * token rolls independently, so one template yields many sentences. */
function fill(rng: Rng, arch: Archetype, theme: ThemeId, template: string): string {
  return template.replace(/\{(\w+)\}/g, (_m, token: string) =>
    token === 'place' ? placeName(rng, theme) : pickSlot(rng, arch, SLOT_OF[token] ?? token)
  );
}

/** Evocative quest titles: "The Gilded Ledger", "A Reckoning for Duskmere". */
export function questTitleFor(rng: Rng, arch: Archetype, theme: ThemeId): string {
  const verb = pickSlot(rng, arch, 'verbs');
  const noun = pickSlot(rng, arch, 'nouns');
  const adjective = pickSlot(rng, arch, 'adjectives');
  const forms = [
    () => `The ${cap(adjective)} ${cap(noun)}`,
    () => `The ${cap(noun)} of ${placeName(rng, theme)}`,
    () => `${cap(verb)} the ${cap(noun)}`,
    () => `A ${cap(noun)} for ${placeName(rng, theme)}`,
    () => `The ${cap(noun)} and the ${cap(pickSlot(rng, arch, 'nouns'))}`,
  ];
  return rng.pick(forms)();
}

/** 4-7 pending StepRows: opening → 1-3 middles → optional twist →
 * climax → closing, all drawn from one archetype so the beats cohere. */
function buildSteps(rng: Rng, arch: Archetype, theme: ThemeId): { text: string; status: 'pending' }[] {
  const middlePool = arch.lexicon.middles ?? [];
  const texts = [
    pickSlot(rng, arch, 'openings'),
    ...rng.shuffle(middlePool).slice(0, rng.int(1, 3)),
    ...(rng.chance(0.45) ? [pickSlot(rng, arch, 'twists')] : []),
    pickSlot(rng, arch, 'climaxes'),
    pickSlot(rng, arch, 'closings'),
  ];
  return texts.map((t) => ({ text: cap(fill(rng, arch, theme, t)), status: 'pending' as const }));
}

/** Link helpers: quests point at entities the project already knows.
 * Refs use the KnownEntity's real id, so accept wires edges correctly. */
function refTo(k: GenCtx['known'][number]): { id: string; type: string; name: string } {
  return { id: k.id, type: k.type, name: k.name };
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
    .shuffle(candidates)
    .slice(0, rng.int(1, Math.min(max, candidates.length)))
    .map(refTo);
}

/** One fully-fielded quest. `name` lets questline generators pre-title. */
export function generateQuestDraft(
  rng: Rng,
  arch: Archetype,
  ctx: GenCtx,
  opts: { name?: string } = {}
): BundleEntityDraft {
  const theme = ctx.theme;
  const f = (template: string) => fill(rng, arch, theme, template);
  const name = opts.name ?? questTitleFor(rng, arch, theme);

  // Pills come straight from the config's option strings: per-archetype
  // questTypes, and a status skewed toward threads still worth playing.
  const questType = pickSlot(rng, arch, 'questTypes');
  const status = rng.weightedPick([
    { value: 'Not started', weight: 4 },
    { value: 'Active', weight: 4 },
    { value: 'Hidden', weight: 1 },
    { value: 'Future', weight: 1 },
  ]).value;

  const summary = cap(f(rng.pick(arch.lexicon.hooks ?? [''])));
  const goal = `${cap(f(rng.pick(arch.lexicon.goals ?? [''])))}.`;
  const steps = buildSteps(rng, arch, theme);

  const branchForms = [
    () => f('The quiet way: avoid {mark} entirely, and forfeit {reward}.'),
    () => f('The loud way: go through {mark} and let all of {place} hear about it.'),
    () => f('If {complication}, the plan bends — or breaks.'),
    () => f('A rival party wants {prize} too: race them, or deal them in.'),
    () => f('Walk away now, and live with what {mark} do next.'),
  ];
  const branches = rng
    .shuffle(branchForms)
    .slice(0, rng.int(1, 3))
    .map((form) => cap(form()));

  const conditionForms = [
    () => f('It all unravels the moment {mark} learn who is asking.'),
    () => f('The way through {venue} must be learned, bought, or guessed.'),
    () => f('{prize} must still be within reach when the party moves.'),
    () => f('The party must move before {mark} do.'),
  ];
  const conditions = rng.chance(0.65)
    ? rng.shuffle(conditionForms).slice(0, rng.int(1, 2)).map((form) => cap(form()))
    : [];

  const outcomeForms = [
    () => f('Success — {reward}, and {mark} left to remember it.'),
    () => f('Failure — {prize} is lost, and doors close all over {place}.'),
    () => f('A costly draw — the job done, but {complication}.'),
    () => f('The twist — {complication}, and the quest becomes something else entirely.'),
  ];
  const outcomes = rng
    .shuffle(outcomeForms)
    .slice(0, rng.int(2, 3))
    .map((form) => cap(form()));

  const rewards = cap(
    f(
      rng.pick([
        '{reward}. Failure leaves {mark} stronger, and the party remembered.',
        '{reward} — paid only in full, and only on completion.',
        '{reward}. And whatever can be learned inside {venue} along the way.',
        '{reward}, though half the worth is in who finds out it was done.',
      ])
    )
  );

  const notes = rng.chance(0.45)
    ? cap(
        f(
          rng.pick([
            'If the party stalls, {mark} move first.',
            'Pressure valve: reveal that {complication} at the midpoint.',
            'The hook lands hardest through whoever cares most about {prize}.',
          ])
        )
      )
    : undefined;

  const owner = relatedRef(rng, ctx, 'cast', 0.6);
  const participants = relatedRefs(rng, ctx, 'cast', 3, 0.5, owner?.id);
  const factions = relatedRefs(rng, ctx, 'factions', 2, 0.4);
  const locations = relatedRefs(rng, ctx, 'locations', 2, 0.55);
  const items = relatedRefs(rng, ctx, 'items', 2, 0.35);
  const relatedEvents = relatedRefs(rng, ctx, 'events', 2, 0.3);

  return {
    localId: newId(),
    type: 'quests',
    name,
    aliases: [],
    summary,
    tags: [arch.id, pickSlot(rng, arch, 'adjectives')],
    fields: {
      questType,
      status,
      goal,
      steps,
      branches,
      ...(conditions.length ? { conditions } : {}),
      outcomes,
      rewards,
      ...(notes ? { notes } : {}),
      ...(owner ? { owner } : {}),
      ...(participants ? { participants } : {}),
      ...(factions ? { factions } : {}),
      ...(locations ? { locations } : {}),
      ...(items ? { items } : {}),
      ...(relatedEvents ? { relatedEvents } : {}),
    },
  };
}

export const questsPack: TypePack = {
  type: 'quests',
  archetypes: ARCHETYPES,
  generate: (rng, arch, ctx) => generateQuestDraft(rng, arch, ctx),
};
