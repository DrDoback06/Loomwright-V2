/** NER lexicon ported verbatim from the legacy engine. */

export const NER_STOPWORDS = new Set([
  'the','a','an','and','but','or','nor','so','yet','for','as','at','by','in','on','to','of','off','up','out',
  'if','then','now','when','where','why','how','what','who','whom','whose','which','that','this','these','those',
  'he','she','it','they','we','you','i','me','him','her','them','us','his','hers','its','their','our','my','your',
  'mine','yours','theirs','here','there','yes','no','not','never','always','once','twice','still','just','only',
  'even','also','too','very','quite','rather','perhaps','maybe','indeed','however','therefore','thus','hence',
  'meanwhile','suddenly','finally','soon','later','after','before','while','until','since','because','although',
  'though','unless','whether','despite','during','within','without','across','behind','beyond','beneath','above',
  'below','between','among','around','through','toward','towards','upon','into','onto','from','with','about',
  'against','along','amid','everything','nothing','someone','anyone','everyone','nobody','something','another',
  'chapter','part','prologue','epilogue','monday','tuesday','wednesday','thursday','friday','saturday','sunday',
  'january','february','march','april','may','june','july','august','september','october','november','december',
  'oh','ah','well','okay','hey','please','thanks','thank','again','eventually',
]);

export const NER_CONNECTORS = new Set(['of', 'the', 'de', 'von', 'van', 'al', 'da', 'di', 'del', 'la', 'le']);

export const NER_HONORIFIC_SRC =
  'Lord|Lady|Ser|Sir|Dame|King|Queen|Prince|Princess|Captain|Commander|Lieutenant|Colonel|Major|Sergeant|Master|Mistress|Maester|Archon|General|Admiral|Doctor|Dr|Professor|Mr|Mrs|Ms|Miss|Father|Brother|Sister|Aunt|Uncle|Saint|St|Emperor|Empress|Duke|Duchess|Baron|Baroness|Count|Countess';

export const NER_HONORIFIC_LEAD = new RegExp(`^(?:${NER_HONORIFIC_SRC})\\.?\\s+`);
export const NER_HONORIFICS_BEFORE = new RegExp(`(?:^|\\b)(?:${NER_HONORIFIC_SRC})\\.?\\s+$`);

const NER_DIALOGUE_VERBS =
  'said|asked|replied|whispered|shouted|murmured|cried|answered|muttered|growled|hissed|breathed|snapped|wondered|added|continued|exclaimed|declared|warned';
export const NER_DIALOGUE_AFTER = new RegExp(`^[,"'”’\\s]*\\b(?:${NER_DIALOGUE_VERBS})\\b`, 'i');
export const NER_DIALOGUE_BEFORE = new RegExp(`\\b(?:${NER_DIALOGUE_VERBS})\\s+$`, 'i');

const NER_LOC_KINDS =
  'city|keep|village|town|castle|fortress|hold|port|harbour|harbor|isle|island|river|mountain|mountains|forest|gate|tower|temple|inn|tavern|kingdom|realm|land|lands|valley|peak|pass|road|sea|ocean|lake|hall|palace|citadel|abbey|monastery|province|county|shire|domain|territory|wastes|plains|desert|swamp|marsh|moor|caverns|caves|ruins|district|quarter';
export const NER_LOC_OF_BEFORE = new RegExp(`\\b(?:${NER_LOC_KINDS})\\s+of\\s+$`, 'i');
export const NER_LOC_HEADNOUN_AFTER =
  /^\s+(?:Keep|Castle|Tower|Gate|Hold|Fortress|Citadel|Palace|Temple|Bridge|Pass|Peak|Vale|Wood|Woods|Forest|Marsh|Moor|Hall|Inn|Tavern|City|Town|Village|Harbour|Harbor|Port|Isle|Island|Mountains?|River|Lake|Sea|Plains|Desert|Wastes|Ruins)\b/;
export const NER_LOC_PREP_BEFORE =
  /\b(?:to|at|from|toward|towards|into|near|beyond|through|across|past|reached|entered|left|arrived\s+at|returned\s+to)\s+$/i;

export const NER_ITEM_DET_BEFORE = /\b(?:the|a|an|his|her|their|its|my|your|our)\s+$/i;
export const NER_ITEM_VERB_BEFORE =
  /\b(?:called|named|wielded|carried|drew|sheathed|forged|enchanted|found|holding|held|equipped|gripped|raised)\s+$/i;
export const NER_ITEM_NOUN_END =
  /(?:sword|blade|dagger|knife|axe|bow|spear|lance|mace|hammer|flail|club|whip|ring|amulet|crown|circlet|cloak|robe|staff|wand|rod|sceptre|scepter|shield|tome|grimoire|chalice|goblet|orb|gauntlets?|helm|helmet|pendant|necklace|locket|relic|key|crystal|gem|jewel|stone|elixir|potion|scroll|banner|horn|bell|mirror|talisman|charm|armour|armor|plate|mail|boots|gloves|belt|brooch)$/i;
export const NER_SKILL_BEFORE =
  /\b(?:skill|spell|ability|technique|power|talent|art|incantation|maneuver|manoeuvre)\s+(?:(?:called|named|known\s+as)\s+)?$/i;

export const NER_HONORIFICS_STRIP =
  /^(?:captain|lord|lady|sir|dame|king|queen|prince|princess|master|mistress|doctor|dr|general|commander|sergeant|brother|sister|father|mother|elder|the)\s+/i;

export function stripHonorific(s: string): string {
  return (s ?? '').replace(NER_HONORIFICS_STRIP, '').trim();
}
