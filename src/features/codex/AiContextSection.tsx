import type { EntityType } from '@/domain/entity-types';
import type { FieldDef } from '@/domain/entity-configs/types';
import {
  DEFAULT_AI_POLICY,
  isFieldHiddenFromAi,
  readAiPolicy,
  type AiContextPolicy,
  type EntityAiPolicy,
} from '@/domain/ai-policy';
import { entitySpec, generableFields } from '@/services/generate/spec';
import { ChipsInput } from './fields/FieldInput';

/** A synthetic field so the exclusions list reuses the same chips editor as
 * every other string list in the app, rather than growing a second one. */
const EXCLUSIONS_FIELD = {
  id: 'aiExclusions',
  label: 'Never count as a mention',
  kind: 'chips',
  placeholder: 'e.g. the Reach',
} as const satisfies FieldDef;

const CONTEXT_CHOICES: { value: AiContextPolicy; label: string; hint: string }[] = [
  { value: 'always', label: 'Always', hint: 'In every prompt, whether or not this scene mentions them.' },
  { value: 'detected', label: 'When detected', hint: 'Only when the name or an alias appears in the scene.' },
  { value: 'never', label: 'Never', hint: 'Kept out of every prompt. Still tracked and still extracted.' },
];

/**
 * What this entity contributes to an AI prompt, and how its name is matched.
 *
 * Deliberately not built from a `FieldDef` list: `FieldInput` writes
 * `form[field.id]` and has no plumbing for a nested `__ai.x` path, and the
 * per-field list below is generated from the type's own config rather than
 * authored anywhere.
 *
 * Named "AI context" rather than "AI" because `cast` already has an
 * "AI profile" section, and two sections called AI is a coin toss.
 */
export function AiContextSection({
  type,
  policy: raw,
  onChange,
}: {
  type: EntityType;
  policy: unknown;
  onChange: (next: EntityAiPolicy) => void;
}) {
  const policy = readAiPolicy({ __ai: raw });
  const patch = (bit: Partial<EntityAiPolicy>) => onChange({ ...policy, ...bit });

  // The same filter generation uses: drops name/aliases/summary/tags and the
  // two kinds that carry no sendable text (image, phrase-tester).
  const spec = entitySpec(type);
  const fields = spec ? generableFields(spec) : [];
  const bySection = new Map<string, typeof fields>();
  for (const field of fields) {
    const key = field.sectionTitle ?? 'Fields';
    bySection.set(key, [...(bySection.get(key) ?? []), field]);
  }

  const setFieldVisible = (fieldId: string, visible: boolean) => {
    const field = fields.find((f) => f.id === fieldId);
    const next = { ...policy.fieldVisibility };
    // Drop the override when it agrees with the config, so an entity only
    // stores an opinion it actually holds — and a later change to the config
    // default still reaches everyone who never expressed one.
    if (field && visible === !(field.aiHidden === true)) delete next[fieldId];
    else next[fieldId] = visible;
    patch({ fieldVisibility: next });
  };

  return (
    <div className="lw-aipolicy">
      <p className="lw-fieldnote">
        What this entry contributes to AI prompts, and how its name is matched in your prose.
        Everything here is local — it changes what gets sent, never what gets stored.
      </p>

      <fieldset className="lw-aipolicy__group">
        <legend className="lw-field__label">Include in context</legend>
        <div className="lw-pills" role="radiogroup" aria-label="Include in context">
          {CONTEXT_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={policy.context === choice.value}
              className={policy.context === choice.value ? 'lw-pill lw-pill--active' : 'lw-pill'}
              onClick={() => patch({ context: choice.value })}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="lw-fieldnote">
          {CONTEXT_CHOICES.find((c) => c.value === policy.context)?.hint}
        </p>
      </fieldset>

      <fieldset className="lw-aipolicy__group">
        <legend className="lw-field__label">Name matching</legend>
        <label className="lw-toggle">
          <input
            type="checkbox"
            checked={policy.caseSensitive}
            onChange={(e) => patch({ caseSensitive: e.target.checked })}
          />
          <span>Match this name case-sensitively</span>
        </label>
        <p className="lw-fieldnote">
          For names that are also ordinary words — Red, Will, May, Art. Applies to scanning your
          prose; a name an AI writes back is still matched loosely.
        </p>

        <label className="lw-field__label" htmlFor={`field-${EXCLUSIONS_FIELD.id}`}>
          {EXCLUSIONS_FIELD.label}
        </label>
        <ChipsInput
          field={EXCLUSIONS_FIELD}
          value={policy.exclusions}
          onChange={(v) => patch({ exclusions: (v as string[]) ?? [] })}
        />
        <p className="lw-fieldnote">
          Phrases that should not count, even though they contain the name.
        </p>
      </fieldset>

      <fieldset className="lw-aipolicy__group">
        <legend className="lw-field__label">Fields sent as context</legend>
        <p className="lw-fieldnote">
          Unticked fields are never sent to a model. Appearance starts off because models tend to
          repeat a vivid physical detail in every scene.
        </p>
        {[...bySection].map(([title, group]) => (
          <div key={title} className="lw-aipolicy__section">
            <span className="lw-aipolicy__eyebrow">{title}</span>
            {group.map((field) => (
              <label key={field.id} className="lw-toggle">
                <input
                  type="checkbox"
                  checked={!isFieldHiddenFromAi(field, policy)}
                  onChange={(e) => setFieldVisible(field.id, e.target.checked)}
                />
                <span>{field.label}</span>
              </label>
            ))}
          </div>
        ))}
      </fieldset>

      <button
        type="button"
        className="lw-btn lw-btn--ghost"
        onClick={() => onChange({ ...DEFAULT_AI_POLICY, fieldVisibility: {} })}
      >
        Reset to defaults
      </button>
    </div>
  );
}
