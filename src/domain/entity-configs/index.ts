import type { EntityType } from '@/domain/entity-types';
import type { EntityConfig } from './types';
import { castConfig } from './cast';
import { bestiaryConfig } from './bestiary';
import { locationsConfig } from './locations';
import { itemsConfig } from './items';
import { classesConfig } from './classes';
import { racesConfig } from './races';
import { statsConfig } from './stats';
import { skillsConfig } from './skills';
import { questsConfig } from './quests';
import { eventsConfig } from './events';
import { factionsConfig } from './factions';
import { loreConfig } from './lore';
import { relationshipsConfig } from './relationships';
import { timelineConfig } from './timeline';
import { referencesConfig } from './references';

/** Abilities route to the skills editor (legacy parity): same sections and
 * fields, but the stored type and display name stay 'abilities'/'Ability'. */
const abilitiesConfig: EntityConfig = {
  ...skillsConfig,
  type: 'abilities',
  displayName: 'Ability',
};

/** Editor configs, one per entity type. Grows as codex milestones land —
 * a type without a config here has no editor and therefore no nav entry. */
const CONFIGS: Partial<Record<EntityType, EntityConfig>> = {
  cast: castConfig,
  bestiary: bestiaryConfig,
  locations: locationsConfig,
  items: itemsConfig,
  classes: classesConfig,
  races: racesConfig,
  stats: statsConfig,
  abilities: abilitiesConfig,
  skills: skillsConfig,
  quests: questsConfig,
  events: eventsConfig,
  factions: factionsConfig,
  lore: loreConfig,
  relationships: relationshipsConfig,
  timeline: timelineConfig,
  references: referencesConfig,
};

export function getEntityConfig(type: EntityType): EntityConfig | undefined {
  return CONFIGS[type];
}

export function configuredEntityTypes(): EntityType[] {
  return Object.keys(CONFIGS) as EntityType[];
}
