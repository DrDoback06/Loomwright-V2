import {
  negativeExample,
  omissionRule,
  outputContract,
  tailReminder,
  workedExample,
  type ModelTier,
} from './index';

/**
 * The mega-prompt: what CHANGED in this passage, plus what it opens up.
 *
 * This is the one that carries the world digest, and it is the one an author
 * runs through their own ChatGPT or Claude subscription rather than paying
 * twice. It asks for facts in the exact shape the offline propagation rules
 * already consume, which is what lets every external claim be verified against
 * the same engine instead of trusted.
 */

const EXAMPLE_INPUT =
  'Marrow pressed the Saltbrand into Vex\'s hands at the Ashen Ford gate and turned away without another word.';

const EXAMPLE_OUTPUT = JSON.stringify(
  {
    facts: [
      {
        kind: 'item-transfer',
        item: 'Saltbrand',
        from: 'Marrow',
        to: 'Vex',
        quote: 'pressed the Saltbrand into Vex\'s hands',
      },
      {
        kind: 'relationship',
        from: 'Marrow',
        to: 'Vex',
        bond: 'ally',
        quote: 'turned away without another word',
      },
    ],
    suggestions: [
      {
        kind: 'story-arc',
        target: 'Vex',
        title: 'The debt Marrow never named',
        body: 'Vex carries a blade she did not earn; Marrow returns in a later chapter to say what it cost.',
      },
    ],
  },
  null,
  0
);

const FACT_KINDS = [
  '{ "kind": "item-transfer", "item": NAME, "from": NAME, "to": NAME, "quote": "…" }',
  '{ "kind": "item-loss", "item": NAME, "destroyed": true|false, "quote": "…" }',
  '{ "kind": "travel", "character": NAME, "place": NAME, "parent": REGION|null, "quote": "…" }',
  '{ "kind": "skill-learned", "character": NAME, "skill": NAME, "quote": "…" }',
  '{ "kind": "relationship", "from": NAME, "to": NAME, "bond": BOND, "quote": "…" }',
];

const SUGGESTION_KINDS =
  'skill-sibling | skill-next-tier | quest-outcome | story-arc | relationship | item-synergy | cast-candidate';

/**
 * Build the mega-prompt.
 *
 * A small model gets fewer fact kinds to watch for and fewer suggestions to
 * produce, because asking one for everything at once reliably produces a
 * little of each and none of it well.
 */
export function buildDeltaPrompt(
  digest: string,
  manuscript: string,
  options: { tier?: ModelTier; suggestions?: boolean } = {}
): string {
  const tier = options.tier ?? 'large';
  const wantSuggestions = options.suggestions ?? true;
  // Transfers, travel and learning are the three the propagation rules act on
  // most confidently — a small model should spend its whole attention there.
  const kinds = tier === 'small' ? FACT_KINDS.slice(0, 4) : FACT_KINDS;

  const sections = [
    'You are helping an author keep a story bible in sync with their manuscript.',
    'You are given a digest of everything already recorded, then a new passage.',
    'Report what the passage CHANGED about the recorded world — not what it merely mentions.',
    '',
    outputContract(),
    '',
    'The object has exactly two keys:',
    '{',
    '  "facts": [ … ],',
    `  "suggestions": [ ${wantSuggestions ? '…' : ''} ]`,
    '}',
    '',
    'Each entry in "facts" is exactly one of these shapes:',
    ...kinds.map((line) => `  ${line}`),
    '',
    'RULES FOR FACTS:',
    '- NAME must be spelled exactly as the digest spells it when the thing already exists.',
    '- "quote" is a short verbatim span copied from the passage. Never paraphrase it.',
    '- A fact needs a quote that proves it. No quote, no fact.',
    '- "bond" is one of: ally, enemy, lover, rival, mentor, family, debt, oath.',
    '- Report a change once. Two sentences about the same handover is one fact.',
  ];

  if (wantSuggestions) {
    sections.push(
      '',
      'RULES FOR SUGGESTIONS:',
      `- "kind" is one of: ${SUGGESTION_KINDS}.`,
      '- Each is a FINISHED card the author can accept as-is: a title and one concrete sentence.',
      '- Never a question. "What if Vex returns?" is useless. "Vex returns to Ashen Ford to give the blade back" is a card.',
      `- Give at most ${tier === 'small' ? 2 : 4}. Fewer good ones beat a list.`,
      '- A suggestion is allowed to be invention. A fact is not.'
    );
  } else {
    sections.push('', 'Leave "suggestions" as an empty array for this request.');
  }

  sections.push(
    '',
    omissionRule(),
    '',
    workedExample(EXAMPLE_INPUT, EXAMPLE_OUTPUT),
    '',
    negativeExample(),
    '',
    digest,
    '',
    '# New manuscript text',
    manuscript,
    '',
    tailReminder()
  );

  return sections.join('\n');
}
