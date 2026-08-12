import type { ChatMessage, ChatMode } from '@/db/types';

export const CHAT_MODES: { id: ChatMode; label: string; note: string }[] = [
  { id: 'brainstorm', label: 'Brainstorm', note: 'Options and angles, not prose.' },
  { id: 'ask-the-codex', label: 'Ask the codex', note: 'Answers only from what you have written.' },
  { id: 'editor', label: 'Editor', note: 'Critique of the passage in context.' },
  { id: 'continuity', label: 'Continuity', note: 'Hunts contradictions in what it is shown.' },
  { id: 'free', label: 'Free', note: 'No house rules — just the context.' },
];

/**
 * One system prompt per mode.
 *
 * Every one of them ends in the same place: **do not invent canon.** That
 * is not politeness, it is the thing that makes a reply safe to send to
 * `parseDeltaReply` afterwards — a model that cheerfully names a sister the
 * author never wrote produces a codex entry nobody asked for.
 */
const MODE_SYSTEM: Record<ChatMode, string> = {
  brainstorm: [
    'You are a story consultant for a novelist, talking through their work in progress.',
    'Offer options, angles and consequences. Three or four, briefly, not one long essay.',
    'Do not write prose unless asked. Do not restate what you were told back at them.',
  ].join('\n'),
  'ask-the-codex': [
    'You answer questions about a novelist’s story using ONLY the material below.',
    'If the answer is not in the material, say exactly what is missing rather than guessing.',
    'Quote or name the entry you are drawing on, so the author can check you.',
  ].join('\n'),
  editor: [
    'You are a developmental editor reading a novelist’s draft.',
    'Be specific and concrete: name the sentence, the beat or the choice you mean.',
    'Lead with what is working, then what is not, then one thing to try. No praise padding.',
  ].join('\n'),
  continuity: [
    'You are a continuity checker for a novel.',
    'Compare what the material says against itself and report contradictions, gaps and',
    'facts that changed without explanation. One line each. If you find nothing, say so —',
    'inventing a problem is worse than finding none.',
  ].join('\n'),
  free: 'You are assisting a novelist with their work in progress.',
};

const CANON_RULE =
  'Never invent names, places, objects or events that are not in the material above. If you need something that does not exist yet, say so and describe the shape of it instead of naming it.';

export function chatSystemPrompt(mode: ChatMode): string {
  return `${MODE_SYSTEM[mode]}\n${CANON_RULE}`;
}

export interface ChatPromptInput {
  mode: ChatMode;
  /** The assembled context block — scene digests, story so far, codex
   * entries. Exactly what the chips above the composer say travels. */
  context: string;
  /** Prior turns, already cut to the thread's `memoryPairs`. */
  history: Pick<ChatMessage, 'role' | 'text'>[];
  message: string;
}

/**
 * The whole conversation as one prompt.
 *
 * Rendered as text rather than as a messages array on purpose: the offline
 * path copies this verbatim into whatever chat window the author already
 * pays for, and a prompt that only works through our own API call would
 * make the no-key path a worse product rather than a different one.
 */
export function buildChatPrompt(input: ChatPromptInput): string {
  const parts: string[] = [];
  if (input.context.trim()) {
    parts.push('MATERIAL FROM THE AUTHOR’S STORY:', input.context.trim(), '');
  }
  if (input.history.length) {
    parts.push('THE CONVERSATION SO FAR:');
    for (const turn of input.history) {
      parts.push(`${turn.role === 'user' ? 'Author' : 'You'}: ${turn.text}`);
    }
    parts.push('');
  }
  parts.push('AUTHOR:', input.message.trim());
  return parts.join('\n');
}

/**
 * The last N pairs, oldest first.
 *
 * Cut at a **user** turn, never at a message count. A pair is a question
 * and whatever followed it, so a count-based window will sooner or later
 * open the history with an answer whose question was left behind — and a
 * model reading a reply to something it was never shown will confidently
 * carry the missing premise forward.
 */
export function recentHistory(
  messages: readonly ChatMessage[],
  pairs: number
): Pick<ChatMessage, 'role' | 'text'>[] {
  if (pairs <= 0) return [];
  let seen = 0;
  let start = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue;
    seen += 1;
    start = i;
    if (seen === pairs) break;
  }
  // No question in the thread at all: there is no pair to send.
  if (start === -1) return [];
  return messages.slice(start).map((m) => ({ role: m.role, text: m.text }));
}
