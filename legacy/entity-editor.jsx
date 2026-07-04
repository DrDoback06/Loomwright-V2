// =====================================================================
// entity-editor.jsx — Universal right-docked Entity Creation Editor.
//
// Used by: every entity panel's "+ Create" button + Writer's Room
// "Create from selection" + cross-tab "Create from extraction candidate".
//
// Modes (5 tab pills + 3 footer save actions):
//   tabs    : Quick Create · Full Editor · AI Draft · Paste JSON · Review
//   actions : Save as Draft · Save (Active) · Save + Add to Composition
//
// Driven by ENTITY_EDITOR_CONFIGS[entityType]. Each entity type defines
// its sections + fields. The component renders fields by `kind`.
//
// Public API:
//   <EntityEditor open type initial onClose onSave onSaveAndCompose />
//
// Backend hook-up: every save callback dispatches a single
// `onSaveEntity(payload, mode)` that the host turns into create/draft/
// add-to-composition. The host (app.jsx) wires this to the panel state.
// =====================================================================

const { useState: _ee_us, useEffect: _ee_ue, useMemo: _ee_um, useCallback: _ee_uc, useRef: _ee_ur } = React;

const EE_MODES = [
  { id: "quick",   label: "Quick Create",      hint: "Just the essentials.",       icon: "bolt" },
  { id: "full",    label: "Full Editor",       hint: "Every field for this type.", icon: "paper" },
  { id: "ai",      label: "AI-Assisted Draft", hint: "Describe it; preview a generated draft. (Simulated)", icon: "sparkle" },
  { id: "json",    label: "Paste JSON",        hint: "Import a structured payload.", icon: "command" },
  { id: "review",  label: "Review Before Save", hint: "Preview the entity as the rest of the project will see it.", icon: "eye" },
];

// ---------------------------------------------------------------------
// Field components
// ---------------------------------------------------------------------

const EEField = ({ field, value, onChange, all, ctx }) => {
  const lbl = (
    <span className="ee-field__lbl">
      {field.label}
      {field.required && <span className="ee-field__lbl__req">*</span>}
    </span>
  );

  switch (field.kind) {
    case "text":
      return (
        <div className="ee-field" style={field.span === 2 ? { gridColumn: "1 / -1" } : {}}>
          {lbl}
          <input className="ee-input" placeholder={field.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)}/>
          {field.hint && <span className="ee-field__hint">{field.hint}</span>}
        </div>
      );
    case "number":
      return (
        <div className="ee-field">
          {lbl}
          <input type="number" className="ee-input" placeholder={field.placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}/>
        </div>
      );
    case "dual-number":
      return (
        <div className="ee-field" style={field.span === 2 ? { gridColumn: "1 / -1" } : {}}>
          {lbl}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input type="number" placeholder="X" className="ee-input" value={value?.x ?? ""} onChange={(e) => onChange({ ...(value || {}), x: e.target.value === "" ? null : Number(e.target.value) })}/>
            <input type="number" placeholder="Y" className="ee-input" value={value?.y ?? ""} onChange={(e) => onChange({ ...(value || {}), y: e.target.value === "" ? null : Number(e.target.value) })}/>
          </div>
          {field.hint && <span className="ee-field__hint">{field.hint}</span>}
        </div>
      );
    case "textarea":
      return (
        <div className="ee-field" style={field.span === 2 ? { gridColumn: "1 / -1" } : {}}>
          {lbl}
          <textarea className="ee-textarea" placeholder={field.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)}/>
          {field.hint && <span className="ee-field__hint">{field.hint}</span>}
        </div>
      );
    case "longtext":
      return (
        <div className="ee-field" style={field.span === 2 ? { gridColumn: "1 / -1" } : {}}>
          {lbl}
          <textarea className="ee-textarea ee-textarea--lg" placeholder={field.placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)}/>
        </div>
      );
    case "chips":
      return <EEChipsField field={field} value={value} onChange={onChange} lbl={lbl}/>;
    case "pills":
      return (
        <div className="ee-field" style={field.span === 2 ? { gridColumn: "1 / -1" } : {}}>
          {lbl}
          <div className="ee-pills">
            {(field.options || []).map((o) => (
              <button key={o} type="button"
                className={"ee-pill " + (value === o ? "is-active" : "")}
                onClick={() => onChange(value === o ? null : o)}>{o}</button>
            ))}
          </div>
        </div>
      );
    case "select":
      return (
        <div className="ee-field">
          {lbl}
          <select className="ee-select" value={value || ""} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">—</option>
            {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {field.hint && <span className="ee-field__hint">{field.hint}</span>}
        </div>
      );
    case "multiselect":
      return <EEMultiSelect field={field} value={value} onChange={onChange} lbl={lbl}/>;
    case "toggle":
      return (
        <div className="ee-field">
          {lbl}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
            <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)}/>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>{field.hint || "On"}</span>
          </label>
        </div>
      );
    case "related":
      return <EERelatedPicker field={field} value={value} onChange={onChange} lbl={lbl} multi={false} ctx={ctx}/>;
    case "related-multi":
      return <EERelatedPicker field={field} value={value} onChange={onChange} lbl={lbl} multi={true} ctx={ctx}/>;
    case "parent-picker":
      return <EERelatedPicker field={field} value={value} onChange={onChange} lbl={lbl} multi={false} ctx={ctx} relatedOverride={ctx.type}/>;
    case "stat-grid":
      return <EEStatGrid field={field} value={value || []} onChange={onChange} lbl={lbl}/>;
    case "rule-list":
      return <EERuleList field={field} value={value || []} onChange={onChange} lbl={lbl}/>;
    case "effects-list":
      return <EEEffectsList field={field} value={value || []} onChange={onChange} lbl={lbl}/>;
    case "step-list":
      return <EEStepList field={field} value={value || []} onChange={onChange} lbl={lbl}/>;
    case "branch-list":
      return <EEBranchList field={field} value={value || []} onChange={onChange} lbl={lbl}/>;
    case "slot-picker":
      return (
        <div className="ee-field" style={field.span === 2 ? { gridColumn: "1 / -1" } : {}}>
          {lbl}
          <div className="ee-slots">
            {(field.options || []).map((s) => (
              <button key={s} type="button"
                className={"ee-slot " + (value === s ? "is-active" : "")}
                onClick={() => onChange(value === s ? null : s)}>{s}</button>
            ))}
          </div>
        </div>
      );
    case "extraction-rule-list":
      return <EEExtractionRuleList field={field} value={value || []} onChange={onChange} lbl={lbl} all={all}/>;
    case "test-phrase":
      return <EETestPhrase field={field} all={all} lbl={lbl}/>;
    default:
      return (
        <div className="ee-field">
          {lbl}
          <input className="ee-input" placeholder={"(" + field.kind + ")"} value={value || ""} onChange={(e) => onChange(e.target.value)}/>
        </div>
      );
  }
};

// ----- Chips (tags / aliases) -----
const EEChipsField = ({ field, value, onChange, lbl }) => {
  const arr = value || [];
  const [draft, setDraft] = _ee_us("");
  const commit = () => {
    const t = draft.trim();
    if (!t) return;
    if (!arr.includes(t)) onChange([...arr, t]);
    setDraft("");
  };
  return (
    <div className="ee-field" style={field.span === 2 ? { gridColumn: "1 / -1" } : {}}>
      {lbl}
      <div className="ee-chips">
        {arr.map((t, i) => (
          <span key={i} className="ee-chip">
            {t}
            <button type="button" className="ee-chip__x" onClick={() => onChange(arr.filter((_, j) => j !== i))} title="Remove">×</button>
          </span>
        ))}
        <input className="ee-chip-input" placeholder={arr.length === 0 ? (field.placeholder || "Add and press Enter…") : "+ add"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
            if (e.key === "Backspace" && draft === "" && arr.length) onChange(arr.slice(0, -1));
          }}
          onBlur={commit}
        />
      </div>
      {field.hint && <span className="ee-field__hint">{field.hint}</span>}
    </div>
  );
};

// ----- Multi-select (checkbox pills) -----
const EEMultiSelect = ({ field, value, onChange, lbl }) => {
  const arr = value || [];
  return (
    <div className="ee-field" style={field.span === 2 ? { gridColumn: "1 / -1" } : {}}>
      {lbl}
      <div className="ee-pills">
        {(field.options || []).map((o) => (
          <button key={o} type="button"
            className={"ee-pill " + (arr.includes(o) ? "is-active" : "")}
            onClick={() => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])}>{o}</button>
        ))}
      </div>
      {field.hint && <span className="ee-field__hint">{field.hint}</span>}
    </div>
  );
};

// ----- Related entity picker -----
const EERelatedPicker = ({ field, value, onChange, lbl, multi, ctx, relatedOverride }) => {
  const related = relatedOverride || field.related;
  // Read the LIVE entity store first so pickers show user-created entities
  // (and nothing on a fresh project). Cast lives in CAST_SAMPLE, not
  // ENTITY_SAMPLES.cast, so the backend list is the only reliable source.
  const samples = (() => {
    const ES = (typeof window !== "undefined") && window.LoomwrightBackend?.EntityService;
    if (ES) {
      try {
        const live = ES.listSync(related);
        if (Array.isArray(live)) return live;
      } catch (_) {}
    }
    return (window.ENTITY_SAMPLES && window.ENTITY_SAMPLES[related]) || [];
  })();
  const [q, setQ] = _ee_us("");
  const [openPop, setOpenPop] = _ee_us(false);
  const filtered = _ee_um(() => {
    const t = q.toLowerCase().trim();
    if (!t) return samples.slice(0, 6);
    return samples.filter((s) => (s.name || "").toLowerCase().includes(t)).slice(0, 8);
  }, [samples, q]);
  const selectedArr = multi ? (value || []) : (value ? [value] : []);

  const removeOne = (id) => {
    if (multi) onChange((value || []).filter((x) => (x.id || x) !== id));
    else onChange(null);
  };
  const addOne = (s) => {
    const pick = { id: s.id, name: s.name, type: related };
    if (multi) {
      const list = value || [];
      if (!list.some((x) => (x.id || x) === s.id)) onChange([...list, pick]);
    } else {
      onChange(pick);
    }
    setQ("");
    if (!multi) setOpenPop(false);
  };

  return (
    <div className="ee-field" style={field.span === 2 ? { gridColumn: "1 / -1" } : {}}>
      {lbl}
      <div className="ee-relpicker">
        <div className="ee-relpicker__head">
          <Icon name="link" size={11}/>
          <input className="ee-relpicker__search"
            placeholder={(multi ? "Add " : "Pick a ") + related + "…"}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpenPop(true); }}
            onFocus={() => setOpenPop(true)}
          />
          <span style={{ fontSize: 10, color: "var(--ink-4)" }}>{selectedArr.length} {selectedArr.length === 1 ? "linked" : "linked"}</span>
        </div>
        {selectedArr.length > 0 && (
          <div className="ee-relpicker__list">
            {selectedArr.map((s, i) => (
              <span key={s.id || i} className="ee-relpicker__chip">
                <EntityTypeBadge type={related} size="xs" showLabel={false}/>
                {s.name || s.label || s.id}
                <button type="button" className="ee-chip__x" onClick={() => removeOne(s.id)}>×</button>
              </span>
            ))}
          </div>
        )}
        {openPop && (
          <div className="ee-relpicker__pop">
            {filtered.length === 0 && (
              <div className="ee-relpicker__pop-row" style={{ color: "var(--ink-4)", fontStyle: "italic", cursor: "default" }}>
                No matching {related} yet
              </div>
            )}
            {filtered.map((s) => (
              <div key={s.id} className="ee-relpicker__pop-row" onClick={() => addOne(s)}>
                <EntityTypeBadge type={related} size="xs" showLabel={false}/>
                <span style={{ flex: 1 }}>{s.name}</span>
                {s.subtitle && <span style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>{s.subtitle}</span>}
              </div>
            ))}
            <div className="ee-relpicker__pop-row" style={{ borderTop: "1px dashed var(--line-1)", marginTop: 4, paddingTop: 6, color: "var(--accent-deep)" }}>
              <Icon name="plus" size={11}/>
              <span>Create new {related.replace(/s$/, "")} from search…</span>
            </div>
          </div>
        )}
      </div>
      {field.hint && <span className="ee-field__hint">{field.hint}</span>}
    </div>
  );
};

// ----- Stat grid -----
const EEStatGrid = ({ field, value, onChange, lbl }) => {
  const arr = value && value.length ? value : [];
  const update = (i, patch) => onChange(arr.map((s, j) => j === i ? { ...s, ...patch } : s));
  const remove = (i) => onChange(arr.filter((_, j) => j !== i));
  const add = () => onChange([...arr, { name: "", value: 10, min: 1, max: 20 }]);
  return (
    <div className="ee-field" style={{ gridColumn: "1 / -1" }}>
      {lbl}
      <div className="ee-statgrid">
        <div className="ee-statgrid__head">Stat</div>
        <div className="ee-statgrid__head">Value</div>
        <div className="ee-statgrid__head">Min</div>
        <div className="ee-statgrid__head">Max</div>
        <div/>
        {arr.map((s, i) => (
          <React.Fragment key={i}>
            <input value={s.name || ""} placeholder="e.g. Resolve" onChange={(e) => update(i, { name: e.target.value })}/>
            <input value={s.value ?? ""} type="number" onChange={(e) => update(i, { value: Number(e.target.value) })}/>
            <input value={s.min ?? ""}   type="number" onChange={(e) => update(i, { min: Number(e.target.value) })}/>
            <input value={s.max ?? ""}   type="number" onChange={(e) => update(i, { max: Number(e.target.value) })}/>
            <button type="button" className="ee-list-item__btn" onClick={() => remove(i)} title="Remove">×</button>
          </React.Fragment>
        ))}
      </div>
      <button type="button" className="ee-list-add" onClick={add}>+ Add stat</button>
      {field.hint && <span className="ee-field__hint">{field.hint}</span>}
    </div>
  );
};

// ----- Rule list (target / op / note) -----
const EERuleList = ({ field, value, onChange, lbl }) => {
  const arr = value;
  const update = (i, patch) => onChange(arr.map((r, j) => j === i ? { ...r, ...patch } : r));
  const remove = (i) => onChange(arr.filter((_, j) => j !== i));
  const add = () => onChange([...arr, { target: "", delta: "", note: "" }]);
  return (
    <div className="ee-field" style={{ gridColumn: "1 / -1" }}>
      {lbl}
      <div className="ee-list">
        {arr.map((r, i) => (
          <div key={i} className="ee-list-item" style={{ gridTemplateColumns: "auto 1fr 80px 2fr auto" }}>
            <span className="ee-list-item__no">{i + 1}</span>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Target / name"  value={r.target || r.name || ""} onChange={(e) => update(i, { target: e.target.value, name: e.target.value })}/>
            <input className="ee-input" style={{ padding: "4px 8px", textAlign: "center" }} placeholder="±N"  value={r.delta ?? ""} onChange={(e) => update(i, { delta: e.target.value })}/>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Note"           value={r.note || ""} onChange={(e) => update(i, { note: e.target.value })}/>
            <button type="button" className="ee-list-item__btn" onClick={() => remove(i)}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="ee-list-add" onClick={add}>+ Add row</button>
      {field.hint && <span className="ee-field__hint">{field.hint}</span>}
    </div>
  );
};

// ----- Effects list (trigger → effect / cost) -----
const EEEffectsList = ({ field, value, onChange, lbl }) => {
  const arr = value;
  const update = (i, patch) => onChange(arr.map((r, j) => j === i ? { ...r, ...patch } : r));
  const remove = (i) => onChange(arr.filter((_, j) => j !== i));
  const add = () => onChange([...arr, { trigger: "", effect: "", cost: "" }]);
  return (
    <div className="ee-field" style={{ gridColumn: "1 / -1" }}>
      {lbl}
      <div className="ee-list">
        {arr.map((r, i) => (
          <div key={i} className="ee-list-item" style={{ gridTemplateColumns: "auto 1.4fr 2fr 1fr auto" }}>
            <span className="ee-list-item__no">{i + 1}</span>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Trigger" value={r.trigger || ""} onChange={(e) => update(i, { trigger: e.target.value })}/>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Effect"  value={r.effect || ""}  onChange={(e) => update(i, { effect: e.target.value })}/>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Cost"    value={r.cost || ""}    onChange={(e) => update(i, { cost: e.target.value })}/>
            <button type="button" className="ee-list-item__btn" onClick={() => remove(i)}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="ee-list-add" onClick={add}>+ Add effect</button>
      {field.hint && <span className="ee-field__hint">{field.hint}</span>}
    </div>
  );
};

// ----- Step list (quest beats) -----
const EEStepList = ({ field, value, onChange, lbl }) => {
  const arr = value;
  const update = (i, patch) => onChange(arr.map((r, j) => j === i ? { ...r, ...patch } : r));
  const remove = (i) => onChange(arr.filter((_, j) => j !== i));
  const add = () => onChange([...arr, { title: "", status: "Active", chapter: "", location: "" }]);
  return (
    <div className="ee-field" style={{ gridColumn: "1 / -1" }}>
      {lbl}
      <div className="ee-list">
        {arr.map((s, i) => (
          <div key={i} className="ee-list-item" style={{ gridTemplateColumns: "auto 2fr 1fr 1fr 90px auto" }}>
            <span className="ee-list-item__no">{i + 1}</span>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Step title" value={s.title || ""}    onChange={(e) => update(i, { title: e.target.value })}/>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Chapter"     value={s.chapter || ""}  onChange={(e) => update(i, { chapter: e.target.value })}/>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Location"    value={s.location || ""} onChange={(e) => update(i, { location: e.target.value })}/>
            <select className="ee-select" style={{ padding: "4px 8px" }} value={s.status || "Active"} onChange={(e) => update(i, { status: e.target.value })}>
              {["Not started","Active","Completed","Failed","Skipped","Optional"].map((x) => <option key={x}>{x}</option>)}
            </select>
            <button type="button" className="ee-list-item__btn" onClick={() => remove(i)}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="ee-list-add" onClick={add}>+ Add step</button>
      {field.hint && <span className="ee-field__hint">{field.hint}</span>}
    </div>
  );
};

// ----- Branch list -----
const EEBranchList = ({ field, value, onChange, lbl }) => {
  const arr = value;
  const update = (i, patch) => onChange(arr.map((r, j) => j === i ? { ...r, ...patch } : r));
  const remove = (i) => onChange(arr.filter((_, j) => j !== i));
  const add = () => onChange([...arr, { name: "", condition: "", outcome: "" }]);
  return (
    <div className="ee-field" style={{ gridColumn: "1 / -1" }}>
      {lbl}
      <div className="ee-list">
        {arr.map((b, i) => (
          <div key={i} className="ee-list-item" style={{ gridTemplateColumns: "auto 1.4fr 1.4fr 2fr auto" }}>
            <span className="ee-list-item__no">{String.fromCharCode(65 + i)}</span>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Branch name"  value={b.name || ""}      onChange={(e) => update(i, { name: e.target.value })}/>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Condition"    value={b.condition || ""} onChange={(e) => update(i, { condition: e.target.value })}/>
            <input className="ee-input" style={{ padding: "4px 8px" }} placeholder="Outcome"      value={b.outcome || ""}   onChange={(e) => update(i, { outcome: e.target.value })}/>
            <button type="button" className="ee-list-item__btn" onClick={() => remove(i)}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="ee-list-add" onClick={add}>+ Add branch</button>
      {field.hint && <span className="ee-field__hint">{field.hint}</span>}
    </div>
  );
};

// ----- Extraction rule list -----
const EEExtractionRuleList = ({ field, value, onChange, lbl, all }) => {
  const arr = value;
  const update = (i, patch) => onChange(arr.map((r, j) => j === i ? { ...r, ...patch } : r));
  const remove = (i) => onChange(arr.filter((_, j) => j !== i));
  const add = () => onChange([...arr, { phrase: "", match: "exact phrase", effect: "increase", value: "", confidence: "green", targetStat: all?.name || "", active: true }]);
  return (
    <div className="ee-field" style={{ gridColumn: "1 / -1" }}>
      {lbl}
      <div className="ee-rule-grid" style={{ gridTemplateColumns: "2fr 1.2fr 1fr 1fr 0.8fr 40px" }}>
        <div className="ee-rule-grid__h">Phrase / pattern</div>
        <div className="ee-rule-grid__h">Match type</div>
        <div className="ee-rule-grid__h">Effect</div>
        <div className="ee-rule-grid__h">Value</div>
        <div className="ee-rule-grid__h">Confidence</div>
        <div className="ee-rule-grid__h"/>
        {arr.map((r, i) => (
          <React.Fragment key={i}>
            <input type="text" data-mono="true" placeholder="e.g. strength increased by +N" value={r.phrase || ""} onChange={(e) => update(i, { phrase: e.target.value })}/>
            <select value={r.match || "exact phrase"} onChange={(e) => update(i, { match: e.target.value })}>
              {EE_RULE_MATCH_TYPES.map((m) => <option key={m}>{m}</option>)}
            </select>
            <select value={r.effect || "increase"} onChange={(e) => update(i, { effect: e.target.value })}>
              {EE_RULE_EFFECT_TYPES.map((m) => <option key={m}>{m}</option>)}
            </select>
            <input type="text" placeholder="±N / qual." value={r.value || ""} onChange={(e) => update(i, { value: e.target.value })}/>
            <select value={r.confidence || "green"} onChange={(e) => update(i, { confidence: e.target.value })}>
              {EE_CONFIDENCE_BANDS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button type="button" className="ee-list-item__btn" onClick={() => remove(i)}>×</button>
          </React.Fragment>
        ))}
      </div>
      <button type="button" className="ee-list-add" onClick={add} style={{ marginTop: 6 }}>+ Add rule</button>
      <span className="ee-field__hint">
        Example: <code style={{ fontSize: 11 }}>"strength increased by +3"</code> → increase Strength by 3 with <b>blue</b> confidence.
      </span>
    </div>
  );
};

// ----- Test phrase tool -----
const EETestPhrase = ({ field, all, lbl }) => {
  const [phrase, setPhrase] = _ee_us("She held the line through the long night.");
  const [result, setResult] = _ee_us(null);
  const runTest = () => {
    const rules = all?.extractionRules || [];
    let matched = null;
    for (const r of rules) {
      const p = (r.phrase || "").toLowerCase().replace(/\+n|\-n/g, "").trim();
      if (p && phrase.toLowerCase().includes(p)) { matched = r; break; }
    }
    setResult({
      stat: all?.name || "—",
      phrase,
      matched,
      confidence: matched?.confidence || "orange",
      effect: matched?.effect || "needs-review",
      value: matched?.value || "—",
    });
  };
  return (
    <div className="ee-field" style={{ gridColumn: "1 / -1" }}>
      {lbl}
      <div className="ee-testphrase">
        <div style={{ display: "flex", gap: 6 }}>
          <input className="ee-input" style={{ flex: 1 }} placeholder="Paste or type a manuscript phrase…" value={phrase} onChange={(e) => setPhrase(e.target.value)}/>
          <button type="button" className="ee-btn ee-btn--outline" onClick={runTest}>
            <Icon name="sparkle" size={11}/> Test
          </button>
        </div>
        {result && (
          <div className="ee-testphrase__result">
            <div className="ee-testphrase__row"><span className="ee-testphrase__row__k">Stat</span><span>{result.stat}</span></div>
            <div className="ee-testphrase__row"><span className="ee-testphrase__row__k">Detected</span><span>{result.matched ? <em>"{result.matched.phrase}"</em> : <span style={{ color: "var(--ink-4)" }}>No rule matched — would surface as needs-review.</span>}</span></div>
            <div className="ee-testphrase__row"><span className="ee-testphrase__row__k">Effect</span><span>{result.effect} {result.value !== "—" ? "(" + result.value + ")" : ""}</span></div>
            <div className="ee-testphrase__row"><span className="ee-testphrase__row__k">Confidence</span><ConfidenceBadge level={result.confidence === "blue" ? "high" : result.confidence === "green" ? "strong" : result.confidence === "orange" ? "uncertain" : "weak"} value={result.matched ? 88 : 41}/></div>
            <div className="ee-testphrase__row"><span className="ee-testphrase__row__k">Would queue as</span>
              <span style={{ display: "flex", gap: 6 }}>
                <span className="ee-list-item__chip">Accept</span>
                <span className="ee-list-item__chip">Edit</span>
                <span className="ee-list-item__chip">Merge</span>
                <span className="ee-list-item__chip">Deny</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Section (collapsible)
// ---------------------------------------------------------------------
const EESection = ({ section, data, setData, ctx }) => {
  const [collapsed, setCollapsed] = _ee_us(!!section.collapsed);
  return (
    <div className="ee-sec" data-collapsed={collapsed ? "true" : "false"}>
      <div className="ee-sec__head" onClick={() => setCollapsed((v) => !v)} style={{ cursor: "pointer" }}>
        <span className="ee-sec__title">{section.title}</span>
        {section.hint && <span className="ee-sec__hint">{section.hint}</span>}
        <button type="button" className="ee-sec__toggle" aria-label={collapsed ? "Expand" : "Collapse"}>
          <Icon name={collapsed ? "chevron-d" : "chevron-up"} size={12}/>
        </button>
      </div>
      <div className="ee-sec__body">
        <div className={"ee-sec__row " + (section.fields.length > 1 ? "ee-sec__row--2" : "")}>
          {section.fields.map((f) => (
            <EEField key={f.id}
              field={f}
              value={data[f.id]}
              onChange={(v) => setData({ [f.id]: v })}
              all={data}
              ctx={ctx}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Mode renderers
// ---------------------------------------------------------------------

// Quick: first 5 fields of first 2 sections, flat.
const EEQuick = ({ config, data, setData, ctx }) => {
  const flat = [];
  for (const sec of config.sections) {
    for (const f of sec.fields) {
      flat.push(f);
      if (flat.length >= 6) break;
    }
    if (flat.length >= 6) break;
  }
  return (
    <div className="ee-sec">
      <div className="ee-sec__head">
        <span className="ee-sec__title">Quick Create</span>
        <span className="ee-sec__hint">Just the essentials — you can flesh out the rest later.</span>
      </div>
      <div className="ee-sec__body">
        <div className="ee-sec__row ee-sec__row--2">
          {flat.map((f) => (
            <EEField key={f.id} field={f} value={data[f.id]} onChange={(v) => setData({ [f.id]: v })} all={data} ctx={ctx}/>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg-paper)", border: "1px dashed var(--line-2)", borderRadius: "var(--r-3)", fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>
        Need more depth? Switch to <b>Full Editor</b> above — all of <i>{config.displayName.toLowerCase()}</i>'s fields are there.
      </div>
    </div>
  );
};

const EEFull = ({ config, data, setData, ctx }) => {
  const useSidebar = config.layout === "sidebar" && (config.sections || []).length > 4;
  const [activeId, setActiveId] = _ee_us(useSidebar ? (config.sections[0]?.id || "") : "");
  const scrollRef = _ee_ur(null);

  if (!useSidebar) {
    return (
      <>
        {config.sections.map((s) => (
          <EESection key={s.id} section={s} data={data} setData={setData} ctx={ctx}/>
        ))}
      </>
    );
  }

  // Sidebar layout: section nav (left) + scrollable body (right).
  const scrollToSec = (id) => {
    setActiveId(id);
    const root = scrollRef.current;
    if (!root) return;
    const el = root.querySelector('[data-sec="' + id + '"]');
    if (el && typeof el.scrollIntoView === "function") {
      // scroll inside container, not the whole page
      const top = el.offsetTop - 8;
      if (root.scrollTo) root.scrollTo({ top, behavior: "smooth" });
      else root.scrollTop = top;
    }
  };

  // Track which section is most-visible while scrolling.
  _ee_ue(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      const top = root.scrollTop;
      let bestId = activeId;
      let bestDist = Infinity;
      (config.sections || []).forEach((s) => {
        const el = root.querySelector('[data-sec="' + s.id + '"]');
        if (!el) return;
        const dist = Math.abs(el.offsetTop - top - 20);
        if (dist < bestDist) { bestDist = dist; bestId = s.id; }
      });
      if (bestId !== activeId) setActiveId(bestId);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [config.sections]);

  return (
    <div className="ee-sidebar-wrap">
      <nav className="ee-sidebar-nav" aria-label="Sections">
        {(config.sections || []).map((s, i) => (
          <button key={s.id} type="button"
            className={"ee-sidebar-nav__row " + (activeId === s.id ? "is-on" : "")}
            onClick={() => scrollToSec(s.id)}>
            <span className="ee-sidebar-nav__no">{String(i + 1).padStart(2, "0")}</span>
            <span className="ee-sidebar-nav__label">{s.title}</span>
          </button>
        ))}
      </nav>
      <div className="ee-sidebar-body" ref={scrollRef}>
        {config.sections.map((s) => (
          <div key={s.id} data-sec={s.id}>
            <EESection section={s} data={data} setData={setData} ctx={ctx}/>
          </div>
        ))}
      </div>
    </div>
  );
};

// AI-assisted draft
const EEAIDraft = ({ config, data, setData, ctx }) => {
  const [prompt, setPrompt] = _ee_us("");
  const [generating, setGenerating] = _ee_us(false);
  const [draft, setDraft] = _ee_us(null);
  const generate = () => {
    setGenerating(true);
    setDraft(null);
    setTimeout(() => {
      const canned = EE_AI_DRAFTS[config.type] || EE_AI_DRAFTS.locations;
      setDraft(canned);
      setGenerating(false);
    }, 1100);
  };
  const applyDraft = () => {
    if (!draft) return;
    setData(draft);
  };
  return (
    <div className="ee-sec">
      <div className="ee-sec__head">
        <span className="ee-sec__title">AI-Assisted Draft</span>
        <span className="ee-ai-badge"><Icon name="sparkle" size={9}/> Preview / simulated</span>
      </div>
      <div className="ee-sec__body">
        <div className="ee-field" style={{ gridColumn: "1 / -1" }}>
          <span className="ee-field__lbl">Describe what you want</span>
          <textarea
            className="ee-textarea ee-textarea--lg"
            placeholder={"e.g. A " + config.displayName.toLowerCase() + " that " + (config.defaultSummary || "fits this story")}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <span className="ee-field__hint">No real model is wired in this build — generate shows a fixed canned draft you can accept, edit, or discard.</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button type="button" className="ee-btn ee-btn--primary" onClick={generate} disabled={generating}>
            <Icon name="sparkle" size={12}/>
            {generating ? "Generating draft…" : "Generate draft"}
          </button>
          {draft && (
            <button type="button" className="ee-btn ee-btn--accent" onClick={applyDraft}>
              <Icon name="check" size={11}/> Apply draft to fields
            </button>
          )}
          {draft && (
            <button type="button" className="ee-btn ee-btn--ghost" onClick={() => setDraft(null)}>Discard</button>
          )}
        </div>
        {generating && (
          <div style={{ marginTop: 14 }}>
            <LoadingState title="Drafting…" lines={5}/>
          </div>
        )}
        {draft && (
          <div className="ee-review-block" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="ee-ai-badge"><Icon name="sparkle" size={9}/> Simulated draft</span>
              <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>Edit any field after applying — this is just a starting point.</span>
            </div>
            {Object.entries(draft).map(([k, v]) => (
              <div key={k} className="ee-review-row">
                <span className="ee-review-row__k">{k}</span>
                <span className="ee-review-row__v">
                  {Array.isArray(v) ? v.map((x, i) => (
                    <span key={i} className="ee-list-item__chip" style={{ marginRight: 4 }}>{typeof x === "object" ? JSON.stringify(x).slice(0, 60) : x}</span>
                  )) : (typeof v === "object" ? JSON.stringify(v) : String(v))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Paste JSON — enhanced with per-type templates + AI Handoff button.
const EEPasteJSON = ({ config, data, setData }) => {
  const [text, setText] = _ee_us("");
  const [banner, setBanner] = _ee_us(null);
  const validate = () => {
    if (!text.trim()) { setBanner({ kind: "warn", text: "Paste a JSON object to validate." }); return; }
    try {
      const obj = JSON.parse(text);
      if (typeof obj !== "object" || Array.isArray(obj) || obj === null) throw new Error("Top-level must be an object.");
      setBanner({ kind: "ok", text: "Valid JSON · " + Object.keys(obj).length + " field" + (Object.keys(obj).length === 1 ? "" : "s") + " parsed." });
    } catch (err) {
      setBanner({ kind: "err", text: "Invalid JSON · " + err.message });
    }
  };
  const apply = () => {
    try {
      const obj = JSON.parse(text);
      setData(obj);
      setBanner({ kind: "ok", text: "Applied. Switch to Review or Full Editor to verify before saving." });
    } catch (err) {
      setBanner({ kind: "err", text: "Cannot apply — " + err.message });
    }
  };
  const copyTemplate = () => {
    const tpl = (typeof window.eeJsonTemplate === "function") ? window.eeJsonTemplate(config.type) : (EE_AI_DRAFTS[config.type] || EE_AI_DRAFTS.locations);
    const s = JSON.stringify(tpl, null, 2);
    setText(s);
    try { navigator.clipboard && navigator.clipboard.writeText(s); } catch (e) {}
    setBanner({ kind: "ok", text: "Blank template (with placeholder hints) copied and loaded below." });
  };
  const copyCurrent = () => {
    const cur = (typeof window.eeJsonCurrent === "function") ? window.eeJsonCurrent(data) : data;
    const s = JSON.stringify(cur, null, 2);
    setText(s);
    try { navigator.clipboard && navigator.clipboard.writeText(s); } catch (e) {}
    setBanner({ kind: "ok", text: "Current entity copied to clipboard." });
  };
  const copyPrompt = () => {
    const prompt = (typeof window.eeAIFillPrompt === "function") ? window.eeAIFillPrompt(config.type, data) : "";
    try { navigator.clipboard && navigator.clipboard.writeText(prompt); } catch (e) {}
    setBanner({ kind: "ok", text: "AI fill-in prompt copied. Paste it into any external AI to get a completed dossier." });
  };
  return (
    <div className="ee-sec">
      <div className="ee-sec__head">
        <span className="ee-sec__title">JSON · External AI handoff</span>
        <span className="ee-sec__hint">Copy a template, work with external AI, paste the result back. No in-app API tokens used.</span>
      </div>
      <div className="ee-sec__body">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <button type="button" className="ee-btn ee-btn--outline" onClick={copyTemplate} data-callback="onCopyEntityJsonTemplate">
            <Icon name="code" size={11}/> Copy blank template
          </button>
          <button type="button" className="ee-btn ee-btn--outline" onClick={copyCurrent} data-callback="onExportCurrentEntity">
            <Icon name="download" size={11}/> Copy current entity JSON
          </button>
          <button type="button" className="ee-btn ee-btn--accent" onClick={copyPrompt} data-callback="onCopyEntityFillPrompt">
            <Icon name="sparkle" size={11}/> Copy AI fill prompt
          </button>
          {typeof AIHandoffButton !== "undefined" && (
            <AIHandoffButton
              surface="entity-editor"
              variant="primary"
              label="Open AI Handoff"
              icon="sparkle"
              context={{
                selectedEntities: [{ id: data && data.id, type: config.type, name: data && (data.name || data.title), dossier: data }],
                outputType: "entity",
                instructions: "Fill in this " + config.displayName + " dossier as a SINGLE JSON object matching the schema. Return only the JSON.",
                projectContext: {},
              }}
              onApplyResult={(payload) => {
                if (payload && payload.result && typeof payload.result === "object" && !Array.isArray(payload.result)) {
                  const candidate = payload.result.entityUpdates && payload.result.entityUpdates[0] && payload.result.entityUpdates[0].patch
                                    ? payload.result.entityUpdates[0].patch
                                    : payload.result;
                  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
                    setData({ ...(data || {}), ...candidate });
                    setBanner({ kind: "ok", text: "Imported AI result applied. Verify in Review before saving." });
                  }
                }
              }}
            />
          )}
        </div>

        <textarea
          className="ee-textarea ee-textarea--xl ee-textarea--mono"
          placeholder={'Paste JSON here, or click "Copy blank template" to start.'}
          value={text}
          onChange={(e) => { setText(e.target.value); if (banner) setBanner(null); }}
        />
        {banner && (
          <div className={"ee-json-banner ee-json-banner--" + banner.kind}>{banner.text}</div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" className="ee-btn ee-btn--outline" onClick={validate} data-callback="onValidateEntityJson"><Icon name="check" size={11}/> Validate</button>
          <button type="button" className="ee-btn ee-btn--primary" onClick={apply} data-callback="onApplyEntityJsonToEditor"><Icon name="bolt" size={11}/> Apply to fields</button>
        </div>

        <div style={{ marginTop: 14, padding: "8px 10px", background: "var(--bg-paper-2)", border: "1px dashed var(--line-2)", borderRadius: "var(--r-3)", fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", lineHeight: 1.5 }}>
          <b style={{ color: "var(--ink-2)", fontStyle: "normal" }}>Token-saving tip:</b> Use <b>Copy AI fill prompt</b> to send only the template + instructions to an external AI. Skip dossier-heavy context unless you need it.
        </div>
      </div>
    </div>
  );
};

// Review Before Save — read-only preview of what will be saved.
const EEReview = ({ config, data }) => {
  const t = ENTITY_TYPES[config.type];
  const linkedCount = (k) => Array.isArray(data[k]) ? data[k].length : (data[k] ? 1 : 0);
  return (
    <>
      <div className="ee-review-block">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
          {t && <EntityTypeBadge type={config.type} size="sm"/>}
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-1)" }}>{data.name || data.title || "Untitled " + config.displayName.toLowerCase()}</div>
          {data.entityStatus && <EntityStatusPill status={data.entityStatus}/>}
          {data.status && !data.entityStatus && <EntityStatusPill status={data.status}/>}
        </div>
        {data.summary && (
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", marginBottom: 14, lineHeight: 1.55 }}>{data.summary}</div>
        )}
        {config.sections.map((sec) => {
          const populated = sec.fields.filter((f) => {
            const v = data[f.id];
            if (v == null || v === "") return false;
            if (Array.isArray(v) && v.length === 0) return false;
            return true;
          });
          if (populated.length === 0) return null;
          return (
            <div key={sec.id} style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed var(--line-1)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--ink-1)", marginBottom: 6 }}>{sec.title}</div>
              {populated.map((f) => (
                <div key={f.id} className="ee-review-row">
                  <span className="ee-review-row__k">{f.label}</span>
                  <span className="ee-review-row__v">
                    {Array.isArray(data[f.id])
                      ? (data[f.id].length === 0 ? "—" :
                        data[f.id].map((x, i) => (
                          <span key={i} className="ee-list-item__chip" style={{ marginRight: 4, marginBottom: 4 }}>
                            {typeof x === "object" ? (x.name || x.label || x.target || x.title || x.trigger || JSON.stringify(x).slice(0, 30)) : String(x)}
                          </span>
                        )))
                      : (typeof data[f.id] === "object" ? (data[f.id].name || JSON.stringify(data[f.id])) : String(data[f.id]))}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div className="ee-aside-card">
          <div className="ee-aside-card__head"><span className="ee-aside-card__title">Cross-panel links</span></div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {["characters","quests","events","items","locations","factions","relatedSkills","relatedItems","linkedCast"].filter((k) => linkedCount(k) > 0).map((k) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</span>
                <span>{linkedCount(k)}</span>
              </div>
            ))}
            {linkedCount("characters") + linkedCount("quests") + linkedCount("events") + linkedCount("items") + linkedCount("locations") + linkedCount("factions") === 0 &&
              <span style={{ fontStyle: "italic", color: "var(--ink-4)" }}>No linked entities yet.</span>}
          </div>
        </div>
        <div className="ee-aside-card">
          <div className="ee-aside-card__head"><span className="ee-aside-card__title">Validation</span></div>
          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>
            {!data.name && !data.title && <div style={{ color: "#8f3a2b" }}>⚠ Missing name/title</div>}
            {!data.summary && <div style={{ color: "#93530f" }}>! No summary — saving will produce a draft.</div>}
            {(data.name || data.title) && data.summary && <div style={{ color: "#3e6a3e" }}>✓ Required fields present</div>}
          </div>
        </div>
        <div className="ee-aside-card">
          <div className="ee-aside-card__head"><span className="ee-aside-card__title">After save</span></div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.55 }}>
            Use <b>Save as Draft</b> to keep it hidden from extraction.<br/>
            <b>Save</b> publishes the entity as Active.<br/>
            <b>Save + Add to Composition</b> drops it into the Writer's Room overlay.
          </div>
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------
// Main container
// ---------------------------------------------------------------------
const EntityEditor = ({
  open,
  type,
  initial,            // initial field values { name?, ... } — e.g. when promoting a queue candidate
  mode: initialMode,  // optional start mode
  promoteFrom,        // optional candidate object (shows up as eyebrow)
  onClose,
  onSave,             // (payload, { mode: "draft" | "active" | "compose" })
  onSaveAndCompose,
}) => {
  const config = (window.ENTITY_EDITOR_CONFIGS && window.ENTITY_EDITOR_CONFIGS[type]) || window.ENTITY_EDITOR_CONFIGS?.generic;
  const [mode, setMode] = _ee_us(initialMode || "full");
  const [data, setData] = _ee_us({});

  // When opening, reset data + apply initial. The form state is FLAT
  // (data[field.id]); persisted entities nest custom fields under
  // entity.data — so hydrate by id when only an id is passed, and
  // flatten any entity-shaped initial (id-hydrated record, prefill with
  // a nested data block) into the form shape.
  _ee_ue(() => {
    if (!open) return;
    let init = initial || {};
    const ES = (typeof window !== "undefined") && window.LoomwrightBackend?.EntityService;
    if (init.id && ES) {
      const ent = ES.getSync(init.id, type);
      if (ent) init = { ...ent, ...init };
    }
    if (init.data && typeof init.data === "object" && !Array.isArray(init.data)) {
      const { data: nested, ...rest } = init;
      init = { ...nested, ...rest };
      delete init.data;
    }
    setData(init);
    setMode(initialMode || "full");
  }, [open, initial, initialMode, type]);

  const update = _ee_uc((patch) => setData((d) => ({ ...d, ...patch })), []);

  // Esc to close.
  _ee_ue(() => {
    if (!open) return;
    // Listen at capture phase + stop propagation so Escape only closes
    // the top-most layer (the editor) — not the workspace beneath it.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      e.preventDefault();
      onClose && onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || !config) return null;

  const ctx = { type, all: data };
  const payload = () => ({
    entityType: type,
    payload: data,
    createdViaMode: mode,
    promoteFrom: promoteFrom || null,
  });

  const handleSave = (saveMode) => {
    if (onSave) onSave(payload(), { mode: saveMode });
    if (saveMode === "compose" && onSaveAndCompose) onSaveAndCompose(payload());
    onClose && onClose();
  };

  return (
    <>
      <div className="ee-backdrop" onClick={onClose}/>
      <div className="ee-root" data-ui="EntityEditor" data-entity-type={type} role="dialog" aria-modal="true" aria-label={"Create " + config.displayName}>
        {/* Header */}
        <div className="ee-head">
          <div className="ee-head__icon">{config.displayName?.[0] || "·"}</div>
          <div className="ee-head__titles">
            <div className="ee-head__eyebrow">
              {promoteFrom ? "Promote from extraction · " + (promoteFrom.confidence?.band || "review") : config.eyebrow}
            </div>
            <div className="ee-head__title">{data.name || data.title || "New " + config.displayName.toLowerCase()}</div>
            {data.summary && <div className="ee-head__sub">"{(data.summary || "").slice(0, 100)}{data.summary.length > 100 ? "…" : ""}"</div>}
          </div>
          <div className="ee-head__actions">
            <button type="button" className="ee-btn ee-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="ee-head__close" onClick={onClose} aria-label="Close editor"><Icon name="close" size={14}/></button>
          </div>
        </div>

        {/* Start from a template (creating only) */}
        {!data.id && (() => {
          const TS = (typeof window !== "undefined") && window.LoomwrightBackend?.TemplateService;
          const tpls = TS ? TS.listSync({ kind: "entity", entityType: type }) : [];
          if (!tpls.length) return null;
          return (
            <div className="ee-templates" data-ui="EeTemplateStrip">
              <span className="ee-templates__lbl">Start from</span>
              {tpls.slice(0, 8).map((t) => (
                <button key={t.id} type="button" className="ee-templates__chip"
                        data-testid={"ee-template-" + t.id}
                        title={(t.genre ? t.genre + " · " : "") + (t.fields?.summary || "")}
                        onClick={() => {
                          const init = TS.entityInitialFrom(t) || {};
                          setData((d) => ({ ...init, name: d.name || "" }));
                        }}>
                  {t.genre ? t.genre + " · " : ""}{t.name}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Mode tabs */}
        <div className="ee-tabs" role="tablist">
          {EE_MODES.map((m) => (
            <button key={m.id} type="button"
              role="tab" aria-selected={mode === m.id}
              className={"ee-tab " + (mode === m.id ? "is-active" : "")}
              data-callback="onSetEditorMode"
              onClick={() => setMode(m.id)}
              title={m.hint}
            >
              <Icon name={m.icon} size={11}/>{m.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="ee-body">
          <div className="ee-body__main">
            {mode === "quick"  && <EEQuick    config={config} data={data} setData={update} ctx={ctx}/>}
            {mode === "full"   && <EEFull     config={config} data={data} setData={update} ctx={ctx}/>}
            {mode === "ai"     && <EEAIDraft  config={config} data={data} setData={update} ctx={ctx}/>}
            {mode === "json"   && <EEPasteJSON config={config} data={data} setData={update}/>}
            {mode === "review" && <EEReview   config={config} data={data}/>}
          </div>
          <aside className="ee-body__aside">
            <div className="ee-aside-card">
              <div className="ee-aside-card__head">
                <span className="ee-aside-card__title">Live preview</span>
                <span className="ee-aside-card__sub">{config.displayName}</span>
              </div>
              <div className="ee-aside-preview-name">{data.name || data.title || "Untitled"}</div>
              <div className="ee-aside-preview-sub">{data.summary || "—"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {(data.aliases || []).slice(0, 4).map((a, i) => <span key={i} className="ee-list-item__chip">{a}</span>)}
                {(data.tags || []).slice(0, 4).map((a, i) => <span key={"t" + i} className="ee-list-item__chip" style={{ fontStyle: "italic" }}>#{a}</span>)}
              </div>
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--line-1)" }}>
                <EntityStatusPill status={data.status || data.entityStatus || "draft"}/>
              </div>
            </div>
            <div className="ee-aside-card">
              <div className="ee-aside-card__head"><span className="ee-aside-card__title">Modes</span></div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.55 }}>
                {EE_MODES.map((m) => (
                  <div key={m.id} onClick={() => setMode(m.id)} style={{ padding: "4px 6px", borderRadius: 4, cursor: "pointer", background: mode === m.id ? "var(--accent-soft)" : "transparent", color: mode === m.id ? "var(--accent-deep)" : "inherit" }}>
                    <b>{m.label}</b>
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{m.hint}</div>
                  </div>
                ))}
              </div>
            </div>
            {promoteFrom && (
              <div className="ee-aside-card">
                <div className="ee-aside-card__head"><span className="ee-aside-card__title">Source</span></div>
                <div style={{ fontSize: 12, color: "var(--ink-2)" }}>
                  <div><b>From extraction</b></div>
                  {promoteFrom.sourceChapter && <div>Ch. {promoteFrom.sourceChapter.num}</div>}
                  {promoteFrom.mention && <blockquote style={{ fontStyle: "italic", margin: "6px 0", color: "var(--ink-3)" }}>"{promoteFrom.mention}"</blockquote>}
                  {promoteFrom.confidence && (
                    <ConfidenceBadge level={promoteFrom.confidence.band} value={promoteFrom.confidence.value}/>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Footer */}
        <div className="ee-foot">
          <div className="ee-foot__hint">
            {data.name || data.title ? (
              <>Saving as <b>{data.name || data.title}</b> · <span style={{ textTransform: "uppercase", letterSpacing: 0.08 + "em" }}>{config.type}</span></>
            ) : (
              <>Pick a name to enable save.</>
            )}
          </div>
          <div className="ee-foot__actions">
            <button type="button" className="ee-btn ee-btn--ghost" onClick={onClose}>Cancel</button>
            {data.id && (
              <button type="button" className="ee-btn ee-btn--outline" data-callback="onFillEntityFromManuscript" data-testid="ee-fill-from-ms"
                title="Suggest values for empty fields from this entity's manuscript mentions (lands in Review)"
                onClick={() => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onFillEntityFromManuscript", detail: { entityId: data.id, entityType: type } } }))}>
                <Icon name="sparkle" size={11}/> Fill from manuscript
              </button>
            )}
            <button type="button" className="ee-btn ee-btn--outline" data-testid="ee-save-template"
              disabled={!(data.name || data.title)}
              title="Snapshot these fields (minus the name) as a reusable template for this type"
              onClick={async () => {
                const TS = window.LoomwrightBackend?.TemplateService;
                if (!TS) return;
                const IDENTITY = new Set(["id", "name", "title", "summary", "aliases", "glyphChar", "status", "kind", "type", "entityType", "content", "sourceMentions", "reviewQueueCount", "source", "createdAt", "updatedAt", "chapterId", "data"]);
                const tplData = {};
                for (const [k, v] of Object.entries(data)) if (!IDENTITY.has(k)) tplData[k] = v;
                await TS.saveEntityTemplate({
                  name: (data.name || data.title || config.displayName) + " template",
                  entityType: type,
                  fields: { summary: data.summary || "", data: tplData },
                });
                try { window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: "Template saved — it appears in the Start-from strip for new " + config.displayName.toLowerCase() + " entries." } })); } catch (_e) {}
              }}>
              <Icon name="stack" size={11}/> Save as template
            </button>
            <button type="button" className="ee-btn ee-btn--outline" data-callback="onSaveEntityDraft" onClick={() => handleSave("draft")}>
              <Icon name="bookmark" size={11}/> Save as Draft
            </button>
            <button type="button" className="ee-btn ee-btn--primary" data-callback="onSaveEntity" onClick={() => handleSave("active")} disabled={!(data.name || data.title)}>
              <Icon name="check" size={11}/> Save (Active)
            </button>
            <button type="button" className="ee-btn ee-btn--accent" data-callback="onSaveAndAddToComposition" onClick={() => handleSave("compose")} disabled={!(data.name || data.title)} title="Save and drop into the Writer's Room composition overlay">
              <Icon name="sparkle" size={11}/> Save + Add to Composition
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { EntityEditor, EE_MODES });
