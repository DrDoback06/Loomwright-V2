import type { EntityType } from '@/domain/entity-types';

/** Field kinds supported by the config-driven entity editor. */
export type FieldKind =
  | 'text' // single-line text
  | 'textarea' // 2-4 line text
  | 'longtext' // tall prose field
  | 'chips' // free string list
  | 'pills' // single choice from options
  | 'toggle' // boolean
  | 'number'
  | 'related' // single link to another entity
  | 'related-multi' // list of links to other entities
  | 'stat-grid' // rows of { name, value, min?, max? }
  | 'step-list' // ordered quest steps with per-step status
  | 'image'; // portrait / reference image stored as data URL

export interface FieldDef {
  id: string;
  label: string;
  kind: FieldKind;
  /** For pills. */
  options?: readonly string[];
  /** For related / related-multi: which entity type to pick from. */
  related?: EntityType;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  /** 1 (half row, default) or 2 (full row). */
  span?: 1 | 2;
}

export interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
}

export interface EntityConfig {
  type: EntityType;
  displayName: string;
  /** One-line guidance shown in the empty editor. */
  defaultSummary: string;
  sections: SectionDef[];
}

export interface StatRow {
  name: string;
  value: string;
  min?: string;
  max?: string;
}

export type StepStatus = 'pending' | 'active' | 'done' | 'skipped';

export interface StepRow {
  text: string;
  status: StepStatus;
}
