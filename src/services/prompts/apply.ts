import { db } from '@/db/schema';
import { promptFor } from '@/db/repos/prompts';
import type { PromptKind, PromptTemplate } from '@/db/types';
import { ALL_ENTITY_TYPES, type EntityType } from '@/domain/entity-types';
import { isLiveEntity } from '@/services/extraction/entity-to-known';
import { entityDigest } from '@/services/context/scene-context';
import { resolvePrompt, type PromptScope } from './resolve';

/**
 * The codex half of a template scope.
 *
 * Lean digests, and only built when something asks for them — a template
 * that never says `{codex.cast()}` should not pay for reading every entity
 * in the project.
 */
export async function codexScope(projectId: string): Promise<
  Pick<PromptScope, 'codexByType' | 'codexAll' | 'codexByName'>
> {
  const rows = (await db.entities.where('projectId').equals(projectId).toArray()).filter(
    isLiveEntity
  );
  const byType: Partial<Record<EntityType, string>> = {};
  const byName: Record<string, string> = {};
  for (const type of ALL_ENTITY_TYPES) {
    const of = rows.filter((e) => e.type === type);
    byType[type] = of.map((e) => entityDigest(e, 'lean')).join('\n');
  }
  for (const entity of rows) byName[entity.name.toLowerCase()] = entityDigest(entity, 'full');
  return {
    codexByType: byType,
    codexAll: rows.map((e) => entityDigest(e, 'lean')).join('\n'),
    codexByName: byName,
  };
}

export interface BuiltPrompt {
  system: string;
  prompt: string;
}

/**
 * Layer the author's template over the prompt the app built.
 *
 * Two effects, and each is exactly what its field label promises:
 *
 * - a non-empty `system` **replaces** the built-in system message;
 * - a non-empty `body` is **appended** to the prompt as extra instructions.
 *
 * The assembled prompt is not thrown away and replaced by the body. It
 * carries the context engine's output, the canon facts and the author's
 * measured style, and handing someone a blank page that silently drops all
 * three would be a worse prompt with more knobs on it. Anything the body
 * wants from those is reachable through the variables instead.
 *
 * An empty template is therefore a no-op, which is what makes seeding the
 * library safe: installing it changes nothing until somebody edits
 * something.
 */
export function layerTemplate(
  built: BuiltPrompt,
  template: PromptTemplate | null,
  scope: PromptScope
): BuiltPrompt {
  if (!template) return built;
  const system = template.system.trim()
    ? resolvePrompt(template.system, scope).text.trim()
    : built.system;
  const extra = template.body.trim() ? resolvePrompt(template.body, scope).text.trim() : '';
  return {
    system,
    prompt: extra
      ? `${built.prompt}\n\nEXTRA INSTRUCTIONS FROM YOUR TEMPLATE — these override anything above:\n${extra}`
      : built.prompt,
  };
}

/** Fetch and apply in one step, for the call sites that have no reason to
 * hold a template object. */
export async function applyProjectTemplate(
  projectId: string,
  kind: PromptKind,
  built: BuiltPrompt,
  scope: PromptScope
): Promise<BuiltPrompt> {
  return layerTemplate(built, await promptFor(projectId, kind), scope);
}
