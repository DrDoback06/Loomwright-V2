// =====================================================================
// onboarding-steps.jsx — All 14 step bodies.
// Each step receives (data, set, callbacks) and renders its block.
// =====================================================================

const { useState: _us_st } = React;

// ---- 1. Welcome / Project Setup ------------------------------------
const Step_Welcome = ({ data, set }) => {
  const w = data.welcome || {};
  const upd = (k, v) => set("welcome", { ...w, [k]: v });
  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Project</div>
        <div className="ob-grid ob-grid--2">
          <Field label="Project title" hint="Internal name. You can rename later.">
            <input className="ob-input" placeholder="The Hollow Crown" value={w.title || ""} onChange={(e) => upd("title", e.target.value)} data-callback="onSaveOnboardingDraft"/>
          </Field>
          <Field label="Series" optional hint="Leave blank for stand-alones.">
            <input className="ob-input" placeholder="The Auger Cycle" value={w.series || ""} onChange={(e) => upd("series", e.target.value)}/>
          </Field>
          <Field label="Book / volume" optional>
            <input className="ob-input" placeholder="Book II — Ash & Auger" value={w.book || ""} onChange={(e) => upd("book", e.target.value)}/>
          </Field>
          <Field label="Format">
            <PillRow value={w.format} options={FORMAT_OPTIONS} onChange={(v) => upd("format", v)} callback="onSaveOnboardingDraft"/>
          </Field>
        </div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Audience & shape</div>
        <div className="ob-grid ob-grid--2">
          <Field label="Genre"><PillRow value={w.genre} options={GENRE_OPTIONS} onChange={(v) => upd("genre", v)}/></Field>
          <Field label="Subgenre" optional><PillRow value={w.subgenre} options={SUBGENRE_OPTIONS} onChange={(v) => upd("subgenre", v)}/></Field>
          <Field label="Target audience"><PillRow value={w.audience} options={AUDIENCE_OPTIONS} onChange={(v) => upd("audience", v)}/></Field>
          <Field label="Estimated length"><PillRow value={w.length} options={LENGTH_OPTIONS} onChange={(v) => upd("length", v)}/></Field>
          <Field label="Writing stage"><PillRow value={w.stage} options={STAGE_OPTIONS} onChange={(v) => upd("stage", v)}/></Field>
        </div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Start from</div>
        <div className="ob-choices ob-grid ob-grid--3">
          <ChoiceCard icon="paper" title="Create blank project"   sub="Empty manuscript, blank cast. Build everything from scratch." on={w.start === "blank"}    onClick={() => upd("start", "blank")} callback="onSaveOnboardingDraft"/>
          <ChoiceCard icon="stack" title="Import existing project" sub="Bring in a Loomwright project export (.json)." on={w.start === "import"}   onClick={() => upd("start", "import")}/>
          <ChoiceCard icon="clock" title="Continue previous setup" sub="Resume an autosaved onboarding draft from this device."          on={w.start === "continue"} onClick={() => upd("start", "continue")} meta={<span className="chip chip--info">Last saved 2 min ago</span>}/>
        </div>
        {w.start === "import" && (
          <div className="ob-card ob-import-now" data-ui="ObImportNow" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <div style={{ flex: 1, fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>
              Pick your Loomwright export (.json). The importer validates it, backs up anything already here, and finishes setup for you.
            </div>
            <button className="set-btn set-btn--primary" data-callback="onImportProjectData" data-testid="ob-import-now">
              <Icon name="paper" size={11}/> Choose export file…
            </button>
          </div>
        )}
      </div>
    </>
  );
};

// ---- 2. Story Foundation -------------------------------------------
const Step_Foundation = ({ data, set, callbacks }) => {
  const f = data.foundation || {};
  const upd = (k, v) => set("foundation", { ...f, [k]: v });
  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Premise & shape</div>
        <Field label="Premise" hint="The book in two or three sentences.">
          <textarea className="ob-textarea" rows={3} placeholder="Aelinor Vey, exiled court diviner, is summoned home when the Auger of Hess speaks for the first time in a century…" value={f.premise || ""} onChange={(e) => upd("premise", e.target.value)} data-callback="onSaveOnboardingDraft"/>
        </Field>
        <div className="ob-grid ob-grid--2">
          <Field label="Logline" hint="One sentence. Pitch on the back of a napkin.">
            <textarea className="ob-textarea" rows={2} placeholder="A disgraced diviner returns to a court of liars to interpret a prophecy nobody wants fulfilled." value={f.logline || ""} onChange={(e) => upd("logline", e.target.value)}/>
          </Field>
          <Field label="Core conflict">
            <textarea className="ob-textarea" rows={2} placeholder="Personal vs. political: the truth she sees vs. the throne she once served." value={f.coreConflict || ""} onChange={(e) => upd("coreConflict", e.target.value)}/>
          </Field>
        </div>
        <Field label="Main themes" hint="Pick the load-bearing ones. Add your own. Mark 'not sure' to come back to it.">
          <MultiChoiceOptionGroup
            variant="card"
            value={f.themes || []}
            onChange={(v) => upd("themes", v)}
            metaState={f.themesMeta || {}}
            onMetaChange={(m) => upd("themesMeta", m)}
            options={[
              { id: "Exile",        label: "Exile",        sub: "displacement, return, the one who left" },
              { id: "Inheritance",  label: "Inheritance",  sub: "what is passed down, willed or not" },
              { id: "Faith",        label: "Faith",        sub: "belief tested by evidence" },
              { id: "Witnessing",   label: "Witnessing",   sub: "to see, to record, to refuse to look away" },
              { id: "Power",        label: "Power",        sub: "who holds it, what it costs" },
              { id: "Memory",       label: "Memory",       sub: "the past as a living presence" },
              { id: "Revenge",      label: "Revenge",      sub: "the long arithmetic of harm" },
              { id: "Becoming",     label: "Becoming",     sub: "the self under pressure" },
              { id: "Sacrifice",    label: "Sacrifice",    sub: "what one gives up, willingly" },
              { id: "Forgiveness",  label: "Forgiveness",  sub: "the harder grace" },
            ]}
            callback="onSaveOnboardingDraft"
          />
        </Field>
        <Field label="Tone words" hint="3–5 words. The mood Loomwright should keep on the desk.">
          <MultiChoiceOptionGroup
            variant="chip"
            value={f.toneWords || []}
            onChange={(v) => upd("toneWords", v)}
            options={TONE_WORD_PRESETS}
            metaState={f.toneMeta || {}}
            onMetaChange={(m) => upd("toneMeta", m)}
            callback="onSaveOnboardingDraft"
          />
        </Field>
        <div className="ob-grid ob-grid--2">
          <Field label="Comparable works" hint="Books, films, or shows in your story’s neighborhood.">
            <input className="ob-input" placeholder='e.g. "The Goblin Emperor", "Wolf Hall"' value={f.comparables || ""} onChange={(e) => upd("comparables", e.target.value)}/>
          </Field>
          <Field label="What this story is NOT" optional hint="Negative space — protect against drift.">
            <input className="ob-input" placeholder="Not a quest narrative. Not a chosen-one tale." value={f.isNot || ""} onChange={(e) => upd("isNot", e.target.value)}/>
          </Field>
        </div>
        <div className="ob-grid ob-grid--3">
          <Field label="POV"><PillRow value={f.pov} options={POV_OPTIONS} onChange={(v) => upd("pov", v)}/></Field>
          <Field label="Tense"><PillRow value={f.tense} options={TENSE_OPTIONS} onChange={(v) => upd("tense", v)}/></Field>
          <Field label="Reader experience"><PillRow value={f.readerExperience} options={READER_EXPERIENCE} onChange={(v) => upd("readerExperience", v)}/></Field>
        </div>
        <Field label="POV character" optional hint="Whose eyes do we see through? Seeded as a Character (your lead) when you finish.">
          <input className="ob-input" placeholder="e.g. Aelinor Vey" value={f.povCharacter || ""} onChange={(e) => upd("povCharacter", e.target.value)}/>
        </Field>
      </div>
      <div className="ob-divider"/>
      <HelperCard title="Need help filling this in?" pill="optional" body="Open the JSON tools drawer (right edge) to copy a tailored prompt or paste a JSON reply. Loomwright previews every change before writing.">
      </HelperCard>
    </>
  );
};

// ---- 3. Writing Style Profile --------------------------------------
const Step_Style = ({ data, set, callbacks }) => {
  const s = data.style || { dials: {} };
  const dials = s.dials || {};
  const updDial = (id, v) => set("style", { ...s, dials: { ...dials, [id]: v } });
  const upd = (k, v) => set("style", { ...s, [k]: v });

  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Voice dials</div>
        <div className="ob-block__sub">Drag each dial to where your prose lives. These become guard-rails, not handcuffs.</div>
        <div className="ob-grid ob-grid--2">
          {STYLE_DIALS.map((d) => (
            <DialSlider
              key={d.id}
              label={d.label}
              value={dials[d.id] ?? 2}
              marks={d.marks}
              onChange={(v) => updDial(d.id, v)}
              callback="onSaveOnboardingDraft"
            />
          ))}
        </div>
        <Field label="Narrator tone (free text)" optional>
          <input className="ob-input" placeholder='e.g. "wry, intimate, slightly archaic"' value={s.narratorTone || ""} onChange={(e) => upd("narratorTone", e.target.value)}/>
        </Field>
        <div className="ob-grid ob-grid--2">
          <Field label="Things to avoid" hint="Comma-separated. Loomwright will flag these in drafts.">
            <input className="ob-input" placeholder="purple prose, said-bookisms, modern slang" value={s.avoid || ""} onChange={(e) => upd("avoid", e.target.value)}/>
          </Field>
          <Field label="Signature style rules" optional hint="Your house rules. Oxford commas, em-dash discipline, etc.">
            <input className="ob-input" placeholder="Oxford commas. No semicolons in dialogue." value={s.signature || ""} onChange={(e) => upd("signature", e.target.value)}/>
          </Field>
        </div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Quick import</div>
        <JsonImportBox
          label="Paste a style profile JSON"
          onParseSuccess={(obj) => set("style", { ...s, ...obj })}
          onQuickImportJson={callbacks.onQuickImportJson}
        />
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Style profile preview</div>
        <div className="ob-card">
          <div className="ob-card__main">
            <div className="ob-card__title">Generated profile · preview</div>
            <div className="ob-card__meta">
              {STYLE_DIALS.map((d) => (
                <span key={d.id} style={{ marginRight: 12 }}><strong style={{ color: "var(--ink-1)" }}>{d.label}:</strong> {d.marks[dials[d.id] ?? 2]}</span>
              ))}
            </div>
            {s.avoid && <div className="ob-card__sub"><Icon name="warn" size={11}/> Avoid: {s.avoid}</div>}
          </div>
        </div>
      </div>
    </>
  );
};

// ---- 4. Voice Sample ------------------------------------------------
const Step_Voice = ({ data, set, callbacks, jumpTo }) => {
  const v = data.voice || { samples: [] };
  const upd = (k, val) => set("voice", { ...v, [k]: val });
  const [analyzing, setAnalyzing] = _us_st(false);
  const [analyzed, setAnalyzed] = _us_st(false);

  // Provider-gated AI critique results land back on the draft.
  React.useEffect(() => {
    const onCritique = (e) => {
      const text = e?.detail?.text;
      if (text) set("voice", { ...(data.voice || {}), aiCritique: text });
    };
    window.addEventListener("lw:ai-style-critique", onCritique);
    return () => window.removeEventListener("lw:ai-style-critique", onCritique);
  }, [data.voice]);

  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Paste a sample of your prose</div>
        <div className="ob-block__sub">A scene, a paragraph, anything that sounds like <em>you</em>. Loomwright distills a voice profile — it does not memorise the text.</div>
        <Field label="Sample text">
          <textarea className="ob-textarea" rows={9} placeholder="The auger spoke, as it had not spoken for a hundred years, and the throne-room hushed itself the way a forest hushes for a wolf…" value={v.sample || ""} onChange={(e) => upd("sample", e.target.value)} data-callback="onSaveOnboardingDraft"/>
        </Field>
        <Field label="Or upload a file" optional>
          <DropZone callback="onUploadReference" accept=".txt, .md, .markdown, .text" onFile={(f) => set("voice", { ...v, uploaded: { name: f.name, state: f.state, words: (f.content || "").trim().split(/\s+/).filter(Boolean).length }, sample: (v.sample && v.sample.trim()) ? v.sample : (f.content || "") })} state={v.uploaded?.state || "idle"}/>
          {v.uploaded && (
            <div className="ob-card" style={{ marginTop: 8 }}>
              <div className="ob-card__main">
                <div className="ob-card__title">{v.uploaded.name}</div>
                <div className="ob-card__sub"><span className="chip chip--ok"><Icon name="check" size={10}/>Upload complete</span><span>{(v.uploaded.words || 0).toLocaleString()} words</span></div>
              </div>
              <div className="ob-card__actions">
                <Btn variant="ghost" size="sm" icon="trash" data-callback="onDeleteReference" onClick={() => upd("uploaded", null)}/>
              </div>
            </div>
          )}
        </Field>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Btn
            variant="primary"
            icon={analyzing ? "clock" : "sparkle"}
            disabled={!v.sample && !v.uploaded}
            onClick={() => {
              setAnalyzing(true);
              setTimeout(() => {
                let profile = null;
                try { const B = window.LoomwrightBackend; if (B && B.analyzeWritingStyle) profile = B.analyzeWritingStyle(v.sample || ""); } catch (_e) {}
                setAnalyzing(false); setAnalyzed(true);
                set("voice", { ...v, analyzed: true, profile });
              }, 500);
            }}
            data-callback="onAnalyzeStyleSample"
          >{analyzing ? "Distilling voice…" : "Analyze style"}</Btn>
          <Btn variant="ghost" icon="plus" data-callback="onAddVoiceSample" onClick={() => { const s = (v.sample || "").trim(); if (!s) return; set("voice", { ...v, samples: [...(v.samples || []), { id: "vs" + Date.now(), text: s }], sample: "" }); }}>Add another sample</Btn>
          <ToggleRow label="Use this as primary voice reference" sub="Loomwright prefers this fingerprint when blending suggestions." value={v.primary} onChange={(x) => upd("primary", x)} callback="onMarkSamplePrimary"/>
        </div>
      </div>
      {(analyzed || v.analyzed) && (
        <>
          <div className="ob-divider"/>
          <div className="ob-block">
            <div className="ob-block__title">Style profile result</div>
            <div className="ob-card">
              <div className="ob-card__main">
                <div className="ob-card__title">Voice fingerprint · {v.profile ? "ready" : "needs a longer sample"}</div>
                {v.profile ? (
                  <div className="ob-card__sub">
                    <span className="chip chip--accent">avg sentence: {v.profile.avgSentenceLen} words</span>
                    <span className="chip chip--neutral">{v.profile.register} register</span>
                    <span className="chip chip--neutral">{v.profile.pacing} pacing</span>
                    <span className="chip chip--neutral">{v.profile.lexicalDiversity}% lexical diversity</span>
                    <span className="chip chip--neutral">{v.profile.dialogueRatio}% dialogue</span>
                    <span className="chip chip--neutral">{v.profile.adverbDensity}/100 adverbs</span>
                  </div>
                ) : <div className="ob-card__meta">Paste a few sentences and analyze again.</div>}
                <div className="ob-card__meta">{v.profile ? ("Computed locally from " + v.profile.wordCount + " words — no text leaves your device.") : ""}</div>
                <div className="ob-card__tags">
                  <Btn variant={v.profileAccepted ? "outline" : "primary"} size="sm" icon="check" data-callback="onAcceptStyleProfile" onClick={() => upd("profileAccepted", true)}>{v.profileAccepted ? "Profile accepted" : "Accept profile"}</Btn>
                  <Btn variant="outline" size="sm" icon="paper" data-callback="onEditStyleProfile" onClick={() => jumpTo && jumpTo("style")}>Edit profile</Btn>
                  <Btn variant="outline" size="sm" icon="sparkle" data-callback="onRunAIStyleCritique" data-testid="ob-ai-critique"
                    onClick={() => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onRunAIStyleCritique", detail: { sample: v.sample || "" } } }))}>
                    AI critique (BYOK)</Btn>
                </div>
                {v.aiCritique && (
                  <div className="ob-card__meta" data-ui="ObAiCritique" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{v.aiCritique}</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

// ---- 5. World & Canon ----------------------------------------------
const Step_World = ({ data, set }) => {
  const w = data.world || { canonRules: [], forbidden: [], terminology: [] };
  const upd = (k, val) => set("world", { ...w, [k]: val });
  const [draft, setDraft] = _us_st({ rule: "", forbid: "", term: "" });

  const addRule = (kind, text) => {
    if (!text.trim()) return;
    const item = { id: "r" + Date.now(), text };
    upd(kind, [...(w[kind] || []), item]);
    setDraft({ ...draft, [kind === "canonRules" ? "rule" : kind === "forbidden" ? "forbid" : "term"]: "" });
  };
  const remove = (kind, id) => upd(kind, (w[kind] || []).filter((x) => x.id !== id));

  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">World shape</div>
        <div className="ob-grid ob-grid--2">
          <Field label="World type"><PillRow value={w.worldType} options={["Secondary fantasy","Low fantasy","Historical","Sci-fi","Near-future","Contemporary","Alt-history","Other"]} onChange={(v) => upd("worldType", v)}/></Field>
          <Field label="Magic / technology rules" optional hint="One or two sentences on what’s possible.">
            <textarea className="ob-textarea" rows={2} placeholder="Magic costs memory. Technology stalled at gunpowder. No teleportation under any circumstances." value={w.magic || ""} onChange={(e) => upd("magic", e.target.value)}/>
          </Field>
        </div>
        <div className="ob-grid ob-grid--2">
          <Field label="Political structure" optional><textarea className="ob-textarea" rows={2} placeholder="Dual crown · senate · the Augur’s seat" value={w.politics || ""} onChange={(e) => upd("politics", e.target.value)}/></Field>
          <Field label="Factions" optional><textarea className="ob-textarea" rows={2} placeholder="House Vey · House Hess · The Mendicants · The Quietfold" value={w.factions || ""} onChange={(e) => upd("factions", e.target.value)}/></Field>
        </div>
        <div className="ob-grid ob-grid--2">
          <Field label="Known locations" optional><textarea className="ob-textarea" rows={2} placeholder="Pale Reach · The Auger’s Hold · Veylan capital · Mendicant Roads" value={w.locations || ""} onChange={(e) => upd("locations", e.target.value)}/></Field>
          <Field label="Known history" optional><textarea className="ob-textarea" rows={2} placeholder="Century of Silence · the Hess Schism · the Diviner’s Pact" value={w.history || ""} onChange={(e) => upd("history", e.target.value)}/></Field>
        </div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Canon rules</div>
        <div className="ob-block__sub">Facts AI must <strong>never contradict</strong>. These get embedded in every prompt that reads canon.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="ob-input" placeholder="e.g. The Auger only speaks once a century." value={draft.rule} onChange={(e) => setDraft({ ...draft, rule: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addRule("canonRules", draft.rule)}/>
          <Btn variant="primary" icon="plus" onClick={() => addRule("canonRules", draft.rule)} data-callback="onAddCanonRule">Add canon rule</Btn>
        </div>
        <div className="ob-list">
          {(w.canonRules || []).length === 0 && <div className="ob__learned__empty" style={{ padding: 16 }}>No canon rules yet.</div>}
          {(w.canonRules || []).map((r) => (
            <div key={r.id} className="ob-card ob-card--canon" data-tone="rule">
              <div className="ob-card__main">
                <div className="ob-card__sub"><span className="chip chip--accent"><Icon name="lock" size={10}/>canon</span></div>
                <div className="ob-card__meta" style={{ color: "var(--ink-1)" }}>{r.text}</div>
              </div>
              <div className="ob-card__actions"><Btn variant="ghost" size="sm" icon="trash" onClick={() => remove("canonRules", r.id)} data-callback="onDeleteCanonRule"/></div>
            </div>
          ))}
        </div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Forbidden contradictions</div>
        <div className="ob-block__sub">Things AI should never invent or imply. These are flagged as warnings in review.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="ob-input" placeholder="e.g. There is no resurrection in this world." value={draft.forbid} onChange={(e) => setDraft({ ...draft, forbid: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addRule("forbidden", draft.forbid)}/>
          <Btn variant="danger" icon="plus" onClick={() => addRule("forbidden", draft.forbid)} data-callback="onAddForbiddenContradiction">Add forbidden</Btn>
        </div>
        <div className="ob-list">
          {(w.forbidden || []).map((r) => (
            <div key={r.id} className="ob-card ob-card--canon" data-tone="forbidden">
              <div className="ob-card__main">
                <div className="ob-card__sub"><span className="chip chip--danger"><Icon name="warn" size={10}/>forbidden</span></div>
                <div className="ob-card__meta" style={{ color: "var(--ink-1)" }}>{r.text}</div>
              </div>
              <div className="ob-card__actions"><Btn variant="ghost" size="sm" icon="trash" onClick={() => remove("forbidden", r.id)}/></div>
            </div>
          ))}
        </div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Terminology rules</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="ob-input" placeholder='e.g. Always "diviner", never "seer".' value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addRule("terminology", draft.term)}/>
          <Btn variant="outline" icon="plus" onClick={() => addRule("terminology", draft.term)}>Add term rule</Btn>
        </div>
        <div className="ob-list">
          {(w.terminology || []).map((r) => (
            <div key={r.id} className="ob-card ob-card--canon" data-tone="terminology">
              <div className="ob-card__main">
                <div className="ob-card__sub"><span className="chip chip--ok">terminology</span></div>
                <div className="ob-card__meta" style={{ color: "var(--ink-1)" }}>{r.text}</div>
              </div>
              <div className="ob-card__actions"><Btn variant="ghost" size="sm" icon="trash" onClick={() => remove("terminology", r.id)}/></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ---- 6. Character Seeds --------------------------------------------
const Step_Cast = ({ data, set, callbacks }) => {
  const c = data.cast || { seeds: [] };
  const seeds = c.seeds || [];
  const upd = (s) => set("cast", { ...c, seeds: s });
  const [editing, setEditing] = _us_st(null);
  const [importOpen, setImportOpen] = _us_st(false);
  const [importText, setImportText] = _us_st("");
  // Use the offline NER engine to pull character names out of pasted prose.
  const runImport = () => {
    const text = (importText || "").trim();
    if (!text) { setImportOpen(false); return; }
    let names = [];
    try {
      const B = window.LoomwrightBackend;
      if (B && B.discoverEntities) {
        names = (B.discoverEntities(text, {}, "ob-cast", "ob-cast").candidates || [])
          .filter((x) => x.entityType === "cast").map((x) => x.name);
      }
    } catch (_e) {}
    const existing = new Set(seeds.map((s) => (s.name || "").toLowerCase()));
    const additions = [...new Set(names)].filter((n) => n && !existing.has(n.toLowerCase())).map((n) => ({
      id: "seed-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      name: n, aliases: "", role: "", race: "", klass: "", faction: "", personality: "", voice: "", goals: "", fears: "", secrets: "", relationships: "", isNew: false,
    }));
    if (additions.length) upd([...seeds, ...additions]);
    setImportText(""); setImportOpen(false);
  };

  const blank = { id: "", name: "", aliases: "", role: "", race: "", klass: "", faction: "", personality: "", voice: "", goals: "", fears: "", secrets: "", relationships: "" };
  const startAdd = () => setEditing({ ...blank, id: "seed-" + Date.now(), isNew: true });
  const save = () => {
    if (!editing.name.trim()) { setEditing(null); return; }
    const next = editing.isNew ? [...seeds, { ...editing, isNew: false }] : seeds.map((s) => s.id === editing.id ? editing : s);
    upd(next);
    setEditing(null);
  };
  const remove = (id) => upd(seeds.filter((s) => s.id !== id));

  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Cast seeds</div>
        <div className="ob-block__sub">Drop in starter cards. They appear in the Cast panel as soon as you finish onboarding.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" icon="plus" onClick={startAdd} data-callback="onAddCharacterSeed">Add character seed</Btn>
          <Btn variant="outline" icon="paper" data-callback="onImportCharactersFromText" onClick={() => setImportOpen((o) => !o)}>Import from pasted text</Btn>
        </div>
        {importOpen && (
          <div className="ob-block" style={{ marginTop: 8 }}>
            <Field label="Paste prose — characters are extracted offline" hint="Names from dialogue, honorifics, and recurring proper nouns become seeds you can edit.">
              <textarea className="ob-textarea" rows={5} data-testid="cast-import-text" placeholder={"\"We ride at dawn,\" said Aelinor. Lord Brennan only nodded…"} value={importText} onChange={(e) => setImportText(e.target.value)}/>
            </Field>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="primary" icon="sparkle" data-testid="cast-import-run" onClick={runImport}>Extract characters</Btn>
              <Btn variant="ghost" onClick={() => { setImportText(""); setImportOpen(false); }}>Cancel</Btn>
            </div>
          </div>
        )}
        <div className="ob-list">
          {seeds.length === 0 && !editing && <div className="ob__learned__empty" style={{ padding: 24 }}>No character seeds yet. The Auger doesn’t mind starting with strangers.</div>}
          {seeds.map((s) => (
            <div key={s.id} className="ob-card">
              <div className="ob-card__main">
                <div className="ob-card__sub">
                  <EntityTypeBadge type="cast" size="xs"/>
                  {s.role && <span className="chip chip--neutral">{s.role}</span>}
                  {s.faction && <span className="chip chip--info">{s.faction}</span>}
                </div>
                <div className="ob-card__title">{s.name}</div>
                {s.aliases && <div className="ob-card__meta"><em>also:</em> {s.aliases}</div>}
                {s.personality && <div className="ob-card__meta">{s.personality}</div>}
                {(s.goals || s.fears || s.secrets) && (
                  <div className="ob-card__sub">
                    {s.goals && <span className="chip chip--ok">wants: {s.goals}</span>}
                    {s.fears && <span className="chip chip--warn">fears: {s.fears}</span>}
                    {s.secrets && <span className="chip chip--danger">secret</span>}
                  </div>
                )}
              </div>
              <div className="ob-card__actions">
                <Btn variant="ghost" size="sm" icon="paper" onClick={() => setEditing({ ...s, isNew: false })} data-callback="onEditCharacterSeed"/>
                <Btn variant="ghost" size="sm" icon="trash" onClick={() => remove(s.id)} data-callback="onDeleteCharacterSeed"/>
              </div>
            </div>
          ))}
        </div>
      </div>
      {editing && (
        <>
          <div className="ob-divider"/>
          <div className="ob-block">
            <div className="ob-block__title">{editing.isNew ? "New character seed" : "Edit seed"}</div>
            <div className="ob-grid ob-grid--3">
              <Field label="Name"><input className="ob-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}/></Field>
              <Field label="Aliases" optional><input className="ob-input" placeholder="The Diviner, Veyling" value={editing.aliases} onChange={(e) => setEditing({ ...editing, aliases: e.target.value })}/></Field>
              <Field label="Role"><input className="ob-input" placeholder="Protagonist · Antagonist · Ally" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}/></Field>
              <Field label="Race / species" optional><input className="ob-input" value={editing.race} onChange={(e) => setEditing({ ...editing, race: e.target.value })}/></Field>
              <Field label="Class / archetype" optional><input className="ob-input" placeholder="Diviner, Knight-errant…" value={editing.klass} onChange={(e) => setEditing({ ...editing, klass: e.target.value })}/></Field>
              <Field label="Faction" optional><input className="ob-input" value={editing.faction} onChange={(e) => setEditing({ ...editing, faction: e.target.value })}/></Field>
            </div>
            <div className="ob-grid ob-grid--2">
              <Field label="Personality notes"><textarea className="ob-textarea" rows={2} value={editing.personality} onChange={(e) => setEditing({ ...editing, personality: e.target.value })}/></Field>
              <Field label="Voice notes" optional><textarea className="ob-textarea" rows={2} placeholder="Speaks in shorter sentences when frightened." value={editing.voice} onChange={(e) => setEditing({ ...editing, voice: e.target.value })}/></Field>
              <Field label="Goals"><textarea className="ob-textarea" rows={2} value={editing.goals} onChange={(e) => setEditing({ ...editing, goals: e.target.value })}/></Field>
              <Field label="Fears"><textarea className="ob-textarea" rows={2} value={editing.fears} onChange={(e) => setEditing({ ...editing, fears: e.target.value })}/></Field>
              <Field label="Secrets" optional><textarea className="ob-textarea" rows={2} value={editing.secrets} onChange={(e) => setEditing({ ...editing, secrets: e.target.value })}/></Field>
              <Field label="Key relationships" optional><textarea className="ob-textarea" rows={2} placeholder="Mara of Hess (sister, estranged)" value={editing.relationships} onChange={(e) => setEditing({ ...editing, relationships: e.target.value })}/></Field>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="primary" icon="check" onClick={save} data-callback="onAddCharacterSeed">Save seed</Btn>
              <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
            </div>
          </div>
        </>
      )}
    </>
  );
};

// ---- 7. RPG / Tracking ---------------------------------------------
const Step_RPG = ({ data, set }) => {
  const r = data.rpg || { toggles: {}, template: "Genre-neutral" };
  const upd = (k, v) => set("rpg", { ...r, [k]: v });
  const updT = (k, v) => upd("toggles", { ...(r.toggles || {}), [k]: v });
  const T = r.toggles || {};
  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">What should Loomwright track?</div>
        <div className="ob-block__sub">Toggle off anything that doesn’t apply — non-RPG novels usually leave most of these dark.</div>
        <div className="ob-grid ob-grid--2">
          <ToggleRow label="Character classes"  sub="Knight, Diviner, Mendicant…"          value={T.classes}     onChange={(v) => updT("classes", v)}    callback="onSaveOnboardingDraft"/>
          <ToggleRow label="Races / species"     sub="Track lineage and species traits."   value={T.races}       onChange={(v) => updT("races", v)}/>
          <ToggleRow label="Stats"               sub="Numeric attributes (HP, mana…)"      value={T.stats}       onChange={(v) => updT("stats", v)}/>
          <ToggleRow label="Abilities"           sub="Spells, talents, signature moves."   value={T.abilities}   onChange={(v) => updT("abilities", v)}/>
          <ToggleRow label="Skill trees"         sub="Progression branches."               value={T.skillTrees}  onChange={(v) => updT("skillTrees", v)}/>
          <ToggleRow label="Inventory / items"   sub="Magic items, weapons, currency."     value={T.inventory}   onChange={(v) => updT("inventory", v)}/>
          <ToggleRow label="Quests / events"     sub="Plot threads with status."           value={T.quests}      onChange={(v) => updT("quests", v)}/>
          <ToggleRow label="Factions"            sub="Allegiances and reputations."        value={T.factions}    onChange={(v) => updT("factions", v)}/>
        </div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Starter template</div>
        <Field label="Genre template" hint="Pre-fills sensible stat sets and item categories.">
          <PillRow value={r.template} options={["Genre-neutral","High fantasy","Grimdark","Sci-fi / space","Cyberpunk","Modern thriller","Horror","Custom"]} onChange={(v) => upd("template", v)}/>
        </Field>
        <ToggleRow label="Keep genre-neutral but suggest examples" sub="Loomwright will offer genre-flavoured suggestions in review without enforcing them." value={r.suggestExamples} onChange={(v) => upd("suggestExamples", v)}/>
      </div>
      {(T.stats || T.inventory || T.skillTrees || T.classes || T.races || T.abilities) && (
        <>
          <div className="ob-divider"/>
          <div className="ob-block">
            <div className="ob-block__title">Custom rules</div>
            {T.classes && (
              <Field label="Name your classes" optional hint="Comma-separated — each becomes a Class entity you can flesh out later.">
                <input className="ob-input" placeholder="Diviner, Knight-errant, Hedge-witch" value={r.customClassNames || ""} onChange={(e) => upd("customClassNames", e.target.value)}/>
              </Field>
            )}
            {T.races && (
              <Field label="Name your races / folk" optional hint="Comma-separated — each becomes a Race entity.">
                <input className="ob-input" placeholder="Tidefolk, Hessian, Auger-born" value={r.customRaceNames || ""} onChange={(e) => upd("customRaceNames", e.target.value)}/>
              </Field>
            )}
            {T.abilities && (
              <Field label="Signature abilities" optional hint="Comma-separated — each becomes an Ability entity.">
                <input className="ob-input" placeholder="Auger-sight, Saltbinding, Tideturn" value={r.customAbilityNames || ""} onChange={(e) => upd("customAbilityNames", e.target.value)}/>
              </Field>
            )}
            {T.stats && (
              <Field label="Custom stat set" hint="Name, min, max, default — added to the Stats bank when you finish.">
                <div className="ob-list">
                  {(r.customStats || []).map((st, i) => {
                    const updStat = (k, val) => upd("customStats", (r.customStats || []).map((x, j) => j === i ? { ...x, [k]: val } : x));
                    return (
                      <div key={st.id || i} className="ob-stat-row">
                        <input className="ob-input" placeholder="Stat name" value={st.name || ""} onChange={(e) => updStat("name", e.target.value)} style={{ height: 28 }}/>
                        <input className="ob-input" type="number" value={st.min ?? 1} onChange={(e) => updStat("min", Number(e.target.value))} style={{ height: 28 }}/>
                        <input className="ob-input" type="number" value={st.max ?? 20} onChange={(e) => updStat("max", Number(e.target.value))} style={{ height: 28 }}/>
                        <input className="ob-input" type="number" value={st.def ?? 10} onChange={(e) => updStat("def", Number(e.target.value))} style={{ height: 28 }}/>
                        <Btn variant="ghost" size="sm" icon="trash" onClick={() => upd("customStats", (r.customStats || []).filter((_, j) => j !== i))}/>
                      </div>
                    );
                  })}
                  {(r.customStats || []).length === 0 && <div className="ob__learned__empty" style={{ padding: 12 }}>No custom stats yet — add Strength, Wits, Resolve, anything your world tracks.</div>}
                  <Btn variant="outline" size="sm" icon="plus" data-callback="onAddCustomStat" onClick={() => upd("customStats", [...(r.customStats || []), { id: "stat" + Date.now(), name: "", min: 1, max: 20, def: 10 }])}>Add stat</Btn>
                </div>
              </Field>
            )}
            {T.inventory && (
              <Field label="Custom item rules" optional>
                <textarea className="ob-textarea" rows={3} placeholder="Items have weight (slots) not currency. Augurs cannot be wielded by oath-breakers." value={r.itemRules || ""} onChange={(e) => upd("itemRules", e.target.value)}/>
              </Field>
            )}
            {T.skillTrees && (
              <Field label="Custom skill rules" optional>
                <textarea className="ob-textarea" rows={3} placeholder="Three branches per class. Crossing branches costs double progression." value={r.skillRules || ""} onChange={(e) => upd("skillRules", e.target.value)}/>
              </Field>
            )}
          </div>
        </>
      )}
    </>
  );
};

// ---- 8. Plot Roadmap -----------------------------------------------
const Step_Plot = ({ data, set }) => {
  const p = data.plot || { beats: [], targetChapters: 28 };
  const upd = (k, v) => set("plot", { ...p, [k]: v });
  const [draft, setDraft] = _us_st({ title: "", summary: "", chapter: "", chars: "", locs: "", status: "planned" });
  const add = () => {
    if (!draft.title.trim()) return;
    upd("beats", [...(p.beats || []), { ...draft, id: "b" + Date.now() }]);
    setDraft({ title: "", summary: "", chapter: "", chars: "", locs: "", status: "planned" });
  };
  const [importOpen, setImportOpen] = _us_st(false);
  const [importText, setImportText] = _us_st("");
  const importBeats = () => {
    try {
      const parsed = JSON.parse(stripJsonFence(importText));
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.beats) ? parsed.beats : []);
      const beats = arr.filter(Boolean).map((b, i) => ({
        id: "b" + Date.now() + "-" + i,
        title: b.title || b.beat || b.name || ("Beat " + (i + 1)),
        summary: b.summary || b.description || b.purpose || "",
        chapter: b.chapter || "",
        chars: Array.isArray(b.characters) ? b.characters.join(", ") : (b.chars || ""),
        locs: Array.isArray(b.locations) ? b.locations.join(", ") : (b.locs || ""),
        status: b.status || "planned",
      }));
      if (beats.length) upd("beats", [...(p.beats || []), ...beats]);
      setImportText(""); setImportOpen(false);
    } catch (_e) { /* invalid JSON — keep the editor open */ }
  };
  const remove = (id) => upd("beats", (p.beats || []).filter((x) => x.id !== id));
  const beats = p.beats || [];

  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Roadmap</div>
        <Field label="Target chapter count" hint="Roughly how many chapters do you imagine?">
          <div className="ob-slider">
            <input type="range" min={6} max={80} step={1} value={p.targetChapters || 28} onChange={(e) => upd("targetChapters", parseInt(e.target.value, 10))}/>
            <span className="ob-slider__val">{p.targetChapters || 28} chapters</span>
          </div>
        </Field>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Plot beats</div>
        <div className="ob-grid ob-grid--3">
          <Field label="Beat title"><input className="ob-input" placeholder="Aelinor returns home" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}/></Field>
          <Field label="Chapter target"><input className="ob-input" placeholder="Ch. 3" value={draft.chapter} onChange={(e) => setDraft({ ...draft, chapter: e.target.value })}/></Field>
          <Field label="Status">
            <PillRow value={draft.status} options={["planned","drafted","complete"]} onChange={(v) => setDraft({ ...draft, status: v })}/>
          </Field>
          <Field label="Summary" className="ob-grid--span"><textarea className="ob-textarea" rows={2} placeholder="What happens, why it matters." value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })}/></Field>
          <Field label="Characters involved" optional><input className="ob-input" placeholder="Aelinor, Saren" value={draft.chars} onChange={(e) => setDraft({ ...draft, chars: e.target.value })}/></Field>
          <Field label="Locations involved" optional><input className="ob-input" placeholder="Pale Reach" value={draft.locs} onChange={(e) => setDraft({ ...draft, locs: e.target.value })}/></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" icon="plus" onClick={add} data-callback="onAddPlotBeat">Add beat</Btn>
          <Btn variant="outline" icon="paper" data-callback="onImportPlotJson" onClick={() => setImportOpen((o) => !o)}>Import outline JSON</Btn>
        </div>
        {importOpen && (
          <div className="ob-block" style={{ marginTop: 8 }}>
            <Field label="Paste a JSON array of beats" hint='e.g. [{"title":"Inciting incident","summary":"…","characters":["Aelinor"]}]'>
              <textarea className="ob-textarea" rows={5} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='[{ "title": "…", "summary": "…" }]'/>
            </Field>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="primary" icon="check" onClick={importBeats}>Import beats</Btn>
              <Btn variant="ghost" onClick={() => { setImportText(""); setImportOpen(false); }}>Cancel</Btn>
            </div>
          </div>
        )}
        <div className="ob-list">
          {beats.length === 0 && <div className="ob__learned__empty" style={{ padding: 18 }}>No beats yet. Even three is enough to feel the spine.</div>}
          {beats.map((b, i) => (
            <div key={b.id} className="ob-beat">
              <div className="ob-beat__num">
                <strong>{(i + 1).toString().padStart(2, "0")}</strong>
                <small>{b.chapter || "—"}</small>
              </div>
              <div className="ob-beat__main">
                <div className="ob-beat__title">{b.title}</div>
                <div className="ob-beat__sub">{b.summary}</div>
                <div className="ob-beat__sub">
                  {b.chars && <span className="chip chip--neutral">{b.chars}</span>}
                  {b.locs && <span className="chip chip--neutral">{b.locs}</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                <span className={"ob-beat__status ob-beat__status--" + b.status}>{b.status}</span>
                <Btn variant="ghost" size="sm" icon="trash" onClick={() => remove(b.id)}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      {beats.length > 0 && (
        <>
          <div className="ob-divider"/>
          <div className="ob-block">
            <div className="ob-block__title">Timeline preview</div>
            <div className="ob-timeline">
              {beats.map((b, i) => (
                <div key={b.id} className={"ob-timeline__cell ob-timeline__cell--" + b.status}>
                  <strong>{b.chapter || "Ch. ?"}</strong>
                  <span>{b.title}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};

// ---- 9. Manuscript Import ------------------------------------------
const Step_Manuscript = ({ data, set }) => {
  const m = data.manuscript || { mode: "blank", chapters: [] };
  const upd = (k, v) => set("manuscript", { ...m, [k]: v });
  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Bring in (or don’t)</div>
        <div className="ob-choices ob-grid ob-grid--3">
          <ChoiceCard icon="paper" title="Start blank"        sub="A clean Chapter 1 page, ready when you are." on={m.mode === "blank"}  onClick={() => upd("mode", "blank")}/>
          <ChoiceCard icon="book"  title="Paste existing chapter" sub="Drop in a chapter or two; you can keep adding." on={m.mode === "paste"}  onClick={() => upd("mode", "paste")}/>
          <ChoiceCard icon="stack" title="Upload manuscript"  sub=".docx, .md, .txt or Scrivener bundle."        on={m.mode === "upload"} onClick={() => upd("mode", "upload")}/>
        </div>
      </div>
      {m.mode === "paste" && (
        <div className="ob-block">
          <Field label="Paste chapter text"><textarea className="ob-textarea" rows={8} placeholder="Chapter 1 — The Auger Speaks…" value={m.pasted || ""} onChange={(e) => upd("pasted", e.target.value)}/></Field>
        </div>
      )}
      {m.mode === "upload" && (
        <div className="ob-block">
          <DropZone callback="onUploadManuscript" accept=".md, .txt, .markdown, .text" onFile={(f) => upd("uploaded", { name: f.name, state: f.state, content: f.content || "", note: f.note, words: (f.content || "").trim().split(/\s+/).filter(Boolean).length })} state={m.uploaded?.state || "idle"}/>
          {m.uploaded && (
            <div className="ob-card">
              <div className="ob-card__main">
                <div className="ob-card__title">{m.uploaded.name}</div>
                <div className="ob-card__sub">
                  {m.uploaded.state === "unsupported"
                    ? <span className="chip chip--warn">{m.uploaded.note || "Unsupported format — paste the text instead"}</span>
                    : <><span className="chip chip--ok"><Icon name="check" size={10}/>Uploaded</span><span>{m.uploaded.words || 0} words</span></>}
                </div>
              </div>
              <div className="ob-card__actions"><Btn variant="ghost" size="sm" icon="trash" onClick={() => upd("uploaded", null)}/></div>
            </div>
          )}
        </div>
      )}
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">After import</div>
        <ToggleRow label="Auto-detect chapter breaks" sub='Loomwright splits on "Chapter", "###", or page-break markers.' value={m.autoDetect ?? true} onChange={(v) => upd("autoDetect", v)} callback="onSetAutoDetectChapters"/>
        <ToggleRow label="Allow manual chapter splitting" sub="You’ll see a split UI before chapters are committed." value={m.manualSplit ?? true} onChange={(v) => upd("manualSplit", v)}/>
        <ToggleRow label="Reserve future chapters" sub={"Pre-create empty Ch.8–" + (data.plot?.targetChapters || 28) + " slots."} value={m.reserve ?? true} onChange={(v) => upd("reserve", v)} callback="onReserveChapters"/>
        <ToggleRow label="Run quick extraction after import" sub="Find names, places, factions in 30 seconds. You approve everything." value={m.runExtraction ?? true} onChange={(v) => upd("runExtraction", v)} callback="onRunQuickExtraction"/>
      </div>
      {m.uploaded && m.uploaded.content && (
        <div className="ob-block">
          <div className="ob-block__title">Import preview</div>
          <div className="ob-list">
            {(() => {
              const re = /^[ \t]*(?:chapter\s+[\dIVXLCM]+\b[^\n]*|#{1,6}\s+[^\n]+)\s*$/gim;
              const heads = (m.uploaded.content.match(re) || []).map((h) => h.replace(/^#{1,6}\s*/, "").trim());
              const titles = heads.length ? heads.slice(0, 12) : ["Chapter 1"];
              return titles.map((t, i) => (
                <div key={i} className="ob-card">
                  <div className="ob-card__main">
                    <div className="ob-card__title">{t}</div>
                    <div className="ob-card__sub"><span className="chip chip--ok">ready to import</span></div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </>
  );
};

// ---- 10. References ------------------------------------------------
const Step_References = ({ data, set, callbacks }) => {
  const r = data.references || { items: [], pasteTitle: "", pasteText: "" };
  const upd = (k, v) => set("references", { ...r, [k]: v });
  const items = r.items || [];

  const addPasted = () => {
    if (!r.pasteText?.trim()) return;
    const item = {
      id: "ref" + Date.now(),
      title: r.pasteTitle || "Untitled reference",
      kind: "pasted", content: r.pasteText.trim(),
      words: r.pasteText.trim().split(/\s+/).filter(Boolean).length,
      tags: ["pasted"], style: false, canon: true, context: true, state: "ready",
    };
    // Single set with the new item AND cleared inputs (the previous two-set
    // form dropped the item and never stored its text).
    set("references", { ...r, items: [...items, item], pasteTitle: "", pasteText: "" });
  };
  const remove = (id) => upd("items", items.filter((x) => x.id !== id));
  const toggleFlag = (id, k) => upd("items", items.map((x) => x.id === id ? { ...x, [k]: !x[k] } : x));

  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Upload</div>
        <DropZone callback="onUploadReference" onFile={() => upd("items", [...items, { id: "ref" + Date.now(), title: "Worldbible v3.docx", kind: "uploaded", words: 18420, tags: ["world"], style: false, canon: true, context: true, state: "processing" }])}/>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Or paste</div>
        <div className="ob-grid ob-grid--2">
          <Field label="Reference title"><input className="ob-input" placeholder="House Hess — pedigree notes" value={r.pasteTitle || ""} onChange={(e) => upd("pasteTitle", e.target.value)}/></Field>
          <Field label="Tags"><input className="ob-input" placeholder="lore, factions" value={r.pasteTags || ""} onChange={(e) => upd("pasteTags", e.target.value)}/></Field>
        </div>
        <Field label="Reference text"><textarea className="ob-textarea" rows={6} placeholder="Notes, pedigree trees, world history…" value={r.pasteText || ""} onChange={(e) => upd("pasteText", e.target.value)}/></Field>
        <div><Btn variant="primary" icon="plus" onClick={addPasted} data-callback="onUploadReference">Add reference</Btn></div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Reference library</div>
        <div className="ob-list">
          {items.length === 0 && <div className="ob__learned__empty" style={{ padding: 24 }}>No references yet — that’s perfectly fine. You can add them later from the References tab.</div>}
          {items.map((x) => (
            <div key={x.id} className="ob-card">
              <div className="ob-card__main">
                <div className="ob-card__sub">
                  <EntityTypeBadge type="references" size="xs"/>
                  {x.state === "processing" ? <span className="chip chip--info"><span className="chip__dot chip__dot--pulse"/>processing</span> : <span className="chip chip--ok"><Icon name="check" size={10}/>ready</span>}
                  <span>{(x.words || 0).toLocaleString()} words</span>
                  {(x.tags || []).map((t) => <span key={t} className="chip chip--neutral">#{t}</span>)}
                </div>
                <div className="ob-card__title">{x.title}</div>
                <div className="ob-card__tags" style={{ marginTop: 8 }}>
                  <button type="button" className={"ob-pill " + (x.style ? "is-on" : "")} onClick={() => toggleFlag(x.id, "style")}>Style reference</button>
                  <button type="button" className={"ob-pill " + (x.canon ? "is-on" : "")} onClick={() => toggleFlag(x.id, "canon")}>Canon reference</button>
                  <button type="button" className={"ob-pill " + (x.context ? "is-on" : "")} onClick={() => toggleFlag(x.id, "context")}>Use as AI context</button>
                </div>
              </div>
              <div className="ob-card__actions"><Btn variant="ghost" size="sm" icon="trash" onClick={() => remove(x.id)} data-callback="onDeleteReference"/></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ---- 11. AI / Privacy ----------------------------------------------
const Step_AI = ({ data, set, callbacks }) => {
  const a = data.ai || { mode: "local", provider: "anthropic", storeLocal: true, allowEgress: false, key: "", validation: "idle" };
  const upd = (k, v) => set("ai", { ...a, [k]: v });
  const validate = () => {
    // Real connection test (the callbacks bag calls AIService.testConnection
    // and updates ai.validation to "validating" → "ok"/"err").
    if (callbacks.onValidateProviderKey) callbacks.onValidateProviderKey({ provider: a.provider, key: a.key });
    else { set("ai", { ...a, validation: "validating" }); setTimeout(() => set("ai", { ...a, validation: a.key ? "ok" : "err" }), 700); }
  };

  return (
    <>
      <div className="ob-privacy-banner">
        <div className="ob-privacy-banner__icon"><Icon name="lock" size={16}/></div>
        <div>
          <div className="ob-privacy-banner__title">Manuscript text never leaves this device unless you explicitly allow it.</div>
          <div className="ob-privacy-banner__body">Loomwright defaults to local-only. Keys, when provided, are stored on this device and used only for the calls you approve.</div>
        </div>
      </div>
      <div className="ob-block">
        <div className="ob-block__title">Privacy mode</div>
        <div className="ob-choices ob-grid ob-grid--2">
          {PRIVACY_CHOICES.map((c) => (
            <ChoiceCard
              key={c.id}
              icon={c.icon}
              title={c.title}
              sub={c.sub}
              on={a.mode === c.id}
              disabled={c.disabled}
              onClick={() => { upd("mode", c.id); callbacks.onTogglePrivacyMode && callbacks.onTogglePrivacyMode(c.id); }}
              callback="onTogglePrivacyMode"
              meta={c.disabled ? <span className="chip chip--neutral">Waitlist</span> : null}
              tone={c.tone}
            />
          ))}
        </div>
      </div>
      {a.mode === "byok" && (
        <>
          <div className="ob-divider"/>
          <div className="ob-block">
            <div className="ob-block__title">Bring your own key</div>
            <div className="ob-block__sub">Pick a provider. Loomwright stores the key locally (never on a server) and shows every outbound call in the AI log.</div>
            <div className="ob-grid ob-grid--3">
              {PROVIDERS.map((p) => (
                <button key={p.id} type="button" className={"ob-choice " + (a.provider === p.id ? "is-on" : "")} onClick={() => upd("provider", p.id)}>
                  <span className="ob-choice__icon"><Icon name={p.icon} size={16}/></span>
                  <span className="ob-choice__body">
                    <span className="ob-choice__title">{p.label}</span>
                    <span className="ob-choice__sub">{p.note}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="ob-provider">
              <div className="ob-provider__head">
                <div className="ob-provider__icon"><Icon name="lock" size={14}/></div>
                <div className="ob-provider__name">{PROVIDERS.find((p) => p.id === a.provider)?.label} API key</div>
                {a.validation === "ok" && <span className="chip chip--ok"><Icon name="check" size={10}/>validated</span>}
                {a.validation === "err" && <span className="chip chip--danger"><Icon name="warn" size={10}/>invalid key</span>}
                {a.validation === "validating" && <span className="chip chip--info"><span className="chip__dot chip__dot--pulse"/>checking…</span>}
              </div>
              <input className="ob-input" placeholder="sk-…" value={a.key || ""} onChange={(e) => upd("key", e.target.value)} type="password" data-callback="onValidateProviderKey"/>
              <div className="ob-provider__validate">
                <Btn variant="primary" icon="check" onClick={validate} data-callback="onValidateProviderKey">Validate key</Btn>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>Sends a single zero-token request to the provider.</span>
              </div>
              <ToggleRow label="Store key locally only" sub="Never synced. If you log out, the key is wiped." value={a.storeLocal ?? true} onChange={(v) => upd("storeLocal", v)} callback="onSetStoreKeyLocally"/>
            </div>
          </div>
        </>
      )}
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Per-project consent</div>
        <ToggleRow
          label="Allow manuscript text to leave this app"
          sub={a.allowEgress
            ? "On. Loomwright may include selected manuscript excerpts when you invoke an AI helper."
            : "Off. AI helpers can use canon, references, and your style profile — never raw manuscript text."}
          value={a.allowEgress}
          onChange={(v) => upd("allowEgress", v)}
          callback="onSetAllowManuscriptEgress"
        />
        {a.allowEgress && (
          <div className="ob-privacy-banner" style={{ borderColor: "color-mix(in srgb, #c97a3a 50%, var(--line-2))", background: "color-mix(in srgb, #c97a3a 10%, var(--bg-paper-2))" }}>
            <div className="ob-privacy-banner__icon" style={{ color: "#5e3415", background: "color-mix(in srgb, #c97a3a 22%, var(--bg-paper))", borderColor: "color-mix(in srgb, #c97a3a 35%, transparent)" }}><Icon name="warn" size={16}/></div>
            <div>
              <div className="ob-privacy-banner__title" style={{ color: "#5e3415" }}>Heads up — manuscript text may now travel.</div>
              <div className="ob-privacy-banner__body" style={{ color: "#3d2310" }}>You will still confirm every AI call. Loomwright will redact names you mark as private before sending.</div>
            </div>
          </div>
        )}
        <div className="ob-card">
          <div className="ob-card__main">
            <div className="ob-card__title">This project’s consent summary</div>
            <div className="ob-card__sub">
              <span className={"chip " + (a.mode === "local" ? "chip--ok" : "chip--info")}><Icon name="lock" size={10}/>{PRIVACY_CHOICES.find((c) => c.id === a.mode)?.title}</span>
              <span className={"chip " + (a.allowEgress ? "chip--warn" : "chip--ok")}>{a.allowEgress ? "Manuscript egress allowed" : "Manuscript egress blocked"}</span>
              <span className="chip chip--neutral">Key store: {a.storeLocal ? "device only" : "synced"}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ---- 12. Review Rules ----------------------------------------------
const Step_Review = ({ data, set }) => {
  const r = data.review || { autoAddHigh: true, showAutoInQueue: true, aggressiveness: 2, falsePositive: 1, missingTolerance: 2, queueDisplay: "by-confidence", scan: {} };
  const upd = (k, v) => set("review", { ...r, [k]: v });
  const updScan = (id, v) => upd("scan", { ...(r.scan || {}), [id]: v });
  const dial = (id, label, val, marks) => (
    <DialSlider key={id} label={label} value={val} marks={marks} onChange={(v) => upd(id, v)}/>
  );
  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Auto-add behaviour</div>
        <ToggleRow label="Auto-add blue 95%+ items"          sub="Findings with 95%+ confidence are added to the world without manual approval."          value={r.autoAddHigh}        onChange={(v) => upd("autoAddHigh", v)} callback="onSetAutoAddHigh"/>
        <ToggleRow label="Still show auto-added items in review queue" sub="Even when they’re committed, you can scroll past them to undo if something looks wrong." value={r.showAutoInQueue}    onChange={(v) => upd("showAutoInQueue", v)} callback="onSetShowAutoInQueue"/>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Tuning</div>
        <div className="ob-grid ob-grid--3">
          {dial("aggressiveness",   "Extraction aggressiveness", r.aggressiveness, ["whisper", "soft", "balanced", "eager", "loud"])}
          {dial("falsePositive",    "False-positive tolerance",  r.falsePositive,  ["zero", "low", "moderate", "lenient", "permissive"])}
          {dial("missingTolerance", "Missing-entity tolerance",  r.missingTolerance, ["strict", "tight", "balanced", "forgiving", "loose"])}
        </div>
        <Field label="Review queue display preference">
          <PillRow value={r.queueDisplay} options={["by-confidence","by-recency","by-entity-type","by-chapter"]} onChange={(v) => upd("queueDisplay", v)}/>
        </Field>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Scan for…</div>
        <div className="ob-grid ob-grid--3">
          {ENTITY_SCAN_TYPES.map((t) => (
            <ToggleRow key={t.id} label={t.label} value={r.scan?.[t.id] ?? true} onChange={(v) => updScan(t.id, v)} callback="onSetEntityScan"/>
          ))}
        </div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Change detection</div>
        <div className="ob-grid ob-grid--2">
          <ToggleRow label="Stat changes"        sub="Detect 'lost X HP', 'gained level'."     value={r.detectStats        ?? true} onChange={(v) => upd("detectStats", v)}/>
          <ToggleRow label="Inventory changes"   sub="Pickups, drops, broken items."           value={r.detectInventory    ?? true} onChange={(v) => upd("detectInventory", v)}/>
          <ToggleRow label="Travel"              sub="Movement between locations."             value={r.detectTravel       ?? true} onChange={(v) => upd("detectTravel", v)}/>
          <ToggleRow label="Relationships"       sub="Allegiance, kinship, romantic shifts."   value={r.detectRelationships ?? true} onChange={(v) => upd("detectRelationships", v)}/>
          <ToggleRow label="Quests / events"     sub="Open, advance, resolve plot threads."    value={r.detectQuests       ?? true} onChange={(v) => upd("detectQuests", v)}/>
        </div>
      </div>
    </>
  );
};

// ---- 13. Workspace Preferences -------------------------------------
const Step_Workspace = ({ data, set }) => {
  const w = data.workspace || { startTab: "writers-room", editorWidth: 740, font: "Source Serif 4", margins: true, panelStack: "stack-right", focus: false, themeIntensity: 50, chapterRail: "left", authorAttribution: true, mobileCompact: true };
  const upd = (k, v) => set("workspace", { ...w, [k]: v });
  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Where you start</div>
        <div className="ob-grid ob-grid--2">
          <Field label="Default starting tab"><PillRow value={w.startTab} options={["home","today","writers-room","cast","atlas"]} onChange={(v) => upd("startTab", v)}/></Field>
          <Field label="Editor width" hint={w.editorWidth + "px"}>
            <div className="ob-slider"><input type="range" min={560} max={920} step={20} value={w.editorWidth} onChange={(e) => upd("editorWidth", parseInt(e.target.value, 10))}/><span className="ob-slider__val">{w.editorWidth}px</span></div>
          </Field>
        </div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Type & paper</div>
        <Field label="Font style"><PillRow value={w.font} options={["Source Serif 4","EB Garamond","Cormorant Garamond","Inter Tight"]} onChange={(v) => upd("font", v)}/></Field>
        <ToggleRow label="Show margins for annotations" sub="Reserved space for review margins on either side of paragraphs." value={w.margins} onChange={(v) => upd("margins", v)}/>
        <Field label="Theme intensity" hint={w.themeIntensity + "% — higher = warmer paper"}>
          <div className="ob-slider"><input type="range" min={0} max={100} step={5} value={w.themeIntensity} onChange={(e) => upd("themeIntensity", parseInt(e.target.value, 10))}/><span className="ob-slider__val">{w.themeIntensity}%</span></div>
        </Field>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Layout</div>
        <div className="ob-grid ob-grid--2">
          <Field label="Panel stacking"><PillRow value={w.panelStack} options={["stack-right","stack-floating","tabs"]} onChange={(v) => upd("panelStack", v)}/></Field>
          <Field label="Chapter rail position"><PillRow value={w.chapterRail} options={["left","right","hidden"]} onChange={(v) => upd("chapterRail", v)}/></Field>
        </div>
        <ToggleRow label="Focus mode by default" sub="Hides utility rails until you summon them."           value={w.focus}             onChange={(v) => upd("focus", v)}/>
        <ToggleRow label="Show author attribution"  sub="Initial of the active author appears in margins on edits." value={w.authorAttribution} onChange={(v) => upd("authorAttribution", v)}/>
        <ToggleRow label="Mobile compact mode preview" sub="Approximates how Loomwright will lay out on phones." value={w.mobileCompact}     onChange={(v) => upd("mobileCompact", v)}/>
      </div>
    </>
  );
};

// ---- 14. Final Summary ---------------------------------------------
const Step_Summary = ({ data, callbacks, jumpTo }) => {
  const tile = (k, lbl, icon, title, body, warn = false) => (
    <FinalSummaryCard key={k} lbl={lbl} icon={icon} title={title} body={body} warn={warn} onEdit={() => jumpTo(k)}/>
  );
  const w = data.welcome || {}, f = data.foundation || {}, s = data.style || {}, world = data.world || {}, cast = data.cast || {}, rpg = data.rpg || {}, plot = data.plot || {}, refs = data.references || {}, ai = data.ai || {}, rev = data.review || {}, ms = data.manuscript || {};
  const dialsSummary = STYLE_DIALS.slice(0, 4).map((d) => d.label.toLowerCase() + " " + (d.marks[(s.dials || {})[d.id] ?? 2])).join(" · ");
  const missing = [];
  if (!w.title) missing.push({ k: "welcome", n: "Project title" });
  if (!f.premise) missing.push({ k: "foundation", n: "Premise" });
  if (!ai.mode) missing.push({ k: "ai", n: "Privacy mode" });
  if (cast.seeds?.length === 0) missing.push({ k: "cast", n: "Character seeds" });

  return (
    <>
      <div className="ob-block">
        <div className="ob-block__title">Your project, distilled</div>
        <div className="ob-block__sub">Edit any tile, or open the door and start writing.</div>
        <div className="ob-summary">
          {tile("welcome",    "01 Project",   "stack",   w.title || "Untitled", `${w.format || "—"} · ${w.genre || "—"} · ${w.audience || "—"} · ${w.length || "—"}`)}
          {tile("foundation", "02 Story",     "feather", "Foundation", f.premise || <em>No premise yet.</em>)}
          {tile("style",      "03 Voice",     "spark",   "Writing style", dialsSummary || <em>No dials set yet.</em>)}
          {tile("world",      "05 Canon",     "lock",    "World rules", `${(world.canonRules || []).length} canon · ${(world.forbidden || []).length} forbidden · ${(world.terminology || []).length} terms`)}
          {tile("cast",       "06 Cast",      "user",    "Character seeds", `${(cast.seeds || []).length} seeds prepared`)}
          {tile("rpg",        "07 Tracking",  "shield",  "Tracking systems", Object.entries(rpg.toggles || {}).filter(([,v]) => v).map(([k]) => k).join(", ") || <em>None enabled.</em>)}
          {tile("references", "10 References","paper",   "Reference docs", `${(refs.items || []).length} sources linked`)}
          {tile("ai",         "11 Privacy",   ai.allowEgress ? "warn" : "lock", "Privacy mode", `${PRIVACY_CHOICES.find((c) => c.id === ai.mode)?.title || "Local only"} · manuscript egress ${ai.allowEgress ? "allowed" : "blocked"}`, ai.allowEgress)}
          {tile("review",     "12 Review",    "bell",    "Review rules", `Auto-add ≥95%: ${rev.autoAddHigh ? "on" : "off"} · queue: ${rev.queueDisplay || "by confidence"}`)}
          {tile("manuscript", "09 Chapters",  "book",    "Manuscript setup", ms.mode === "blank" ? "Starting blank" : ms.uploaded ? `${ms.uploaded.chapters} chapters from ${ms.uploaded.name}` : "Pasted in")}
          {missing.length > 0 && tile("missing", "Missing", "warn", "Recommended setup", missing.map((m) => m.n).join(", "), true)}
        </div>
      </div>
      <div className="ob-divider"/>
      <div className="ob-block">
        <div className="ob-block__title">Open the door</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="primary" icon="feather" onClick={callbacks.onStartWriting}    data-callback="onStartWriting">Start Writing</Btn>
          <Btn variant="outline" icon="user"    onClick={callbacks.onOpenCast}        data-callback="onOpenCast">Open Cast</Btn>
          <Btn variant="outline" icon="compass" onClick={callbacks.onOpenAtlas}       data-callback="onOpenAtlas">Open Atlas</Btn>
          <Btn variant="outline" icon="sun"     onClick={callbacks.onGoToDashboard}   data-callback="onGoToDashboard">Go to Dashboard</Btn>
          <Btn variant="ghost"   icon="paper"   onClick={() => jumpTo("welcome")}     data-callback="onReturnToSetup">Return to setup</Btn>
        </div>
      </div>
    </>
  );
};

const STEP_RENDERERS = {
  welcome:    Step_Welcome,
  foundation: Step_Foundation,
  style:      Step_Style,
  voice:      Step_Voice,
  world:      Step_World,
  cast:       Step_Cast,
  rpg:        Step_RPG,
  plot:       Step_Plot,
  manuscript: Step_Manuscript,
  references: Step_References,
  ai:         Step_AI,
  review:     Step_Review,
  workspace:  Step_Workspace,
  summary:    Step_Summary,
};

Object.assign(window, { STEP_RENDERERS });
