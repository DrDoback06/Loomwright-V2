import type { PromptKind, PromptTemplate } from '@/db/types';
import { CHAT_MODES, chatSystemPrompt } from '@/services/ai/prompts/chat';
import { BEAT_SYSTEM } from '@/services/ai/prompts/beat';
import { REWRITE_SYSTEM } from '@/services/ai/prompts/rewrite';

export type BuiltinPrompt = Pick<
  PromptTemplate,
  'slug' | 'name' | 'kind' | 'system' | 'body' | 'inputs'
>;

/** What each kind can reach, rendered under the editor. A variable list
 * nobody can see is a template language nobody will use. */
export const KIND_TOKENS: Record<PromptKind, string[]> = {
  'chat-brainstorm': ['{context}', '{storySoFar()}', '{codex.all}', '{codex.cast()}', '{input("x")}'],
  'chat-ask-the-codex': ['{context}', '{codex.all}', '{codex.get("Vex")}', '{input("x")}'],
  'chat-editor': ['{context}', '{scene.summary}', '{storySoFar()}', '{input("x")}'],
  'chat-continuity': ['{context}', '{storySoFar()}', '{codex.all}', '{input("x")}'],
  'chat-free': ['{context}', '{storySoFar()}', '{codex.all}', '{input("x")}'],
  beat: [
    '{beat}',
    '{targetWords}',
    '{scene.title}',
    '{scene.summary}',
    '{scene.pov}',
    '{scene.labels}',
    '{precedingProse}',
    '{context}',
    '{storySoFar()}',
    '{storyToCome()}',
    '{codex.cast()}',
    '{input("x")}',
  ],
  rewrite: [
    '{selection}',
    '{scene.title}',
    '{scene.summary}',
    '{scene.pov}',
    '{precedingProse}',
    '{context}',
    '{storySoFar()}',
    '{input("x")}',
  ],
};

export const KIND_LABELS: Record<PromptKind, string> = {
  'chat-brainstorm': 'Chat — Brainstorm',
  'chat-ask-the-codex': 'Chat — Ask the codex',
  'chat-editor': 'Chat — Editor',
  'chat-continuity': 'Chat — Continuity',
  'chat-free': 'Chat — Free',
  beat: 'Scene beat',
  rewrite: 'Rewrite a selection',
};

/**
 * The shipped set, generated from the prompts the app already sends.
 *
 * Seeded from `services/ai/prompts/` rather than written fresh, so the
 * library ships full: editing one is a fork of something that works, not a
 * blank page. Every builtin here is genuinely read by a code path — a
 * seeded template nothing consults would be a rendered control that does
 * nothing, dressed up as a feature.
 */
export function builtinPrompts(): BuiltinPrompt[] {
  const chat: BuiltinPrompt[] = CHAT_MODES.map((mode) => ({
    slug: `chat-${mode.id}`,
    name: `Chat — ${mode.label}`,
    kind: `chat-${mode.id}` as PromptKind,
    system: chatSystemPrompt(mode.id),
    body: '',
    inputs: [],
  }));

  return [
    ...chat,
    {
      slug: 'beat',
      name: 'Scene beat',
      kind: 'beat',
      system: BEAT_SYSTEM,
      body: '',
      inputs: [],
    },
    {
      slug: 'rewrite',
      name: 'Rewrite a selection',
      kind: 'rewrite',
      system: REWRITE_SYSTEM,
      body: '',
      inputs: [],
    },
  ];
}
