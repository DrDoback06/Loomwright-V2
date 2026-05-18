// =====================================================================
// onboarding-parts.jsx — Reusable wizard atoms: Field, Pill row, Toggle,
// Slider, Choice card, Helper card, JSON box, Drop zone, Stepper rail,
// Learned-so-far panel, FinalSummaryCard.
// =====================================================================

const { useState: _us_op, useMemo: _um_op, useRef: _ur_op } = React;

// --- Field wrapper ---------------------------------------------------
const Field = ({ label, hint, optional, error, ok, children, className = "" }) => (
  <div className={"ob-field " + className}>
    {label && (
      <div className="ob-field__lbl">
        <span>{label}</span>
        {optional && <span className="ob-field__lbl__opt">— optional</span>}
      </div>
    )}
    {children}
    {hint && !error && !ok && <div className="ob-field__hint">{hint}</div>}
    {error && <div className="ob-field__warn"><Icon name="warn" size={11}/>{error}</div>}
    {ok && <div className="ob-field__ok"><Icon name="check" size={11}/>{ok}</div>}
  </div>
);

// --- Pill row (single or multi) -------------------------------------
const PillRow = ({ value, options, onChange, multi = false, callback }) => {
  const isOn = (o) => multi ? (value || []).includes(o) : value === o;
  const toggle = (o) => {
    if (multi) {
      const set = new Set(value || []);
      set.has(o) ? set.delete(o) : set.add(o);
      onChange && onChange([...set]);
    } else {
      onChange && onChange(o);
    }
  };
  return (
    <div className="ob-pillrow" data-callback={callback}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={"ob-pill " + (isOn(o) ? "is-on" : "")}
          onClick={() => toggle(o)}
        >{o}</button>
      ))}
    </div>
  );
};

// --- Toggle row ------------------------------------------------------
const ToggleRow = ({ label, sub, value, onChange, callback }) => (
  <div
    className={"ob-toggle " + (value ? "is-on" : "")}
    data-callback={callback}
    onClick={() => onChange && onChange(!value)}
    role="switch"
    aria-checked={!!value}
    tabIndex={0}
  >
    <div className="ob-toggle__sw" aria-hidden/>
    <div className="ob-toggle__txt">
      <div className="ob-toggle__lbl">{label}</div>
      {sub && <div className="ob-toggle__sub">{sub}</div>}
    </div>
  </div>
);

// --- Slider with mark labels ----------------------------------------
const DialSlider = ({ label, value, marks, onChange, callback }) => (
  <Field label={label}>
    <div className="ob-slider" data-callback={callback}>
      <input
        type="range"
        min={0}
        max={marks.length - 1}
        step={1}
        value={value ?? 2}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      />
      <span className="ob-slider__val">{marks[value ?? 2]}</span>
    </div>
  </Field>
);

// --- Choice card grid -----------------------------------------------
const ChoiceCard = ({ icon, title, sub, meta, on, disabled, onClick, callback, tone }) => (
  <button
    type="button"
    className={"ob-choice " + (on ? "is-on " : "") + (disabled ? "is-disabled" : "")}
    onClick={() => !disabled && onClick && onClick()}
    data-callback={callback}
    data-tone={tone}
  >
    <span className="ob-choice__icon"><Icon name={icon} size={16}/></span>
    <span className="ob-choice__body">
      <span className="ob-choice__title">{title}</span>
      <span className="ob-choice__sub">{sub}</span>
      {meta && <span className="ob-choice__meta">{meta}</span>}
    </span>
  </button>
);

// --- Helper / prompt-copy / JSON-import card -------------------------
const HelperCard = ({ title, pill, body, children }) => (
  <div className="ob-helper">
    <div className="ob-helper__head">
      <Icon name="sparkle" size={14}/>
      <div className="ob-helper__title">{title}</div>
      {pill && <span className="ob-helper__pill">{pill}</span>}
    </div>
    {body && <div className="ob-helper__body">{body}</div>}
    {children}
  </div>
);

const CopyPromptCard = ({ prompt, onCopyHelperPrompt }) => {
  const [copied, setCopied] = _us_op(false);
  const doCopy = () => {
    try { navigator.clipboard?.writeText(prompt); } catch (e) {}
    setCopied(true);
    onCopyHelperPrompt && onCopyHelperPrompt(prompt);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <HelperCard
      title="Copy prompt for ChatGPT or Claude"
      pill="optional"
      body="Paste the result back into the JSON box below to fill this step in one go."
    >
      <textarea className="ob-textarea ob-textarea--mono" readOnly value={prompt} rows={6}/>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" size="sm" icon="paper" onClick={doCopy} data-callback="onCopyHelperPrompt">
          {copied ? "Copied to clipboard" : "Copy prompt"}
        </Btn>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)", alignSelf: "center" }}>Loomwright never auto-sends this for you.</span>
      </div>
    </HelperCard>
  );
};

const JsonImportBox = ({ label = "Paste filled JSON here", value, onParseSuccess, onQuickImportJson, onChange }) => {
  const [text, setText] = _us_op(value || "");
  const [status, setStatus] = _us_op({ kind: "idle", msg: "Awaiting paste" });
  const tryParse = (val) => {
    setText(val);
    onChange && onChange(val);
    if (!val.trim()) { setStatus({ kind: "idle", msg: "Awaiting paste" }); return; }
    try {
      const obj = JSON.parse(val);
      const keys = Object.keys(obj).length;
      setStatus({ kind: "ok", msg: keys + " keys parsed" });
      onParseSuccess && onParseSuccess(obj);
      onQuickImportJson && onQuickImportJson(obj);
    } catch (e) {
      setStatus({ kind: "err", msg: "Invalid JSON: " + (e.message || "parse error") });
    }
  };
  return (
    <Field label={label}>
      <textarea
        className="ob-textarea ob-textarea--mono"
        placeholder='{ "premise": "..." }'
        value={text}
        onChange={(e) => tryParse(e.target.value)}
        data-callback="onQuickImportJson"
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span className={"ob-json__status ob-json__status--" + status.kind}>
          <Icon name={status.kind === "ok" ? "check" : status.kind === "err" ? "warn" : "paper"} size={11}/>
          {status.msg}
        </span>
        {status.kind === "err" && <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-4)" }}>Tip: paste the whole JSON object including outer braces.</span>}
      </div>
    </Field>
  );
};

// --- Drop zone (placeholder upload) ---------------------------------
const DropZone = ({ accept = ".txt, .md, .docx", title = "Drop a file or click to upload", hint = "Max 10MB · text files preferred", state = "idle", callback, onFile }) => (
  <div
    className="ob-drop"
    role="button"
    tabIndex={0}
    data-callback={callback}
    onClick={() => onFile && onFile({ name: "sample.txt", state: "pending" })}
  >
    <div className="ob-drop__icon">
      <Icon name={state === "uploaded" ? "check" : state === "pending" ? "clock" : "paper"} size={16}/>
    </div>
    <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", color: "var(--ink-1)" }}>{title}</div>
    <div className="ob-drop__hint">{hint}</div>
    <div className="ob-drop__hint" style={{ fontFamily: "var(--font-mono)" }}>{accept}</div>
  </div>
);

// --- OnboardingStepRail ----------------------------------------------
const OnboardingStepRail = ({ steps, currentId, completedIds, onOnboardingStepChange, projectName, percent }) => {
  return (
    <aside className="ob__rail" data-ui="OnboardingStepRail" aria-label="Onboarding steps">
      <div className="ob__rail__head">
        <div className="ob__rail__eyebrow">New project ritual</div>
        <div className="ob__rail__title">{projectName || "Untitled project"}</div>
        <div className="ob__rail__progress">
          <div className="ob__rail__bar"><span style={{ width: percent + "%" }}/></div>
          <span>{percent}%</span>
        </div>
      </div>
      <div className="ob__rail__list">
        {steps.map((s) => {
          const active = s.id === currentId;
          const done = completedIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={"ob__step " + (active ? "is-active " : "") + (done ? "is-complete" : "")}
              onClick={() => onOnboardingStepChange && onOnboardingStepChange(s.id)}
              data-callback="onOnboardingStepChange"
              data-step={s.id}
            >
              <span className="ob__step__num">{done ? <Icon name="check" size={12}/> : s.num}</span>
              <span className="ob__step__lbl">{s.title}<small>{s.short}</small></span>
              {s.optional && <span className="ob__step__opt">opt</span>}
            </button>
          );
        })}
      </div>
      <div className="ob__rail__foot">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="lock" size={11}/> Draft autosaves locally
        </span>
        <span style={{ color: "var(--ink-4)" }}>You can revisit any step until you finish.</span>
      </div>
    </aside>
  );
};

// --- LearnedSoFarPanel -----------------------------------------------
const LearnedSoFarPanel = ({ data, embedded = false }) => {
  const groups = [];

  if (data.welcome?.title || data.welcome?.format) {
    groups.push({
      lbl: "Project", n: "01",
      rows: [
        ["Title",   data.welcome?.title || <em>untitled</em>],
        data.welcome?.series && ["Series",  data.welcome.series],
        data.welcome?.book && ["Book",    data.welcome.book],
        data.welcome?.format && ["Format", data.welcome.format],
        data.welcome?.genre && ["Genre",  data.welcome.genre + (data.welcome.subgenre ? " · " + data.welcome.subgenre : "")],
        data.welcome?.audience && ["Audience", data.welcome.audience],
        data.welcome?.length && ["Length",   data.welcome.length],
        data.welcome?.stage && ["Stage",     data.welcome.stage],
      ].filter(Boolean),
    });
  }

  if (data.foundation?.premise || data.foundation?.themes?.length) {
    groups.push({
      lbl: "Story shape", n: "02",
      rows: [
        data.foundation?.premise && ["Premise", data.foundation.premise],
        data.foundation?.logline && ["Logline", data.foundation.logline],
        data.foundation?.toneWords?.length && ["Tone", <span className="ob__learned__chips">{data.foundation.toneWords.map((t) => <span key={t} className="chip chip--neutral">{t}</span>)}</span>],
        data.foundation?.pov && ["POV", data.foundation.pov + (data.foundation.tense ? " · " + data.foundation.tense : "")],
      ].filter(Boolean),
    });
  }

  if (data.style && Object.keys(data.style.dials || {}).length) {
    const dials = data.style.dials || {};
    const summary = STYLE_DIALS.slice(0, 4).map((d) => d.label.toLowerCase() + ": " + d.marks[dials[d.id] ?? 2]).join(" · ");
    groups.push({
      lbl: "Voice dials", n: "03",
      rows: [
        ["Profile", summary],
        data.style.avoid && ["Avoid", data.style.avoid],
      ].filter(Boolean),
    });
  }

  if (data.world?.canonRules?.length || data.world?.factions) {
    groups.push({
      lbl: "World", n: "05",
      rows: [
        data.world?.worldType && ["Type", data.world.worldType],
        data.world?.canonRules?.length && ["Canon", data.world.canonRules.length + " rules"],
        data.world?.forbidden?.length && ["Forbidden", data.world.forbidden.length + " contradictions"],
      ].filter(Boolean),
    });
  }

  if (data.cast?.seeds?.length) {
    groups.push({
      lbl: "Cast", n: "06",
      rows: [["Seeds", <span className="ob__learned__chips">{data.cast.seeds.map((c) => <span key={c.id} className="chip chip--neutral"><EntityTypeBadge type="cast" size="xs" showLabel={false}/>{c.name}</span>)}</span>]],
    });
  }

  if (data.rpg && Object.values(data.rpg.toggles || {}).some(Boolean)) {
    const on = Object.entries(data.rpg.toggles).filter(([, v]) => v).map(([k]) => k);
    groups.push({ lbl: "Tracking", n: "07", rows: [["Enabled", <span className="ob__learned__chips">{on.map((k) => <span key={k} className="chip chip--accent">{k}</span>)}</span>]] });
  }

  if (data.plot?.beats?.length) {
    groups.push({ lbl: "Roadmap", n: "08", rows: [["Beats", data.plot.beats.length + " plotted · " + (data.plot.targetChapters || "?") + " chapters"]] });
  }

  if (data.references?.items?.length) {
    groups.push({ lbl: "References", n: "10", rows: [["Sources", data.references.items.length + " uploaded"]] });
  }

  if (data.ai?.mode) {
    const mode = PRIVACY_CHOICES.find((c) => c.id === data.ai.mode);
    groups.push({
      lbl: "Privacy", n: "11",
      rows: [
        ["Mode", mode?.title || data.ai.mode],
        data.ai.mode === "byok" && data.ai.provider && ["Provider", data.ai.provider],
        ["Manuscript egress", data.ai.allowEgress ? <span style={{ color: "#5e3415" }}>allowed</span> : <span style={{ color: "#2c5a2a" }}>blocked</span>],
      ].filter(Boolean),
    });
  }

  const Wrapper = embedded ? "div" : "aside";
  return (
    <Wrapper className={embedded ? "ob__learned ob__learned--embedded" : "ob__learned"} data-ui="LearnedSoFarPanel">
      {!embedded && (
        <div className="ob__learned__head">
          <div className="ob__learned__title"><Icon name="bookmark" size={14}/> What Loomwright has learned</div>
          <div className="ob__learned__sub">Live summary of your answers. Edit any step from the rail to revise.</div>
        </div>
      )}
      <div className="ob__learned__body">
        {groups.length === 0 ? (
          <div className="ob__learned__empty">
            <div className="ob__learned__seal">{BRAND.shortName}</div>
            Nothing yet. As you fill out steps, Loomwright will compose your project profile here — like a card catalogue forming under the desk.
          </div>
        ) : groups.map((g) => (
          <div key={g.lbl} className="ob__learned__group">
            <div className="ob__learned__group__lbl">{g.lbl} <small>{g.n}</small></div>
            {g.rows.map(([k, v], i) => (
              <div key={i} className="ob__learned__row">
                <div className="ob__learned__row__k">{k}</div>
                <div className="ob__learned__row__v">{v}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Wrapper>
  );
};

// --- FinalSummaryCard tile ------------------------------------------
const FinalSummaryCard = ({ icon = "paper", lbl, title, body, warn, onEdit }) => (
  <div className={"ob-summary__tile " + (warn ? "is-warn" : "")}>
    <button className="ob-summary__tile__edit" onClick={onEdit} data-callback="onOnboardingStepChange">edit</button>
    <div className="ob-summary__tile__lbl">{lbl}</div>
    <div className="ob-summary__tile__head"><Icon name={icon} size={14}/><div className="ob-summary__tile__title">{title}</div></div>
    <div className="ob-summary__tile__body">{body}</div>
  </div>
);

Object.assign(window, {
  Field, PillRow, ToggleRow, DialSlider, ChoiceCard,
  HelperCard, CopyPromptCard, JsonImportBox, DropZone,
  OnboardingStepRail, LearnedSoFarPanel, FinalSummaryCard,
});
