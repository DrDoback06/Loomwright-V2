import { db } from '../schema';
import { logAudit } from './audit';
import type { Entity } from '../types';
import type { EntityRef } from '@/domain/entity-types';

/** Rewrite every EntityRef in a fields blob from `fromId` to the target
 * ref. Returns [changed, newFields]. */
function rewriteRefs(
  fields: Record<string, unknown>,
  fromId: string,
  target: EntityRef
): [boolean, Record<string, unknown>] {
  let changed = false;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'object' && v !== null) {
      if (!Array.isArray(v) && (v as EntityRef).id === fromId && 'type' in v && 'name' in v) {
        changed = true;
        return { ...target };
      }
      if (Array.isArray(v)) {
        const mapped = v.map(walk);
        // Dedupe refs that collapsed onto the target.
        const seen = new Set<string>();
        return mapped.filter((item) => {
          const ref = item as EntityRef;
          if (typeof ref === 'object' && ref !== null && typeof ref.id === 'string') {
            if (seen.has(ref.id)) return false;
            seen.add(ref.id);
          }
          return true;
        });
      }
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  const result = walk(fields) as Record<string, unknown>;
  return [changed, result];
}

/** Merge `source` into `target` (same project): union aliases (+source
 * name), merge missing fields, rewrite every reference project-wide
 * (entity fields, links, occurrences, pending candidates), then delete
 * the source. One Dexie transaction — all-or-nothing. */
export async function mergeEntities(sourceId: string, targetId: string): Promise<Entity | null> {
  const source = await db.entities.get(sourceId);
  const target = await db.entities.get(targetId);
  if (!source || !target || source.projectId !== target.projectId) return null;
  if (source.type !== target.type) return null;

  const projectId = target.projectId;
  const targetRef: EntityRef = { id: target.id, type: target.type, name: target.name };

  await db.transaction(
    'rw',
    [db.entities, db.occurrences, db.candidates, db.links, db.auditLog],
    async () => {
      // 1. Union aliases and shallow-merge missing fields onto the target.
      const aliases = new Set([...target.aliases, ...source.aliases]);
      if (source.name && source.name !== target.name) aliases.add(source.name);
      const mergedFields = { ...source.fields, ...target.fields };
      await db.entities.update(target.id, {
        aliases: [...aliases],
        summary: target.summary || source.summary,
        fields: mergedFields,
        updatedAt: Date.now(),
      });

      // 2. Rewrite refs inside every entity of the project.
      const all = await db.entities.where('projectId').equals(projectId).toArray();
      for (const e of all) {
        if (e.id === source.id) continue;
        const [changed, newFields] = rewriteRefs(e.fields, source.id, targetRef);
        if (changed) await db.entities.update(e.id, { fields: newFields });
      }

      // 3. Occurrences and pending candidates point at the target now.
      await db.occurrences.where('[projectId+entityId]').equals([projectId, source.id]).modify({
        entityId: target.id,
      });
      await db.candidates
        .where('[projectId+status]')
        .equals([projectId, 'pending'])
        .filter((c) => c.existingEntityId === source.id)
        .modify({ existingEntityId: target.id });

      // 4. Links table (used from M5 onward).
      await db.links
        .where('projectId')
        .equals(projectId)
        .filter((l) => l.from.id === source.id || l.to.id === source.id)
        .modify((l) => {
          if (l.from.id === source.id) l.from = { ...targetRef };
          if (l.to.id === source.id) l.to = { ...targetRef };
        });

      // 5. Source disappears (merge is not a trash operation).
      await db.entities.delete(source.id);

      await logAudit({
        projectId,
        action: 'entity.merge',
        target: { table: 'entities', id: target.id, label: target.name },
        before: source,
        after: { mergedFrom: source.name, into: target.name },
      });
    }
  );

  return (await db.entities.get(targetId)) ?? null;
}
