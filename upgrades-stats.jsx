// =====================================================================
// upgrades-stats.jsx — Stats upgrade with first-class phrase rule editor
// + test phrase tool. Plus a dedicated StatsPanelBody.
//
// The rule engine here is deliberately simple — it pattern-matches the
// test sentence against each rule's phrase shape and returns a
// proposed review-queue card, so authors can preview what extraction
// would produce.
// =====================================================================

const { useState: _sx_us, useMemo: _sx_um, useCallback: _sx_uc } = React;

// ---------------------------------------------------------------------
// Enriched stat data — overrides rpg-entities.jsx's RPG_STAT_DATA
// ---------------------------------------------------------------------
const STATS_DATA = [
  {
    id: "s1", type: "stats", name: "Resolve", glyphChar: "Re",
    subtitle: "How long a will holds in the cold",
    summary: "How far a character will go before they fold. Used in Cast and Faction sheets; gates several Ch. 7 outcomes.",
    valueType: "number", defaultValue: 10, min: 1, max: 20,
    appliesTo: ["cast", "factions", "bestiary"],
    chapterRange: "Ch. 1–7",
    mentionsByChapter: [1,0,1,0,2,1,3,0,0,0,0,0],
    extractionRules: [
      { id: "sr1", phrase: "resolve increased by +N",   matchType: "numeric pattern",  effect: "increase", value: "+N",        confidence: "blue",   active: true,
        example: "Her resolve increased by 2." },
      { id: "sr2", phrase: "held the line",              matchType: "exact phrase",     effect: "qualitative_inc", value: "+1 (suggested)", confidence: "green",  active: true,
        example: "She held the line." },
      { id: "sr3", phrase: "could not bear it",          matchType: "exact phrase",     effect: "qualitative_dec", value: "−1 (suggested)", confidence: "orange", active: true,
        example: "He could not bear it any longer." },
      { id: "sr4", phrase: "barely able to lift",        matchType: "contains phrase",  effect: "qualitative_dec", value: "−2 (suggested)", confidence: "red",    active: false,
        example: "She was barely able to lift the case." },
    ],
    history: [
      { chapter: 1, subject: "Aelinor Vey",  delta: +1,                       cite: "Ch. 1, p. 14" },
      { chapter: 5, subject: "Captain Brec", qualitative: "held the line",    cite: "Ch. 5, p. 122" },
      { chapter: 7, subject: "Aelinor Vey",  delta: -2,                       cite: "Ch. 7, p. 188" },
    ],
    linkedAbilities: [{ id: "ab1", type: "abilities", label: "Court tongue" }],
    usedByCharacters: [
      { id: "c1", type: "cast", label: "Aelinor Vey" },
      { id: "c3", type: "cast", label: "Captain Brec" },
    ],
    itemsAffecting: [{ id: "i1", type: "items", label: "Bone Auger" }],
    sourceMentions: [
      { id: "m1", excerpt: "She held the line.", cite: "Ch. 5, p. 122" },
      { id: "m2", excerpt: "He could not bear it.", cite: "Ch. 7, p. 188" },
    ],
    queue: 1,
  },
  {
    id: "s2", type: "stats", name: "Cunning", glyphChar: "Cu",
    subtitle: "Reading the room before it is read",
    summary: "Awareness, manipulation, and the patience to wait for the right moment.",
    valueType: "number", defaultValue: 10, min: 1, max: 20,
    appliesTo: ["cast"],
    chapterRange: "Ch. 3, 7",
    mentionsByChapter: [0,0,1,0,0,0,2,0,0,0,0,0],
    extractionRules: [
      { id: "sr5", phrase: "cunning increased by +N", matchType: "numeric pattern", effect: "increase", value: "+N", confidence: "blue", active: true, example: "Her cunning increased by 1." },
      { id: "sr6", phrase: "saw it before any",       matchType: "exact phrase",    effect: "qualitative_inc", value: "+1 (suggested)", confidence: "green", active: true, example: "She saw it before anyone else." },
    ],
    history: [{ chapter: 3, subject: "Saren of Hess", delta: +1, cite: "Ch. 3, p. 80" }],
    linkedAbilities: [{ id: "ab1", type: "abilities", label: "Court tongue" }],
    usedByCharacters: [{ id: "c2", type: "cast", label: "Saren of Hess" }],
    itemsAffecting: [],
    sourceMentions: [],
  },
  {
    id: "s3", type: "stats", name: "Compassion", glyphChar: "Co",
    subtitle: "Choosing kindness when costly",
    summary: "How willing the character is to take the harder, kinder choice.",
    valueType: "number", defaultValue: 10, min: 1, max: 20,
    appliesTo: ["cast"],
    chapterRange: "Ch. 6",
    mentionsByChapter: [0,0,0,0,0,1,0,0,0,0,0,0],
    extractionRules: [
      { id: "sr7", phrase: "stayed her hand", matchType: "exact phrase", effect: "qualitative_inc", value: "+1 (suggested)", confidence: "green", active: true, example: "Aelinor stayed her hand." },
    ],
    history: [{ chapter: 6, subject: "Aelinor Vey", qualitative: "stayed her hand", cite: "Ch. 6, p. 168" }],
    linkedAbilities: [],
    usedByCharacters: [{ id: "c1", type: "cast", label: "Aelinor Vey" }],
    itemsAffecting: [],
    sourceMentions: [],
  },
  {
    id: "s4", type: "stats", name: "Standing", glyphChar: "St",
    subtitle: "Public weight; varies by room",
    summary: "Qualitative weight in court. Tracked as a label, not a number.",
    valueType: "scale", defaultValue: "House-recognized",
    appliesTo: ["cast", "factions"],
    chapterRange: "Ch. 1, 3",
    mentionsByChapter: [1,0,1,0,0,0,0,0,0,0,0,0],
    extractionRules: [
      { id: "sr8", phrase: "received without escort", matchType: "exact phrase", effect: "set_qualitative", value: "Court-recognized",     confidence: "blue",   active: true, example: "Saren received her without escort." },
      { id: "sr9", phrase: "named in the ledger",     matchType: "exact phrase", effect: "set_qualitative", value: "House-recognized",     confidence: "green",  active: true, example: "She was named in the ledger." },
    ],
    history: [
      { chapter: 1, subject: "Aelinor Vey",  qualitative: "House-recognized" },
      { chapter: 3, subject: "Aelinor Vey",  qualitative: "Court-recognized", cite: "Ch. 3, p. 78" },
    ],
    linkedAbilities: [], itemsAffecting: [],
    usedByCharacters: [{ id: "c1", type: "cast", label: "Aelinor Vey" }],
    sourceMentions: [],
  },
];

const STATS_REVIEW = [
  { id: "srq1", entityType: "stats", level: "blue", value: 96,
    candidateType: "exact stat increase",
    name: "Aelinor · Resolve +1",
    suggested: "Apply +1 to Aelinor's Resolve",
    sourceChapter: "Ch. 1", sourceQuote: "Her resolve increased by 1.",
    related: "Resolve",
  },
  { id: "srq2", entityType: "stats", level: "green", value: 82,
    candidateType: "qualitative stat change",
    name: "Brec · 'held the line'",
    suggested: "Apply suggested +1 to Brec's Resolve",
    sourceChapter: "Ch. 5", sourceQuote: "He held the line through the second day.",
    related: "Resolve",
  },
  { id: "srq3", entityType: "stats", level: "orange", value: 64,
    candidateType: "qualitative stat change",
    name: "Brec · 'could not bear it'",
    suggested: "Apply suggested −1 to Brec's Resolve",
    sourceChapter: "Ch. 7", sourceQuote: "He could not bear it, and looked away.",
    related: "Resolve",
    warning: "Conflicts with Ch. 5 increase.",
  },
];

// ---------------------------------------------------------------------
// Match-type / effect-type / confidence labels
// ---------------------------------------------------------------------
const MATCH_TYPES = [
  "exact phrase",
  "contains phrase",
  "synonym group",
  "numeric pattern",
  "qualitative phrase",
  "decrease phrase",
  "increase phrase",
];
const EFFECT_TYPES = [
  { id: "increase",         label: "Increase stat" },
  { id: "decrease",         label: "Decrease stat" },
  { id: "set",              label: "Set stat" },
  { id: "qualitative_inc",  label: "Qualitative ↑" },
  { id: "qualitative_dec",  label: "Qualitative ↓" },
  { id: "set_qualitative",  label: "Set qualitative" },
  { id: "review",           label: "Needs review only" },
];
const CONF_BANDS = [
  { id: "blue",   label: "Blue · Auto" },
  { id: "green",  label: "Green · Strong" },
  { id: "orange", label: "Orange · Uncertain" },
  { id: "red",    label: "Red · Weak" },
];

// ---------------------------------------------------------------------
// Phrase rule engine — pattern-matches a sentence against the rules
// and returns a list of proposed review-queue cards. Deliberately
// simple — exact / contains / numeric "+N" / "-N".
// ---------------------------------------------------------------------
function runStatExtraction(sentence, rules, statName) {
  const s = (sentence || "").toLowerCase();
  if (!s.trim()) return [];
  const out = [];
  for (const r of rules) {
    if (!r.active) continue;
    const phrase = (r.phrase || "").toLowerCase();
    let hit = false;
    let matchedValue = r.value;

    if (r.matchType === "numeric pattern") {
      // Match "STAT increased by +N", "STAT decreased by -N", etc.
      const re = new RegExp(
        (statName || "").toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "\\s+(increased|decreased)\\s+by\\s+([+-]?\\d+)"
      );
      const m = s.match(re);
      if (m) {
        const sign = m[1] === "increased" ? 1 : -1;
        const n = parseInt(m[2], 10);
        const delta = sign * (isNaN(n) ? 0 : n);
        matchedValue = (delta > 0 ? "+" : "") + delta;
        hit = true;
      }
    } else if (r.matchType === "exact phrase") {
      hit = s.includes(phrase);
    } else if (r.matchType === "contains phrase") {
      hit = s.includes(phrase);
    } else {
      // For other match types, fall back to substring.
      hit = s.includes(phrase);
    }
    if (hit) {
      out.push({
        ruleId: r.id,
        phrase: r.phrase,
        effect: r.effect,
        value:  matchedValue,
        confidence: r.confidence,
        candidateType:
          r.effect === "increase" ? "exact stat increase" :
          r.effect === "decrease" ? "exact stat decrease" :
          r.effect === "qualitative_inc" ? "qualitative stat change" :
          r.effect === "qualitative_dec" ? "qualitative stat change" :
          r.effect === "set_qualitative" ? "stat set (qualitative)" :
          r.effect === "set" ? "stat set" : "needs review",
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Phrase rule editor
// ---------------------------------------------------------------------
const StatRuleRow = ({ rule, statName, onEdit, onToggleActive, onDelete }) => {
  return (
    <div className={"stat-rule-row" + (rule.active ? "" : " is-disabled")} data-ui="StatRuleRow">
      <div className="stat-rule-row__phrase">
        <code>{rule.phrase}</code>
      </div>
      <div className="stat-rule-row__match">
        {(EFFECT_TYPES.find((t) => t.id === rule.effect) || {}).label || rule.effect}
      </div>
      <div className="stat-rule-row__value">{rule.value}</div>
      <div className={"stat-rule-row__conf stat-rule-row__conf--" + rule.confidence}>
        {(CONF_BANDS.find((c) => c.id === rule.confidence) || {}).label || rule.confidence}
      </div>
      <div className="stat-rule-row__match">{rule.matchType}</div>
      <div className="stat-rule-row__actions">
        <button className="stat-rule-row__icon"
                data-callback="onToggleStatExtractionRuleActive"
                title={rule.active ? "Disable rule" : "Enable rule"}
                onClick={() => onToggleActive && onToggleActive(rule)}>{rule.active ? "●" : "○"}</button>
        <button className="stat-rule-row__icon"
                data-callback="onEditStatExtractionRule"
                title="Edit rule"
                onClick={() => onEdit && onEdit(rule)}>✎</button>
        <button className="stat-rule-row__icon"
                data-callback="onDeleteStatExtractionRule"
                title="Delete rule"
                onClick={() => onDelete && onDelete(rule)}>✕</button>
      </div>
    </div>
  );
};

const StatRuleEditor = ({ stat, onAddRule, onToggleActive, onEdit, onDelete }) => {
  return (
    <div className="stat-rule-editor" data-ui="StatRuleEditor">
      <div className="stat-rule-editor__head">
        <span>Phrase</span>
        <span>Treated as</span>
        <span>Value</span>
        <span>Confidence</span>
        <span>Match</span>
        <span/>
      </div>
      {(stat.extractionRules || []).map((r) => (
        <StatRuleRow key={r.id} rule={r} statName={stat.name}
                     onEdit={onEdit}
                     onToggleActive={onToggleActive}
                     onDelete={onDelete}/>
      ))}
      {(stat.extractionRules || []).length === 0 && (
        <div style={{ padding: 16, textAlign: "center" }}>
          <span className="rpg-empty">No rules defined. Add one to teach extraction how to parse this stat.</span>
        </div>
      )}
      <div className="stat-rule-add">
        <button className="rpg-btn rpg-btn--primary rpg-btn--small"
                data-callback="onAddStatExtractionRule"
                onClick={onAddRule}>+ Add rule</button>
        <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "var(--fs-xs)", color: "var(--ink-4)" }}>
          Click a phrase to edit. Toggle ● to disable.
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Test phrase tool
// ---------------------------------------------------------------------
const StatTestPhrase = ({ stat }) => {
  const [text, setText] = _sx_us("Her resolve increased by 2 as the storm broke.");
  const results = _sx_um(
    () => runStatExtraction(text, stat.extractionRules || [], stat.name),
    [text, stat]
  );

  const confTone = results[0]?.confidence;
  const tones = { blue: "#3a6db5", green: "#5d7d4e", orange: "#c79545", red: "#a8553f" };
  const cc = tones[confTone] || "var(--line-3)";

  return (
    <div className="stat-test" data-ui="StatTestPhrase" style={{ "--cc": cc }}>
      <div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)", marginBottom: 4 }}>
          Test phrase
        </div>
        <textarea className="stat-test__input"
                  value={text}
                  data-callback="onTestStatPhrase"
                  placeholder="Paste a sentence to see how extraction would treat it…"
                  onChange={(e) => setText(e.target.value)}/>
      </div>

      {results.length === 0 ? (
        <div className="stat-test__result-empty">
          No rule matched. Add or adjust a rule to catch this phrase.
        </div>
      ) : (
        <div className="stat-test__result" style={{ "--cc": cc }}>
          <div className="stat-test__row">
            <span><b>Stat:</b> {stat.name}</span>
            <span><b>Rule:</b> <code style={{ fontFamily: "var(--font-mono)" }}>{results[0].phrase}</code></span>
          </div>
          <div className="stat-test__row">
            <span><b>Effect:</b> {(EFFECT_TYPES.find((t) => t.id === results[0].effect) || {}).label}</span>
            <span><b>Value:</b> <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent-deep)" }}>{results[0].value}</code></span>
            <span><b>Confidence:</b> {(CONF_BANDS.find((c) => c.id === results[0].confidence) || {}).label}</span>
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "var(--fs-sm)", color: "var(--ink-2)" }}>
            Would create review queue card: <b>{results[0].candidateType}</b>
          </div>
          <div className="stat-test__actions">
            <button className="rpg-btn rpg-btn--primary rpg-btn--small" data-callback="onAcceptStatQueueItem">Accept</button>
            <button className="rpg-btn rpg-btn--small" data-callback="onEditStatQueueItem">Edit</button>
            <button className="rpg-btn rpg-btn--small" data-callback="onMergeStatQueueItem">Merge</button>
            <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onDenyStatQueueItem">Deny</button>
          </div>
          {results.length > 1 && (
            <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-4)" }}>
              +{results.length - 1} other rule(s) also matched.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// StatDetail — the upgraded dossier
// ---------------------------------------------------------------------
const StatDetailUpgraded = ({ entity, onSelectEntity, onOpenSourceMention }) => {
  const e = entity || {};
  const [rules, setRules] = _sx_us(e.extractionRules || []);
  // Keep rules synced if the entity changes
  React.useEffect(() => setRules(e.extractionRules || []), [e.id]);

  const stat = { ...e, extractionRules: rules };

  return (
    <div className="rpg-detail" data-ui="StatDetail">
      <RpgFacets items={[
        { k: "Value type", v: e.valueType || "number" },
        { k: "Default",    v: String(e.defaultValue ?? "—") },
        e.min != null ? { k: "Min", v: e.min } : null,
        e.max != null ? { k: "Max", v: e.max } : null,
        { k: "Applies to", v: (e.appliesTo || []).join(", ") || "—" },
        { k: "Rules",      v: rules.length },
      ]}/>

      {e.summary && (
        <RpgSection title="Description">
          <p className="rpg-prose">{e.summary}</p>
        </RpgSection>
      )}

      <RpgSection title="Extraction phrase rules"
                  action={{ label: "Reset to defaults", callback: "onResetStatRules" }}>
        <StatRuleEditor
          stat={stat}
          onAddRule={() => setRules((curr) => [...curr, {
            id: "sr-new-" + (curr.length + 1),
            phrase: "new phrase…",
            matchType: "exact phrase",
            effect: "review",
            value: "—",
            confidence: "orange",
            active: true,
            example: "",
          }])}
          onToggleActive={(r) => setRules((curr) => curr.map((x) => x.id === r.id ? { ...x, active: !x.active } : x))}
          onEdit={() => {}}
          onDelete={(r) => setRules((curr) => curr.filter((x) => x.id !== r.id))}
        />
      </RpgSection>

      <RpgSection title="Test phrase tool"
                  action={{ label: "Try mine →", callback: "onTestStatPhrase" }}>
        <StatTestPhrase stat={stat}/>
      </RpgSection>

      {(e.history || []).length > 0 && (
        <RpgSection title="Recent stat changes">
          <ul className="rpg-history">
            {e.history.map((h, i) => (
              <li key={i} className={"rpg-history__row rpg-history__row--" + (h.delta > 0 ? "up" : h.delta < 0 ? "down" : "qual")}>
                <span className="rpg-history__chap">Ch. {h.chapter}</span>
                <span className="rpg-history__what">
                  <b>{h.subject}</b>{" "}
                  {h.delta > 0 ? "+" + h.delta : h.delta != null ? h.delta : h.qualitative}
                </span>
                {h.cite && (
                  <button className="rpg-history__cite" data-callback="onOpenStatSourceMention"
                          onClick={() => onOpenSourceMention && onOpenSourceMention(h)}>{h.cite}</button>
                )}
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      {(e.usedByCharacters || []).length > 0 && (
        <RpgSection title="Characters using stat"
                    action={{ label: "View all →", callback: "onOpenStatHistory" }}>
          <RpgChipRow items={e.usedByCharacters} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.itemsAffecting || []).length > 0 && (
        <RpgSection title="Items affecting stat">
          <RpgChipRow items={e.itemsAffecting} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.linkedAbilities || []).length > 0 && (
        <RpgSection title="Related abilities">
          <RpgChipRow items={e.linkedAbilities} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.mentionsByChapter || []).length > 0 && (
        <RpgSection title="Mentions by chapter">
          <RpgChapterSpark mentions={e.mentionsByChapter}/>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onAssignStat">Add to character</button>
        <button className="rpg-btn" data-callback="onUpdateStatValue">Set value</button>
        <button className="rpg-btn" data-callback="onUpdateStatValue">Increase</button>
        <button className="rpg-btn" data-callback="onUpdateStatValue">Decrease</button>
        <button className="rpg-btn" data-callback="onAddStatExtractionRule">+ Rule</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onOpenStatHistory">View history</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// StatsPanelBody — bespoke side panel
// ---------------------------------------------------------------------
const StatsPanelBody = ({ panel, onSelectEntity }) => {
  const [selectedId, setSelectedId] = _sx_us("s1");
  const [search, setSearch] = _sx_us("");
  const _src = (window.LoomwrightBackend?.EntityService?.listSync("stats")) || [];
  const filtered = _src.filter((s) => !search || (s.name || "").toLowerCase().includes(search.toLowerCase()));
  const selected = filtered.find((s) => s.id === selectedId) || null;

  return (
    <div className="loc-body" data-ui="StatsPanelBody">
      <div className="loc-body__top">
        <div className="loc-body__search">
          <Icon name="search" size={11}/>
          <input value={search} placeholder="Search stats…" onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <div className="loc-body__filters">
          <Btn variant="ghost" size="sm" icon="plus" data-callback="onCreateStat" title="Create stat"/>
          <Btn variant="ghost" size="sm" icon="bell" data-callback="onOpenStatsReviewQueue" title="Review queue"/>
        </div>
      </div>

      <div className="loc-body__split">
        <aside className="loc-body__tree">
          <div className="loc-body__tree-head">
            <span>Stats</span>
            <span className="loc-body__tree-count">{filtered.length}</span>
          </div>
          <div className="loc-tree">
            {filtered.map((s) => (
              <div key={s.id}
                   className={"loc-tree__row" + (s.id === selectedId ? " is-selected" : "")}
                   onClick={() => { setSelectedId(s.id); onSelectEntity && onSelectEntity({ id: s.id, type: "stats", label: s.name }); }}>
                <span className="loc-tree__glyph" style={{ color: "var(--ec, #5a8a4a)" }}>◐</span>
                <span className="loc-tree__name">{s.name}</span>
                <span className="loc-tree__children">{(s.extractionRules || []).length}r</span>
                {(s.queue || 0) > 0 && <span className="loc-tree__queue">{s.queue}</span>}
              </div>
            ))}
          </div>
          <div className="loc-body__tree-actions">
            <button className="rpg-btn rpg-btn--small" data-callback="onCreateStat">+ Stat</button>
          </div>
        </aside>

        <section className="loc-body__detail">
          {selected ? (
            <>
              <div className="loc-body__detail-head">
                <div>
                  <div className="loc-body__detail-eyebrow">Stat · {selected.valueType}</div>
                  <div className="loc-body__detail-title">{selected.name}</div>
                </div>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
                <StatDetailUpgraded
                  entity={selected}
                  onSelectEntity={onSelectEntity}
                  onOpenSourceMention={() => {}}
                />
              </div>
            </>
          ) : <EmptyState icon="bolt" title="No stat" body="Pick a stat to inspect."/>}
        </section>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------
window.STATS_DATA   = STATS_DATA;
window.STATS_REVIEW = STATS_REVIEW;
window.ENTITY_SAMPLES = window.ENTITY_SAMPLES || {};
window.ENTITY_REVIEW_SAMPLES = window.ENTITY_REVIEW_SAMPLES || {};
window.ENTITY_REVIEW_SAMPLES.stats = STATS_REVIEW;

// Override the detail renderer
window.RPG_DETAIL_RENDERERS = window.RPG_DETAIL_RENDERERS || {};
window.RPG_DETAIL_RENDERERS.stats = (entity, ctx) => <StatDetailUpgraded entity={entity} {...ctx}/>;

Object.assign(window, {
  StatDetailUpgraded, StatsPanelBody, StatRuleEditor, StatRuleRow, StatTestPhrase,
  runStatExtraction, MATCH_TYPES, EFFECT_TYPES, CONF_BANDS,
});
