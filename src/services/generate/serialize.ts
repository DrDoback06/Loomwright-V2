import type { Entity } from '@/db/types';
import type { EntityRef } from '@/domain/entity-types';
import { entitySpec, generableFields } from './spec';

function isRef(v: unknown): v is EntityRef {
  return Boolean(v) && typeof v === 'object' && typeof (v as EntityRef).name === 'string' && typeof (v as EntityRef).id === 'string';
}

/** One entity as portable wire JSON: identity + fields, with related refs
 * flattened to names (ids never travel) and images dropped. The output
 * pastes back through the coercion path losslessly. */
export function entityToWireJson(entity: Entity): Record<string, unknown> {
  const spec = entitySpec(entity.type);
  const fields: Record<string, unknown> = {};
  const specById = new Map((spec ? generableFields(spec) : []).map((f) => [f.id, f]));
  for (const [key, value] of Object.entries(entity.fields)) {
    const field = specById.get(key);
    if (!field) continue;
    if (field.kind === 'related') {
      if (isRef(value)) fields[key] = value.name;
    } else if (field.kind === 'related-multi') {
      if (Array.isArray(value)) fields[key] = value.filter(isRef).map((r) => r.name);
    } else if (value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      fields[key] = value;
    }
  }
  return {
    type: entity.type,
    [spec?.nameField ?? 'name']: entity.name,
    ...(entity.aliases.length ? { aliases: entity.aliases } : {}),
    ...(entity.summary ? { summary: entity.summary } : {}),
    ...(entity.tags.length ? { tags: entity.tags } : {}),
    fields,
  };
}

export function entityWireString(entity: Entity): string {
  return JSON.stringify(entityToWireJson(entity), null, 2);
}
