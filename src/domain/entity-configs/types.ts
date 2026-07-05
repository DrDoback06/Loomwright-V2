import type { EntityType } from '@/domain/entity-types';

/** Field kinds supported by the config-driven entity editor. */
export type FieldKind =
  | 'text' // single-line text
  | 'textarea' // 2-4 line text
  | 'longtext' // tall prose field
  | 'chips' // free string list
  | 'pills' // single choice from options
  | 'select' // single choice from a long option list (dropdown)
  | 'multiselect' // multiple choices from options (toggle pills)
  | 'toggle' // boolean
  | 'number'
  | 'dual-number' // paired numeric inputs stored as { x, y }
  | 'related' // single link to another entity
  | 'related-multi' // list of links to other entities (or related: 'any')
  | 'stat-grid' // rows of { name, value, min?, max? }
  | 'step-list' // ordered quest steps with per-step status
  | 'row-list' // ordered free-text rows (rules, effects, branches)
  | 'phrase-tester' // interactive check of a sample against the form's phrase rules
  | 'image'; // portrait / reference image stored as data URL

export interface FieldDef {
  id: string;
  label: string;
  kind: FieldKind;
  /** For pills / select / multiselect. */
  options?: readonly string[];
  /** For related / related-multi: which entity type to pick from
   * ('any' allows links across every codex type). */
  related?: EntityType | 'any';
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
