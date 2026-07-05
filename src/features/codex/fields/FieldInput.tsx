import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import type { FieldDef, StatRow, StepRow } from '@/domain/entity-configs/types';
import type { EntityRef } from '@/domain/entity-types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { listEntities } from '@/db/repos/entities';
import { findRanges } from '@/services/extraction/text-utils';
import { useProjectStore } from '@/stores/project';

interface FieldInputProps {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  /** The whole form — only kinds that test against sibling fields
   * (phrase-tester) read it. */
  form?: Record<string, unknown>;
}

export function FieldInput({ field, value, onChange, form }: FieldInputProps) {
  switch (field.kind) {
    case 'text':
    case 'number':
      return (
        <input
          id={`field-${field.id}`}
          className="lw-input"
          type="text"
          inputMode={field.kind === 'number' ? 'decimal' : undefined}
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'textarea':
      return (
        <textarea
          id={`field-${field.id}`}
          className="lw-input lw-input--area"
          rows={3}
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'longtext':
      return (
        <textarea
          id={`field-${field.id}`}
          className="lw-input lw-input--area"
          rows={6}
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'toggle':
      return (
        <label className="lw-toggle">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.hint ?? field.label}</span>
        </label>
      );
    case 'pills':
      return <PillsInput field={field} value={value as string | undefined} onChange={onChange} />;
    case 'select':
      return (
        <select
          id={`field-${field.id}`}
          className="lw-input"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">Choose…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case 'multiselect':
      return <MultiSelectInput field={field} value={(value as string[]) ?? []} onChange={onChange} />;
    case 'dual-number':
      return <DualNumberInput field={field} value={value as { x?: string; y?: string } | undefined} onChange={onChange} />;
    case 'chips':
      return <ChipsInput field={field} value={(value as string[]) ?? []} onChange={onChange} />;
    case 'row-list':
      return <RowListInput field={field} value={normaliseRows(value)} onChange={onChange} />;
    case 'phrase-tester':
      return <PhraseTester field={field} value={(value as string) ?? ''} onChange={onChange} form={form} />;
    case 'stat-grid':
      return <StatGridInput value={(value as StatRow[]) ?? []} onChange={onChange} />;
    case 'step-list':
      return <StepListInput field={field} value={(value as StepRow[]) ?? []} onChange={onChange} />;
    case 'related':
      return (
        <RelatedPicker
          field={field}
          value={(value as EntityRef | null) ?? null}
          onPick={(ref) => onChange(ref)}
        />
      );
    case 'related-multi':
      return (
        <RelatedMultiPicker
          field={field}
          // Tolerate legacy string[] data where refs now live.
          value={((value as EntityRef[]) ?? []).filter((r) => r && typeof r === 'object')}
          onChange={onChange}
        />
      );
    case 'image':
      return <ImageInput field={field} value={(value as string) ?? ''} onChange={onChange} />;
  }
}

function PillsInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | undefined;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="lw-pills" role="radiogroup" aria-label={field.label}>
      {(field.options ?? []).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => onChange(active ? undefined : opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ChipsInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string[];
  onChange: (v: unknown) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    if (!value.includes(text)) onChange([...value, text]);
    setDraft('');
  };

  return (
    <div className="lw-chips">
      <div className="lw-chips__row">
        {value.map((chip) => (
          <span key={chip} className="lw-chip">
            {chip}
            <button
              type="button"
              className="lw-chip__x"
              aria-label={`Remove ${chip}`}
              onClick={() => onChange(value.filter((c) => c !== chip))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="lw-chips__add">
        <input
          id={`field-${field.id}`}
          className="lw-input"
          value={draft}
          placeholder={field.placeholder ?? 'Add and press Enter'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="lw-btn" onClick={add} aria-label={`Add ${field.label}`}>
          Add
        </button>
      </div>
    </div>
  );
}

function StatGridInput({ value, onChange }: { value: StatRow[]; onChange: (v: unknown) => void }) {
  const update = (i: number, patch: Partial<StatRow>) => {
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };
  return (
    <div className="lw-statgrid">
      {value.map((row, i) => (
        <div key={i} className="lw-statgrid__row">
          <input
            className="lw-input"
            aria-label={`Stat ${i + 1} name`}
            placeholder="Stat"
            value={row.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <input
            className="lw-input"
            aria-label={`Stat ${i + 1} value`}
            placeholder="Value"
            value={row.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <button
            type="button"
            className="lw-iconbtn"
            aria-label={`Remove stat ${row.name || i + 1}`}
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="lw-btn"
        onClick={() => onChange([...value, { name: '', value: '' }])}
      >
        + Add stat
      </button>
    </div>
  );
}

const STEP_CYCLE: StepRow['status'][] = ['pending', 'active', 'done', 'skipped'];
const STEP_GLYPH: Record<StepRow['status'], string> = {
  pending: '○',
  active: '◐',
  done: '●',
  skipped: '⊘',
};

function StepListInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: StepRow[];
  onChange: (v: unknown) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...value, { text, status: 'pending' }]);
    setDraft('');
  };
  const update = (i: number, patch: Partial<StepRow>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="lw-steplist">
      <ol className="lw-steplist__rows">
        {value.map((row, i) => (
          <li key={i} className={`lw-step lw-step--${row.status}`}>
            <button
              type="button"
              className="lw-step__status"
              aria-label={`Step ${i + 1} status: ${row.status}. Click to advance.`}
              title={row.status}
              onClick={() =>
                update(i, {
                  status: STEP_CYCLE[(STEP_CYCLE.indexOf(row.status) + 1) % STEP_CYCLE.length],
                })
              }
            >
              {STEP_GLYPH[row.status]}
            </button>
            <input
              className="lw-input lw-step__text"
              aria-label={`Step ${i + 1} text`}
              value={row.text}
              onChange={(e) => update(i, { text: e.target.value })}
            />
            <button type="button" className="lw-iconbtn" aria-label={`Move step ${i + 1} up`} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="lw-iconbtn" aria-label={`Move step ${i + 1} down`} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button
              type="button"
              className="lw-iconbtn"
              aria-label={`Remove step ${i + 1}`}
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <div className="lw-chips__add">
        <input
          id={`field-${field.id}`}
          className="lw-input"
          value={draft}
          placeholder="Add a step and press Enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="lw-btn" onClick={add} aria-label={`Add ${field.label}`}>
          Add
        </button>
      </div>
    </div>
  );
}

function useRelatedOptions(field: FieldDef) {
  const projectId = useProjectStore((s) => s.currentProjectId);
  return useLiveQuery(
    async () => {
      if (!projectId || !field.related) return [];
      if (field.related === 'any') {
        const all = await db.entities.where('projectId').equals(projectId).toArray();
        return all
          .filter((e) => e.status === 'active')
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      return listEntities(projectId, field.related);
    },
    [projectId, field.related],
    []
  );
}

/** Old data may hold a newline-separated string where a row-list now
 * lives — read both, always write string[]. */
function normaliseRows(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string' && value.trim()) return value.split('\n').filter(Boolean);
  return [];
}

function RowListInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string[];
  onChange: (v: unknown) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...value, text]);
    setDraft('');
  };
  return (
    <div className="lw-steplist">
      <ol className="lw-steplist__rows">
        {value.map((row, i) => (
          <li key={i} className="lw-step">
            <input
              className="lw-input lw-step__text"
              aria-label={`${field.label} row ${i + 1}`}
              value={row}
              onChange={(e) => onChange(value.map((r, j) => (j === i ? e.target.value : r)))}
            />
            <button
              type="button"
              className="lw-iconbtn"
              aria-label={`Remove ${field.label} row ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <div className="lw-chips__add">
        <input
          id={`field-${field.id}`}
          className="lw-input"
          placeholder="Add a row and press Enter"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="lw-btn" onClick={add} aria-label={`Add ${field.label} row`}>
          Add
        </button>
      </div>
    </div>
  );
}

function MultiSelectInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string[];
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="lw-pills" role="group" aria-label={field.label}>
      {(field.options ?? []).map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            role="checkbox"
            aria-checked={active}
            className={active ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => onChange(active ? value.filter((v) => v !== opt) : [...value, opt])}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function DualNumberInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: { x?: string; y?: string } | undefined;
  onChange: (v: unknown) => void;
}) {
  const current = value ?? {};
  const patch = (p: Partial<{ x: string; y: string }>) => onChange({ ...current, ...p });
  return (
    <div className="lw-dualnum">
      <input
        id={`field-${field.id}`}
        className="lw-input"
        inputMode="decimal"
        placeholder="X"
        aria-label={`${field.label} X`}
        value={current.x ?? ''}
        onChange={(e) => patch({ x: e.target.value })}
      />
      <span aria-hidden>/</span>
      <input
        className="lw-input"
        inputMode="decimal"
        placeholder="Y"
        aria-label={`${field.label} Y`}
        value={current.y ?? ''}
        onChange={(e) => patch({ y: e.target.value })}
      />
    </div>
  );
}

/** Try a sample sentence against this stat's name and phrase rules —
 * the exact word-boundary matching the extraction detectors use. */
function PhraseTester({
  field,
  value,
  onChange,
  form,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: unknown) => void;
  form?: Record<string, unknown>;
}) {
  const needles = [
    ...(typeof form?.name === 'string' && form.name.trim() ? [form.name.trim()] : []),
    ...normaliseRows(form?.extractionRules),
  ];
  const hits = value.trim()
    ? needles.filter((n) => findRanges(value, n).length > 0)
    : [];
  return (
    <div className="lw-phrasetester">
      <input
        id={`field-${field.id}`}
        className="lw-input"
        placeholder="e.g. Aelinor gains 2 Resolve"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value.trim() ? (
        <p className="lw-fieldnote" data-testid="phrase-test-result">
          {needles.length === 0
            ? 'Name the stat (and add phrase rules) first.'
            : hits.length > 0
              ? `✓ Matches: ${hits.join(', ')} — extraction will pick this up.`
              : '✗ No rule matches this sample yet.'}
        </p>
      ) : null}
    </div>
  );
}

function RelatedPicker({
  field,
  value,
  onPick,
}: {
  field: FieldDef;
  value: EntityRef | null;
  onPick: (ref: EntityRef | null) => void;
}) {
  const options = useRelatedOptions(field);
  const meta = field.related && field.related !== 'any' ? ENTITY_TYPE_META[field.related] : null;

  if (value) {
    return (
      <div className="lw-chips__row">
        <span className="lw-chip">
          {meta?.glyph} {value.name}
          <button
            type="button"
            className="lw-chip__x"
            aria-label={`Clear ${field.label}`}
            onClick={() => onPick(null)}
          >
            ×
          </button>
        </span>
      </div>
    );
  }
  if (!options || options.length === 0) {
    return <p className="lw-fieldnote">No {meta?.plural.toLowerCase() ?? 'entries'} yet.</p>;
  }
  return (
    <select
      id={`field-${field.id}`}
      className="lw-input"
      value=""
      onChange={(e) => {
        const picked = options.find((o) => o.id === e.target.value);
        if (picked) onPick({ id: picked.id, type: picked.type, name: picked.name });
      }}
    >
      <option value="">Choose…</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

function RelatedMultiPicker({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: EntityRef[];
  onChange: (v: unknown) => void;
}) {
  const options = useRelatedOptions(field);
  const meta = field.related && field.related !== 'any' ? ENTITY_TYPE_META[field.related] : null;
  const remaining = (options ?? []).filter((o) => !value.some((v) => v.id === o.id));

  return (
    <div className="lw-chips">
      <div className="lw-chips__row">
        {value.map((ref) => (
          <span key={ref.id} className="lw-chip">
            {(meta ?? ENTITY_TYPE_META[ref.type])?.glyph} {ref.name}
            <button
              type="button"
              className="lw-chip__x"
              aria-label={`Remove ${ref.name}`}
              onClick={() => onChange(value.filter((v) => v.id !== ref.id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {remaining.length > 0 ? (
        <select
          id={`field-${field.id}`}
          className="lw-input"
          value=""
          aria-label={`Add to ${field.label}`}
          onChange={(e) => {
            const picked = remaining.find((o) => o.id === e.target.value);
            if (picked) onChange([...value, { id: picked.id, type: picked.type, name: picked.name }]);
          }}
        >
          <option value="">Add…</option>
          {remaining.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      ) : value.length === 0 ? (
        <p className="lw-fieldnote">No {meta?.plural.toLowerCase() ?? 'entries'} yet.</p>
      ) : null}
    </div>
  );
}

function ImageInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: unknown) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) return; // keep portraits small
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="lw-imagefield">
      {value ? (
        <div className="lw-imagefield__preview">
          <img src={value} alt={field.label} />
          <button type="button" className="lw-btn" onClick={() => onChange('')}>
            Remove
          </button>
        </div>
      ) : (
        <button type="button" className="lw-imagefield__drop" onClick={() => fileRef.current?.click()}>
          {field.hint ?? 'Upload an image'}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
