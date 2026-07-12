import type { EntityType } from '@/domain/entity-types';

export const LOOMWRIGHT_DRAG_MIME = 'application/x-loomwright-identity';

export type LoomwrightDragPayload =
  | {
      kind: 'review-cluster';
      entityType: EntityType;
      candidateIds: string[];
      name: string;
    }
  | {
      kind: 'entity';
      entityType: EntityType;
      entityId: string;
      name: string;
    };

export function writeDragPayload(event: React.DragEvent, payload: LoomwrightDragPayload) {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(LOOMWRIGHT_DRAG_MIME, JSON.stringify(payload));
  event.dataTransfer.setData('text/plain', payload.name);
}

export function readDragPayload(event: React.DragEvent): LoomwrightDragPayload | null {
  const raw = event.dataTransfer.getData(LOOMWRIGHT_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LoomwrightDragPayload;
    if (parsed.kind === 'entity' && parsed.entityId && parsed.entityType) return parsed;
    if (
      parsed.kind === 'review-cluster' &&
      Array.isArray(parsed.candidateIds) &&
      parsed.candidateIds.length > 0 &&
      parsed.entityType
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}
