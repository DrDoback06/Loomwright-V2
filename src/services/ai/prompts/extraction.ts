import {
  negativeExample,
  omissionRule,
  outputContract,
  tailReminder,
  workedExample,
  type ModelTier,
} from './index';

/**
 * The entity-extraction prompt, for both AI paths that use it: the in-app deep
 * pass and the copy-to-your-own-AI handoff pack.
 *
 * What it replaces was fifteen lines: a shape sketch made of empty strings,
 * one instruction ("be conservative"), and no examples at all. A frontier
 * model fills that in from taste. A small one returns four characters named
 * "" because the schema showed empty strings and nothing said not to.
 */

export interface KnownNameBlock {
  type: string;
  names: string[];
}

const EXAMPLE_INPUT =
  'Marrow handed the Saltbrand to Vex at the Ashen Ford gate. "You will need it more than I do," she said. ' +
  'Vex had learned Venom Strike from the old poisoner that winter, and the blade suited it.';

const EXAMPLE_OUTPUT = JSON.stringify(
  {
    characters: [
      { name: 'Marrow', role: 'gives up the Saltbrand', summary: 'Hands the Saltbrand to Vex at the gate.' },
      { name: 'Vex', traits: ['poisoner-trained'], summary: 'Receives the Saltbrand; learned Venom Strike that winter.' },
    ],
    locations: [{ name: 'Ashen Ford', kind: 'settlement', summary: 'Has a gate where the handover happens.' }],
    items: [{ name: 'Saltbrand', type: 'Weapon', owner: 'Vex', summary: 'A blade passed from Marrow to Vex.' }],
    skills: [{ name: 'Venom Strike', summary: 'Learned by Vex from an old poisoner.' }],
    relationships: [
      { from: 'Marrow', to: 'Vex', type: 'ally', summary: 'Marrow gives Vex a weapon and her blessing.' },
    ],
  },
  null,
  0
);

/** The JSON shape, written with real placeholder guidance instead of "". */
function schemaBlock(tier: ModelTier): string {
  const full = [
    '{',
    '  "characters":    [{"name": "", "role": "", "traits": [], "summary": ""}],',
    '  "locations":     [{"name": "", "kind": "", "summary": ""}],',
    '  "items":         [{"name": "", "type": "", "owner": "", "summary": ""}],',
    '  "skills":        [{"name": "", "summary": ""}],',
    '  "factions":      [{"name": "", "summary": ""}],',
    '  "quests":        [{"name": "", "status": "", "summary": ""}],',
    '  "events":        [{"name": "", "when": "", "summary": ""}],',
    '  "lore":          [{"title": "", "body": ""}],',
    '  "relationships": [{"from": "", "to": "", "type": "", "summary": ""}]',
    '}',
  ].join('\n');

  // A small model asked for nine categories at once returns nine half-filled
  // ones. Narrowing to what actually recurs in prose gets better results than
  // any amount of instruction about thoroughness.
  const lean = [
    '{',
    '  "characters":    [{"name": "", "role": "", "summary": ""}],',
    '  "locations":     [{"name": "", "kind": "", "summary": ""}],',
    '  "items":         [{"name": "", "owner": "", "summary": ""}],',
    '  "skills":        [{"name": "", "summary": ""}],',
    '  "relationships": [{"from": "", "to": "", "type": "", "summary": ""}]',
    '}',
  ].join('\n');

  return tier === 'small' ? lean : full;
}

function fieldGuidance(tier: ModelTier): string {
  const lines = [
    'FIELD GUIDANCE:',
    '- name: exactly as the text writes it. Never a description ("the tall man" is not a name).',
    '- role: what they do in THIS passage, in a few words.',
    '- summary: one sentence, drawn from this passage only.',
    '- owner: who holds the item at the END of the passage.',
    '- type (relationships): one of ally, enemy, rival, lover, family, mentor, debt, oath.',
  ];
  if (tier === 'large') {
    lines.push(
      '- traits: adjectives the text supports, not ones it implies.',
      '- kind: settlement, region, building, landmark, ship, realm…',
      '- type (items): Weapon, Armour, Tool, Relic, Document, Consumable, Other.',
      '- status (quests): not started, active, completed, failed.',
      '- when (events): the passage\'s own time reference ("that winter"), not a date you invent.'
    );
  }
  return lines.join('\n');
}

/**
 * Build the extraction prompt.
 *
 * `knownNames` matters more than it looks: without it a model invents a new
 * spelling for a character it has met four times, and the app files a
 * duplicate. With it, the same name comes back byte-identical and the merge
 * guard does its job.
 */
export function buildExtractionPrompt(
  knownNames: KnownNameBlock[],
  options: { tier?: ModelTier; namesPerType?: number } = {}
): string {
  const tier = options.tier ?? 'large';
  const cap = options.namesPerType ?? (tier === 'small' ? 20 : 60);

  const known = knownNames
    .filter((block) => block.names.length)
    .map((block) => `  ${block.type}: ${block.names.slice(0, cap).join(', ')}`)
    .join('\n');

  const sections = [
    'You are a story-canon extraction system for a worldbuilding app.',
    'You read one passage of a novel and report the people, places, things and bonds it establishes.',
    '',
    outputContract(),
    '',
    'The object has exactly these keys. Omit any key you have nothing for:',
    schemaBlock(tier),
    '',
    fieldGuidance(tier),
    '',
    omissionRule(),
  ];

  if (known) {
    sections.push(
      '',
      'ALREADY IN THE STORY BIBLE — when the passage refers to one of these, use this exact spelling:',
      known
    );
  }

  sections.push('', workedExample(EXAMPLE_INPUT, EXAMPLE_OUTPUT), '', negativeExample(), '', tailReminder());
  return sections.join('\n');
}
