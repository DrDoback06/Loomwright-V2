import type { Entity } from '@/db/types';
import { extractionPrompt, parseJsonObject } from '@/services/ai/ai-candidates';
import { importHandoffResponse } from '@/services/ai/handoff';
import type { KnownEntity } from '@/services/extraction/known-index';
import { saveSuggestions } from '@/db/repos/suggestions';
import { buildWorldDigest, type DigestDepth } from './digest';
import type { SuggestionDraft } from './types';

/** The mega-prompt: a full world digest + a facts-and-suggestions schema for
 * any external AI. Facts reuse the handoff extraction schema (so the reply
 * imports through the existing path); a top-level `suggestions` array carries
 * the forward-looking cards. Names, never ids. */
export function buildMegaPrompt(input: {
  projectName: string;
  entities: Entity[];
  depth: DigestDepth;
}): string {
  const knownNames = (['cast', 'locations', 'items', 'factions'] as const).map((type) => ({
    type,
    names: input.entities.filter((e) => e.type === type).map((e) => e.name),
  }));
  return [
    `# Loomwright mega-prompt — ${input.projectName}`,
    '',
    'Read the chapter (or whole book) I paste at the very end. Return the FACTS the text establishes and forward-looking SUGGESTIONS, as one JSON object.',
    '',
    '## The world so far',
    buildWorldDigest(input.entities, input.depth),
    '',
    '## Facts — extract everything the text shows, using this schema:',
    extractionPrompt(knownNames),
    '',
    '## Suggestions — add a top-level "suggestions" array to the SAME JSON object:',
    JSON.stringify(
      {
        suggestions: [
          {
            kind: 'arc | quest-outcome | skill-sibling',
            title: '<a finished, specific, ready-to-accept idea>',
            detail: '<one or two sentences>',
            about: '<name of the entry it concerns, from the digest>',
          },
        ],
      },
      null,
      2
    ),
    '- Every suggestion must be concrete and ready to accept — a finished card, not an open question.',
    '- Reference existing entries by the NAMES in the digest; invent new ones only when the text introduces them.',
    '',
    '## Paste your chapter or book below this line:',
    '',
  ].join('\n');
}

interface WireSuggestion {
  kind?: unknown;
  title?: unknown;
  detail?: unknown;
  about?: unknown;
}

function parseSuggestionDrafts(reply: string, entities: Entity[]): SuggestionDraft[] {
  const obj = parseJsonObject(reply) as { suggestions?: unknown } | null;
  if (!obj || !Array.isArray(obj.suggestions)) return [];
  const drafts: SuggestionDraft[] = [];
  for (const raw of obj.suggestions as WireSuggestion[]) {
    const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
    if (!title) continue;
    const aboutName = typeof raw.about === 'string' ? raw.about.trim().toLowerCase() : '';
    const about = aboutName ? entities.find((e) => e.name.toLowerCase() === aboutName) : undefined;
    drafts.push({
      targetRef: about ? { id: about.id, type: about.type, name: about.name } : undefined,
      kind: typeof raw.kind === 'string' ? raw.kind : 'idea',
      title,
      detail: typeof raw.detail === 'string' ? raw.detail : undefined,
      source: 'handoff',
      confidence: 0.6,
    });
  }
  return drafts;
}

/** Import a mega-prompt reply: facts → the review queue (reusing the handoff
 * path), suggestions → the per-entity inboxes. */
export async function importMegaResponse(
  projectId: string,
  reply: string,
  known: KnownEntity[],
  entities: Entity[]
): Promise<{ facts: number; suggestions: number } | { error: string }> {
  const factsResult = await importHandoffResponse(projectId, reply, known);
  const facts = 'added' in factsResult ? factsResult.added : 0;
  const saved = await saveSuggestions(projectId, parseSuggestionDrafts(reply, entities));
  if (facts === 0 && saved.length === 0) {
    return 'error' in factsResult
      ? factsResult
      : { error: 'The reply parsed, but no facts or suggestions were found.' };
  }
  return { facts, suggestions: saved.length };
}
