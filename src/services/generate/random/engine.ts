import type { EntityType } from '@/domain/entity-types';
import type { KnownEntity } from '@/services/extraction/known-index';
import { newId } from '@/lib/id';
import { entitySpec } from '../spec';
import type { GenerationBundle, GenerationRequest } from '../types';
import { createRng, randomSeed } from './rng';
import { generateDraftFor, resolveTheme } from './packs';
import { rollGenericField } from './packs/generic';

export interface RandomCtx {
  projectId: string;
  known: KnownEntity[];
}

/** Generate a bundle offline from authored content. Deterministic for a
 * given (request, seed) — Reroll passes a fresh seed, tests fix one. */
export function generateRandomBundle(
  request: GenerationRequest,
  ctx: RandomCtx,
  seed = randomSeed()
): GenerationBundle {
  const rng = createRng(seed);
  const theme = resolveTheme(rng, request.theme);
  const genCtx = { theme, hint: request.hint ?? '', known: ctx.known };

  const bundle: GenerationBundle = {
    id: newId(),
    projectId: ctx.projectId,
    request,
    mode: 'random',
    seed,
    entities: [],
    graphs: [],
    chapters: [],
    links: [],
    warnings: [],
    createdAt: Date.now(),
  };

  switch (request.kind) {
    case 'entity': {
      if (request.entityType) {
        bundle.entities.push(generateDraftFor(rng, request.entityType, genCtx));
      }
      break;
    }
    case 'entity-batch': {
      if (request.entityType) {
        const count = Math.max(1, Math.min(request.count ?? 3, 24));
        for (let i = 0; i < count; i++) {
          bundle.entities.push(generateDraftFor(rng, request.entityType, genCtx));
        }
      }
      break;
    }
    default:
      // Compound kinds (skilltree, questline, …) register their builders
      // in their own milestones via generateCompound below.
      break;
  }
  return bundle;
}

/** One field's worth of fresh random content — powers the editor drawer's
 * per-field dice and "Fill empty fields". */
export function rollField(
  type: EntityType,
  fieldId: string,
  ctx: RandomCtx & { theme?: string; hint?: string },
  seed = randomSeed()
): unknown {
  const rng = createRng(seed);
  const theme = resolveTheme(rng, ctx.theme);
  const spec = entitySpec(type);
  const field = spec?.fields.find((f) => f.id === fieldId);
  if (!field) return undefined;
  return rollGenericField(rng, field, { theme, hint: ctx.hint ?? '', known: ctx.known }, { force: true });
}

/** Roll a full draft and return the fields that are empty in `current` —
 * "Fill empty fields" merges these into the open form. */
export function rollEmptyFields(
  type: EntityType,
  current: Record<string, unknown>,
  ctx: RandomCtx & { theme?: string; hint?: string },
  seed = randomSeed()
): Record<string, unknown> {
  const rng = createRng(seed);
  const theme = resolveTheme(rng, ctx.theme);
  const draft = generateDraftFor(rng, type, { theme, hint: ctx.hint ?? '', known: ctx.known });
  const out: Record<string, unknown> = {};
  const isEmpty = (v: unknown) =>
    v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  const spec = entitySpec(type);
  const nameField = spec?.nameField ?? 'name';
  if (isEmpty(current[nameField])) out[nameField] = draft.name;
  if (isEmpty(current.summary)) out.summary = draft.summary;
  if (isEmpty(current.tags)) out.tags = draft.tags;
  for (const [id, value] of Object.entries(draft.fields)) {
    if (isEmpty(current[id])) out[id] = value;
  }
  return out;
}
