import type { EntityType } from '@/domain/entity-types';
import type { EntityConfig } from './types';
import { castConfig } from './cast';

/** Editor configs, one per entity type. Grows as codex milestones land —
 * a type without a config here has no editor and therefore no nav entry. */
const CONFIGS: Partial<Record<EntityType, EntityConfig>> = {
  cast: castConfig,
};

export function getEntityConfig(type: EntityType): EntityConfig | undefined {
  return CONFIGS[type];
}

export function configuredEntityTypes(): EntityType[] {
  return Object.keys(CONFIGS) as EntityType[];
}
