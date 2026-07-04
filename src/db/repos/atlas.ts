import { db } from '../schema';
import { newId } from '@/lib/id';
import type { AtlasMap, AtlasPin } from '../types';
import type { EntityRef } from '@/domain/entity-types';

/** One default map per project for now; multi-map arrives with the full
 * atlas editor. */
export async function getOrCreateMap(projectId: string): Promise<AtlasMap> {
  const existing = await db.atlasMaps.where('projectId').equals(projectId).first();
  if (existing) return existing;
  const map: AtlasMap = {
    id: newId(),
    projectId,
    name: 'World map',
    pins: [],
    layers: { labels: true, travel: true, grid: false },
    updatedAt: Date.now(),
  };
  await db.atlasMaps.add(map);
  return map;
}

export async function placePin(mapId: string, entity: EntityRef, x: number, y: number): Promise<void> {
  const map = await db.atlasMaps.get(mapId);
  if (!map) return;
  const pins: AtlasPin[] = [
    ...map.pins.filter((p) => p.entity.id !== entity.id),
    { id: newId(), entity, x, y },
  ];
  await db.atlasMaps.update(mapId, { pins, updatedAt: Date.now() });
}

export async function movePin(mapId: string, pinId: string, x: number, y: number): Promise<void> {
  const map = await db.atlasMaps.get(mapId);
  if (!map) return;
  await db.atlasMaps.update(mapId, {
    pins: map.pins.map((p) => (p.id === pinId ? { ...p, x, y } : p)),
    updatedAt: Date.now(),
  });
}

export async function removePin(mapId: string, pinId: string): Promise<void> {
  const map = await db.atlasMaps.get(mapId);
  if (!map) return;
  await db.atlasMaps.update(mapId, {
    pins: map.pins.filter((p) => p.id !== pinId),
    updatedAt: Date.now(),
  });
}

export async function setLayer(
  mapId: string,
  layer: keyof AtlasMap['layers'],
  value: boolean
): Promise<void> {
  const map = await db.atlasMaps.get(mapId);
  if (!map) return;
  await db.atlasMaps.update(mapId, {
    layers: { ...map.layers, [layer]: value },
    updatedAt: Date.now(),
  });
}
