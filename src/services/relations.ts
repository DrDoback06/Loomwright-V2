import type { Entity } from '@/db/types';
import type { EntityRef } from '@/domain/entity-types';

function isRef(v: unknown): v is EntityRef {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as EntityRef).id === 'string' &&
    typeof (v as EntityRef).type === 'string' &&
    'name' in (v as EntityRef)
  );
}

/** Every EntityRef found anywhere in an entity's fields. */
export function refsInFields(entity: Entity): EntityRef[] {
  const out: EntityRef[] = [];
  const walk = (v: unknown) => {
    if (isRef(v)) {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object' && v !== null) Object.values(v).forEach(walk);
  };
  Object.values(entity.fields).forEach(walk);
  return out;
}

/** True when `entity` references `other` (or vice versa) through any
 * field ref — the relation test behind cross-panel filter chips. */
export function entitiesRelate(entity: Entity, other: Entity): boolean {
  if (entity.id === other.id) return false;
  return (
    refsInFields(entity).some((r) => r.id === other.id) ||
    refsInFields(other).some((r) => r.id === entity.id)
  );
}
