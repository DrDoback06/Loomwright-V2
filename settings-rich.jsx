// =====================================================================
// settings-rich.jsx — Deep section renderers for the Settings Control
// Centre. The shell ControlCentreWorkspace delegates to
// <RichSettingsSection sectionId="…" />; if a section isn't covered
// here, the workspace's inline fallback still renders.
//
// Sections added/upgraded:
//   project · brand · editor · authors · ai · ai-routing · privacy ·
//   extraction · review · intel · references · import · shortcuts · debug
//
// BYOK design:
//   The app is a shell. Anything that calls an external AI uses the
//   user's own API keys. Settings makes this explicit but never scary.
// =====================================================================

const { useState: _set_us, useMemo: _set_um, useEffect: _set_ue } = React;

// ---------------------------------------------------------------------
// AI provider catalogue — curated top 6 visible by default; rest live
// behind "Add provider".
// ---------------------------------------------------------------------
const SET_AI_PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    blurb: "GPT-4o / GPT-4.1 / GPT-5 family.",
    keyLink: "https://platform.openai.com/api-keys",
    keyHint: "Starts with sk-",
    defaultModel: "gpt-4o-mini",
    suggestedUses: ["writing","extraction","summarisation"],
    builtIn: true,
  },
  {
    id: "anthropic",
    name: "Anthropic / Claude",
    blurb: "Claude 4 family — long context, careful prose.",
    keyLink: "https://console.anthropic.com/settings/keys",
    keyHint: "Starts with sk-ant-",
    defaultModel: "claude-haiku-4-5",
    suggestedUses: ["writing","summarisation","research"],
    builtIn: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    blurb: "Gemini 2.5 — strong multimodal + cheap.",
    keyLink: "https://aistudio.google.com/app/apikey",
    keyHint: "Starts with AIzaSy…",
    defaultModel: "gemini-2.5-flash",
    suggestedUses: ["extraction","summarisation","embeddings"],
    builtIn: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    blurb: "One key → 100+ models from many providers.",
    keyLink: "https://openrouter.ai/keys",
    keyHint: "Starts with sk-or-",
    defaultModel: "anthropic/claude-haiku-4-5",
    suggestedUses: ["writing","research","extraction"],
    builtIn: true,
  },
  {
    id: "ollama",
    name: "Local · Ollama / LM Studio",
    blurb: "Run models on your own machine. Free, private.",
    keyLink: "https://ollama.com/download",
    keyHint: "Endpoint: http://localhost:11434",
    defaultModel: "llama3.1:8b-instruct",
    suggestedUses: ["writing","extraction"],
    builtIn: true,
    isLocal: true,
  },
  {
    id: "custom",
    name: "Custom OpenAI-compatible",
    blurb: "Any endpoint that speaks the OpenAI Chat API.",
    keyLink: null,
    keyHint: "Bring your own base URL + key.",
    defaultModel: "—",
    suggestedUses: ["writing","extraction","custom"],
    builtIn: true,
    isCustom: true,
  },
];

const SET_AI_PROVIDERS_MORE = [
  { id: "mistral",    name: "Mistral",      blurb: "Mistral Large / Small / Nemo.",     keyLink: "https://console.mistral.ai/api-keys" },
  { id: "cohere",     name: "Cohere",       blurb: "Command R / R+ · strong retrieval.", keyLink: "https://dashboard.cohere.com/api-keys" },
  { id: "together",   name: "Together AI",  blurb: "Open models, fast inference.",       keyLink: "https://api.together.ai/settings/api-keys" },
  { id: "groq",       name: "Groq",         blurb: "Ultra-fast hosted open models.",     keyLink: "https://console.groq.com/keys" },
  { id: "perplexity", name: "Perplexity",   blurb: "Search-grounded answers.",           keyLink: "https://www.perplexity.ai/settings/api" },
  { id: "elevenlabs", name: "ElevenLabs",   blurb: "Voice — only for read-aloud / dictation.", keyLink: "https://elevenlabs.io/app/settings/api-keys" },
  { id: "stability",  name: "Stability AI", blurb: "Image generation — for reference boards only.", keyLink: "https://platform.stability.ai/account/keys" },
];

const SET_AI_USE_CASES = [
  { id: "writing",       label: "Writing / drafting" },
  { id: "extraction",    label: "Entity extraction" },
  { id: "summarisation", label: "Summarisation" },
  { id: "research",      label: "Research" },
  { id: "voice",         label: "Voice / dictation" },
  { id: "image",         label: "Image / mood boards" },
  { id: "embeddings",    label: "Embeddings / search" },
];

// ---------------------------------------------------------------------
// Reusable bits
// ---------------------------------------------------------------------
const SetRow = ({ label, hint, children }) => (
  <label className="set-row">
    <div className="set-row__label-col">
      <span className="set-row__label">{label}</span>
      {hint && <span className="set-row__hint">{hint}</span>}
    </div>
    <div className="set-row__control">{children}</div>
  </label>
);

const SetInput = ({ value, onChange, placeholder, type = "text", mono }) => (
  <input className={"set-input " + (mono ? "set-input--mono" : "")}
    type={type} value={value || ""}
    onChange={(e) => onChange && onChange(e.target.value)}
    placeholder={placeholder}/>
);

const SetSelect = ({ value, onChange, options }) => (
  <select className="set-input" value={value} onChange={(e) => onChange && onChange(e.target.value)}>
    {options.map((o) => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
  </select>
);

const SetToggle = ({ checked, onChange, label, hint }) => (
  <label className="set-toggle">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange && onChange(e.target.checked)}/>
    <span>
      <b>{label}</b>
      {hint && <span className="set-toggle__hint">{hint}</span>}
    </span>
  </label>
);

const useLWSettingState = (section, initial) => {
  const [state, setState] = _set_us(() => (
    window.LoomwrightBackend?.SettingsService?.getSectionSync(section, initial) || initial
  ));
  _set_ue(() => {
    window.LoomwrightBackend?.SettingsService?.saveSection(section, state);
  }, [section, JSON.stringify(state)]);
  return [state, setState];
};

const SetSegmented = ({ value, onChange, options }) => (
  <div className="set-segmented">
    {options.map((o) => (
      <button key={o.id} type="button"
        className={"set-segmented__btn " + (value === o.id ? "is-on" : "")}
        onClick={() => onChange && onChange(o.id)}>
        {o.label}
      </button>
    ))}
  </div>
);

const SetSlider = ({ value, onChange, min, max, step = 1, unit = "" }) => (
  <div className="set-slider">
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange && onChange(Number(e.target.value))}/>
    <b>{value}{unit}</b>
  </div>
);

const SetGroupCard = ({ title, hint, children, actions }) => (
  <div className="set-card">
    <div className="set-card__head">
      <div>
        <div className="set-card__title">{title}</div>
        {hint && <div className="set-card__hint">{hint}</div>}
      </div>
      {actions && <div className="set-card__actions">{actions}</div>}
    </div>
    <div className="set-card__body">{children}</div>
  </div>
);

// =====================================================================
// PROJECT
// =====================================================================
const SetProject = () => {
  const [s, setS] = useLWSettingState("project", {
    projectName: "The Auger's Door", seriesName: "The Vraska Cycle", bookName: "Book II",
    genre: "Literary fantasy", targetFormat: "Novel", wordCountGoal: 95000,
    projectStatus: "drafting", defaultRoute: "writers-room",
  });
  const up = (k, v) => { setS({ ...s, [k]: v }); window.dispatchEvent(new CustomEvent("lw:settings-update", { detail: { section: "project", key: k, value: v } })); };
  return (
    <SetGroupCard title="Project" hint="Identity and goals for this book.">
      <SetRow label="Project name"><SetInput value={s.projectName} onChange={(v) => up("projectName", v)}/></SetRow>
      <SetRow label="Series name"><SetInput value={s.seriesName} onChange={(v) => up("seriesName", v)} placeholder="Optional"/></SetRow>
      <SetRow label="Book name"><SetInput value={s.bookName} onChange={(v) => up("bookName", v)}/></SetRow>
      <SetRow label="Genre"><SetInput value={s.genre} onChange={(v) => up("genre", v)}/></SetRow>
      <SetRow label="Target format">
        <SetSelect value={s.targetFormat} onChange={(v) => up("targetFormat", v)}
          options={["Novel","Novella","Short story","Series arc","Screenplay","Play","RPG sourcebook","Other"]}/>
      </SetRow>
      <SetRow label="Word-count goal" hint="Tracked in status bar.">
        <SetInput type="number" value={s.wordCountGoal} onChange={(v) => up("wordCountGoal", Number(v))}/>
      </SetRow>
      <SetRow label="Project status">
        <SetSelect value={s.projectStatus} onChange={(v) => up("projectStatus", v)}
          options={["planning","drafting","revising","editing","resting","abandoned","complete"]}/>
      </SetRow>
      <SetRow label="Default route on open" hint="Where Loomwright lands when this project opens.">
        <SetSelect value={s.defaultRoute} onChange={(v) => up("defaultRoute", v)}
          options={["writers-room","home","atlas","cast","review-queue"]}/>
      </SetRow>
      <SetRow label="Local storage" hint="Project data lives in your filesystem until you export.">
        <span className="set-pill">Local-only</span>
      </SetRow>
    </SetGroupCard>
  );
};

// =====================================================================
// BRAND / THEME
// =====================================================================
const SetBrand = () => {
  const [s, setS] = useLWSettingState("brand", {
    accent: "#9a7b3a", theme: "parchment-light", density: "balanced",
    manuscriptFont: "Source Serif 4", uiFont: "Inter Tight",
    reducedMotion: false,
  });
  const up = (k, v) => setS({ ...s, [k]: v });
  return (
    <SetGroupCard title="Brand & theme" hint="Look-and-feel — not just decoration; it affects readability for long sessions.">
      <SetRow label="Theme">
        <SetSegmented value={s.theme} onChange={(v) => up("theme", v)}
          options={[{ id: "parchment-light", label: "Parchment light" }, { id: "parchment-dark", label: "Parchment dark" }, { id: "monastery", label: "Monastery" }]}/>
      </SetRow>
      <SetRow label="Accent">
        <input type="color" value={s.accent} onChange={(e) => up("accent", e.target.value)} style={{ width: 44, height: 32, padding: 0, border: "1px solid var(--line-2)", borderRadius: 4 }}/>
      </SetRow>
      <SetRow label="Density">
        <SetSegmented value={s.density} onChange={(v) => up("density", v)}
          options={[{ id: "comfortable", label: "Comfortable" }, { id: "balanced", label: "Balanced" }, { id: "spacious", label: "Spacious" }]}/>
      </SetRow>
      <SetRow label="Manuscript font" hint="What you read while drafting.">
        <SetSelect value={s.manuscriptFont} onChange={(v) => up("manuscriptFont", v)}
          options={["Source Serif 4","EB Garamond","Cormorant Garamond","Crimson Pro","System serif"]}/>
      </SetRow>
      <SetRow label="UI font" hint="Panels, menus, side rails.">
        <SetSelect value={s.uiFont} onChange={(v) => up("uiFont", v)}
          options={["Inter Tight","Inter","System sans","Söhne","Geist"]}/>
      </SetRow>
      <SetRow label="Motion" hint="Animations across the app.">
        <SetToggle checked={s.reducedMotion} onChange={(v) => up("reducedMotion", v)} label="Reduce motion" hint="Disables drawer slides + workspace fades."/>
      </SetRow>
    </SetGroupCard>
  );
};

// =====================================================================
// EDITOR
// =====================================================================
const SetEditor = () => {
  const [s, setS] = useLWSettingState("editor", {
    spellcheck: true, grammarSuggestions: true, styleSuggestions: false, thesaurus: true,
    sentenceRestructure: false, voiceConsistency: true,
    autosave: true, autosaveInterval: 30,
    marginsDefault: "both", chapterTabBehaviour: "expand", authorStamp: true,
  });
  const up = (k, v) => setS({ ...s, [k]: v });
  return (
    <SetGroupCard title="Editor" hint="What happens while you type and what shows in the margins.">
      <SetRow label="Linting"><div className="set-stack">
        <SetToggle checked={s.spellcheck} onChange={(v) => up("spellcheck", v)} label="Spellcheck"/>
        <SetToggle checked={s.grammarSuggestions} onChange={(v) => up("grammarSuggestions", v)} label="Grammar suggestions"/>
        <SetToggle checked={s.styleSuggestions}   onChange={(v) => up("styleSuggestions", v)}   label="Style suggestions" hint="Brevity, voice, cliché"/>
        <SetToggle checked={s.thesaurus}          onChange={(v) => up("thesaurus", v)}          label="Thesaurus on right-click"/>
        <SetToggle checked={s.sentenceRestructure} onChange={(v) => up("sentenceRestructure", v)} label="Sentence-restructure suggestions"/>
        <SetToggle checked={s.voiceConsistency}   onChange={(v) => up("voiceConsistency", v)}   label="Voice consistency checks" hint="Flags POV drift mid-chapter"/>
      </div></SetRow>
      <SetRow label="Autosave">
        <SetToggle checked={s.autosave} onChange={(v) => up("autosave", v)} label="Autosave"/>
      </SetRow>
      {s.autosave && (
        <SetRow label="Autosave interval"><SetSlider value={s.autosaveInterval} onChange={(v) => up("autosaveInterval", v)} min={5} max={300} step={5} unit="s"/></SetRow>
      )}
      <SetRow label="Margin visibility">
        <SetSegmented value={s.marginsDefault} onChange={(v) => up("marginsDefault", v)}
          options={[{ id: "none", label: "Hidden" }, { id: "left", label: "Notes" }, { id: "right", label: "Extraction" }, { id: "both", label: "Both" }]}/>
      </SetRow>
      <SetRow label="Chapter tab behaviour">
        <SetSegmented value={s.chapterTabBehaviour} onChange={(v) => up("chapterTabBehaviour", v)}
          options={[{ id: "expand", label: "Expand on hover" }, { id: "click", label: "Click to open" }, { id: "always", label: "Always expanded" }]}/>
      </SetRow>
      <SetRow label="Author attribution"><SetToggle checked={s.authorStamp} onChange={(v) => up("authorStamp", v)} label="Show author stamps in margin"/></SetRow>
    </SetGroupCard>
  );
};

// =====================================================================
// AUTHORS
// =====================================================================
const SetAuthors = () => {
  // Neutral default — a single "You" profile, not demo authors, so a fresh
  // project never seeds fictional author names into the store (UAT #6).
  const [authors, setAuthors] = useLWSettingState("authors", [
    { id: "you", name: "You", initials: "Y", color: "#9a7b3a", role: "Primary author", style: "" },
  ]);
  return (
    <SetGroupCard title="Author profiles" hint="Track who wrote what; colour-code attribution in the manuscript."
      actions={<button className="set-btn set-btn--accent" data-callback="onCreateAuthorProfile" onClick={() => setAuthors([...authors, { id: "new-" + Date.now(), name: "New author", initials: "NA", color: "#888", role: "Co-writer", style: "" }])}><Icon name="plus" size={11}/> Add author</button>}>
      <div className="set-author-list">
        {authors.map((a, i) => (
          <div key={a.id} className="set-author">
            <div className="set-author__avatar" style={{ background: a.color }}>{a.initials}</div>
            <div className="set-author__body">
              <input className="set-input" value={a.name} onChange={(e) => { const n = [...authors]; n[i] = { ...a, name: e.target.value }; setAuthors(n); }}/>
              <div className="set-author__row">
                <input className="set-input set-input--small" value={a.initials} maxLength={3} onChange={(e) => { const n = [...authors]; n[i] = { ...a, initials: e.target.value.toUpperCase() }; setAuthors(n); }}/>
                <input type="color" value={a.color} onChange={(e) => { const n = [...authors]; n[i] = { ...a, color: e.target.value }; setAuthors(n); }} style={{ width: 36, height: 28, padding: 0, border: "1px solid var(--line-2)", borderRadius: 4 }}/>
                <select className="set-input set-input--small" value={a.role} onChange={(e) => { const n = [...authors]; n[i] = { ...a, role: e.target.value }; setAuthors(n); }}>
                  {["Primary author","Co-writer","Editor","AI","Beta reader","Other"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <input className="set-input set-input--small" placeholder="Default writing style" value={a.style} onChange={(e) => { const n = [...authors]; n[i] = { ...a, style: e.target.value }; setAuthors(n); }}/>
            </div>
            <button className="set-btn set-btn--ghost" onClick={() => setAuthors(authors.filter((_, j) => j !== i))} data-callback="onDeleteAuthorProfile">Remove</button>
          </div>
        ))}
      </div>
    </SetGroupCard>
  );
};

// =====================================================================
// AI PROVIDERS (BYOK)
// =====================================================================
const SetAIProviders = () => {
  const [providers, setProviders] = _set_us(() => SET_AI_PROVIDERS.map((p) => ({
    ...p,
    ...(window.LoomwrightBackend?.KeysService?.loadAllProviderSettingsSync()?.[p.id] || {}),
    apiKey: "",
    model: (window.LoomwrightBackend?.KeysService?.loadAllProviderSettingsSync()?.[p.id]?.model) || p.defaultModel,
    uses: (window.LoomwrightBackend?.KeysService?.loadAllProviderSettingsSync()?.[p.id]?.uses) || p.suggestedUses.reduce((acc, u) => ({ ...acc, [u]: true }), {}),
  })));
  const [addOpen, setAddOpen] = _set_us(false);
  const [aiTier, setAiTier] = _set_us(() => window.LoomwrightBackend?.AIRoutingService?.loadSync?.()?.tier || "normal");
  const chooseTier = (t) => {
    setAiTier(t);
    window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onSetAITier", detail: { tier: t } } }));
  };

  const up = (id, k, v) => setProviders((arr) => {
    const next = arr.map((p) => {
      if (p.id !== id) return p;
      if (k === "apiKey") return { ...p, apiKey: v, hasKey: !!v || !!p.hasKey };
      if (k === "hasKey" && v === false) return { ...p, hasKey: false, apiKey: "" };
      return { ...p, [k]: v };
    });
    const provider = next.find((p) => p.id === id);
    if (provider) {
      window.LoomwrightBackend?.KeysService?.saveProvider(id, provider);
    }
    return next;
  });

  const addExtra = (def) => {
    if (providers.find((p) => p.id === def.id)) return;
    setProviders([...providers, { ...def, enabled: false, apiKey: "", model: "", suggestedUses: ["writing"], uses: { writing: true } }]);
    setAddOpen(false);
  };

  return (
    <SetGroupCard
      title="AI providers — bring your own key"
      hint="Loomwright is a shell. Every AI call uses your own API key from the provider you pick. We never proxy your key."
      actions={
        <button className="set-btn set-btn--accent" onClick={() => setAddOpen((o) => !o)} data-callback="onAddAIProvider">
          <Icon name="plus" size={11}/> Add provider
        </button>
      }>

      {/* BYOK note */}
      <div className="set-note">
        <Icon name="shield" size={12}/>
        <span>
          <b>You control AI costs.</b> Loomwright never sends content to AI providers without your action. Manuscript text is only sent when you confirm. Local-only mode means zero outbound calls.
        </span>
      </div>

      {/* Cost tier */}
      <SetRow label="Cost tier" hint="Free uses only local providers like Ollama — no tokens, no cost, nothing leaves your device. Higher tiers use your configured cloud provider.">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["free", "Free · local only"], ["budget", "Budget"], ["normal", "Normal"], ["extended", "Extended"], ["full", "Full"]].map(([val, label]) => (
            <button
              key={val}
              type="button"
              data-callback="onSetAITier"
              data-tier={val}
              aria-pressed={aiTier === val}
              onClick={() => chooseTier(val)}
              className={"set-btn " + (aiTier === val ? "set-btn--accent" : "set-btn--outline")}
            >
              {label}
            </button>
          ))}
        </div>
      </SetRow>

      {/* Provider list */}
      <div className="set-providers">
        {providers.map((p) => (
          <div key={p.id} className={"set-provider " + (p.enabled ? "is-on" : "")}>
            <div className="set-provider__head">
              <div className="set-provider__icon"><Icon name={p.isLocal ? "shield" : "sparkle"} size={14}/></div>
              <div className="set-provider__titles">
                <div className="set-provider__name">{p.name}</div>
                <div className="set-provider__blurb">{p.blurb}</div>
              </div>
              <SetToggle checked={p.enabled} onChange={(v) => up(p.id, "enabled", v)} label={p.enabled ? "Enabled" : "Disabled"}/>
            </div>

            {p.enabled && (
              <div className="set-provider__body">
                {p.isCustom && (
                  <SetRow label="Base URL" hint="OpenAI-compatible endpoint">
                    <SetInput value={p.baseUrl} onChange={(v) => up(p.id, "baseUrl", v)} placeholder="https://api.example.com/v1" mono/>
                  </SetRow>
                )}
                <SetRow label={p.isLocal ? "Endpoint" : "API key"} hint={p.keyHint || ""}>
                  <SetInput value={p.apiKey} onChange={(v) => up(p.id, "apiKey", v)} placeholder={p.isLocal ? "http://localhost:11434" : (p.hasKey ? "Stored encrypted locally — paste to replace" : "Paste your key")} mono/>
                </SetRow>
                <SetRow label="Model preference">
                  <SetInput value={p.model} onChange={(v) => up(p.id, "model", v)} placeholder={p.defaultModel || "model-id"} mono/>
                </SetRow>
                <SetRow label="Use for" hint="Which AI tasks this provider handles by default.">
                  <div className="set-use-grid">
                    {SET_AI_USE_CASES.map((u) => (
                      <label key={u.id} className="set-use">
                        <input type="checkbox" checked={!!p.uses[u.id]} onChange={(e) => up(p.id, "uses", { ...p.uses, [u.id]: e.target.checked })}/>
                        <span>{u.label}</span>
                      </label>
                    ))}
                  </div>
                </SetRow>
                <SetRow label="Connection" hint="Sends a test request (no manuscript content).">
                  <div className="set-row__inline">
                    <button className="set-btn set-btn--outline" data-callback="onTestAIProviderConnection" data-provider-id={p.id} onClick={async () => {
                      const result = await window.LoomwrightBackend?.KeysService?.testProvider(p.id);
                      window.dispatchEvent(new CustomEvent("lw:ai-provider-test", { detail: result }));
                    }}>
                      <Icon name="bolt" size={11}/> Test connection
                    </button>
                    {p.hasKey && (
                      <button className="set-btn set-btn--ghost" data-callback="onClearAIProviderKey" onClick={() => {
                        window.LoomwrightBackend?.KeysService?.clearProviderKey(p.id);
                        up(p.id, "hasKey", false);
                      }}>
                        <Icon name="trash" size={11}/> Clear stored key
                      </button>
                    )}
                    {p.keyLink && (
                      <a className="set-link" href={p.keyLink} target="_blank" rel="noreferrer">
                        Where to get a key <Icon name="arrow-right" size={10}/>
                      </a>
                    )}
                  </div>
                </SetRow>
                <div className="set-privacy-note">
                  <Icon name="alert" size={10}/>
                  <span>Manuscript text is sent to this provider only when you trigger an AI action that includes it.</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add more */}
      {addOpen && (
        <div className="set-add-more">
          <div className="set-add-more__head">Add another provider</div>
          <div className="set-add-more__grid">
            {SET_AI_PROVIDERS_MORE.map((def) => (
              <button key={def.id} className="set-add-more__row" onClick={() => addExtra(def)}>
                <div>
                  <div className="set-add-more__name">{def.name}</div>
                  <div className="set-add-more__blurb">{def.blurb}</div>
                </div>
                <Icon name="plus" size={11}/>
              </button>
            ))}
          </div>
        </div>
      )}
    </SetGroupCard>
  );
};

// =====================================================================
// AI ROUTING / COST
// =====================================================================
const SetAIRouting = () => {
  const [s, setS] = useLWSettingState("ai-routing", {
    mode: "balanced",
    summariseFirst: true, cacheContext: true, excludeDormant: true, preferSummaries: true, confirmManuscript: true,
    maxContext: 16000,
  });
  const up = (k, v) => setS({ ...s, [k]: v });
  return (
    <SetGroupCard title="AI routing & cost" hint="Decide how much context Loomwright sends, and when.">
      <SetRow label="Routing mode" hint="A quick floor for token budget — affects what context is included by default.">
        <SetSegmented value={s.mode} onChange={(v) => up("mode", v)}
          options={[
            { id: "no-ai",      label: "No AI" },
            { id: "external",   label: "External handoff only" },
            { id: "budget",     label: "Budget" },
            { id: "balanced",   label: "Balanced" },
            { id: "quality",    label: "Quality" },
            { id: "user",       label: "Per-call" },
          ]}/>
      </SetRow>
      {s.mode === "no-ai"    && <div className="set-note set-note--info"><b>Local-only.</b> No outbound AI calls. Extraction, suggestions, drafting all disabled.</div>}
      {s.mode === "external" && <div className="set-note set-note--info"><b>External handoff only.</b> Loomwright won't call your AI keys at all — you'll use the <b>AI Handoff Pack</b> to export/import context manually. Free.</div>}

      <SetRow label="Maximum context size" hint="Hard ceiling for any single prompt. Tokens.">
        <SetSlider value={s.maxContext} onChange={(v) => up("maxContext", v)} min={1000} max={128000} step={1000} unit=" tok"/>
      </SetRow>
      <SetRow label="Optimisation">
        <div className="set-stack">
          <SetToggle checked={s.summariseFirst} onChange={(v) => up("summariseFirst", v)} label="Summarise before sending" hint="Compress dossiers into 2–3 lines first."/>
          <SetToggle checked={s.cacheContext}  onChange={(v) => up("cacheContext", v)}   label="Cache context across turns" hint="Reuses last prompt's context where the provider supports it."/>
          <SetToggle checked={s.excludeDormant} onChange={(v) => up("excludeDormant", v)} label="Exclude dormant entities" hint="Anything flagged dormant or do-not-suggest stays out."/>
          <SetToggle checked={s.preferSummaries} onChange={(v) => up("preferSummaries", v)} label="Prefer summaries over full dossiers"/>
          <SetToggle checked={s.confirmManuscript} onChange={(v) => up("confirmManuscript", v)} label="Confirm before sending manuscript text" hint="Adds a 'are you sure?' for any action that would send a passage."/>
        </div>
      </SetRow>
    </SetGroupCard>
  );
};

// =====================================================================
// PER-TASK MODEL ROUTING (AI Writer model picker)
//
// The backend (AIRoutingService.taskRoutes + resolveRoute) already supports
// routing each AI task to a specific provider + model; this surfaces it. Each
// task can be left on "Auto" (default provider / tier resolution) or pinned to
// a configured provider and one of its models. Persists straight to
// AIRoutingService so extraction, drafting, etc. pick it up on the next call.
// =====================================================================
const TASK_ROUTES_META = [
  { id: "writingDraft",        label: "Draft generation",     hint: "Composition overlay — Generate Draft." },
  { id: "rewritePassage",      label: "Rewrite passage",      hint: "Rewrite / expand a selected passage." },
  { id: "continueWriting",     label: "Continue writing",     hint: "Continue from the cursor." },
  { id: "quickExtraction",     label: "Quick extraction",     hint: "Fast per-chapter entity scan." },
  { id: "deepExtraction",      label: "Deep extraction",      hint: "Thorough multi-pass extraction." },
  { id: "continuityCheck",     label: "Continuity check",     hint: "Contradiction / canon checks." },
  { id: "projectIntelligence", label: "Project intelligence", hint: "Rebuild the distilled project brief." },
  { id: "referenceSummary",    label: "Reference summary",    hint: "Summarise a reference source." },
  { id: "skillTreeGeneration", label: "Skill-tree generation",hint: "Draft skill-tree nodes." },
  { id: "aiHandoffAssist",     label: "Handoff assist",       hint: "Prep the external AI handoff pack." },
];

const SetTaskRouting = () => {
  const RS = () => window.LoomwrightBackend?.AIRoutingService;
  const KS = () => window.LoomwrightBackend?.KeysService;
  const [version, setVersion] = _set_us(0);
  _set_ue(() => {
    const bump = () => setVersion((v) => v + 1);
    const evs = ["lw:ai-routing-updated", "lw:ai-providers-updated", "lw:settings-updated", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  const routing = _set_um(() => (RS()?.loadSync?.() || { taskRoutes: {} }), [version]);
  const taskRoutes = routing.taskRoutes || {};

  // Providers usable for a real call: enabled + keyed (or a local provider).
  const providerCfgs = _set_um(() => KS()?.loadAllProviderSettingsSync?.() || {}, [version]);
  const usableProviders = _set_um(() => Object.values(providerCfgs).filter((c) =>
    c && c.enabled !== false && (c.hasKey || RS()?.isLocalProviderCfg?.(c))
  ), [providerCfgs, version]);

  const providerName = (id) => {
    const curated = SET_AI_PROVIDERS.find((p) => p.id === id);
    if (curated) return curated.name;
    const cfg = providerCfgs[id];
    return (cfg && (cfg.name || cfg.providerType)) || id;
  };
  const modelsFor = (id) => {
    const cfg = providerCfgs[id];
    if (cfg && Array.isArray(cfg.availableModels) && cfg.availableModels.length) return cfg.availableModels;
    const dm = (cfg && (cfg.defaultModel || cfg.model)) || (SET_AI_PROVIDERS.find((p) => p.id === id)?.defaultModel);
    return dm ? [dm] : [];
  };

  const setRoute = (task, providerId, model) => {
    // Empty providerId → "Auto": store an empty route so resolveRoute ignores it.
    const entry = providerId ? { providerId, model: model || (modelsFor(providerId)[0] || "") } : {};
    RS()?.save?.({ taskRoutes: { [task]: entry } });
    setVersion((v) => v + 1);
  };

  const providerOptions = [{ value: "", label: "Auto (default / tier)" }]
    .concat(usableProviders.map((p) => ({ value: p.id, label: providerName(p.id) })));

  return (
    <SetGroupCard title="Per-task model routing" hint="Pin an AI task to a specific provider and model, or leave it on Auto to follow your default provider and cost tier.">
      {usableProviders.length === 0 ? (
        <div className="set-note set-note--info" data-testid="task-routing-empty">
          <b>No usable providers yet.</b> Add and enable a provider (with a key, or a local
          provider like Ollama) in <b>AI Providers</b> to route individual tasks.
        </div>
      ) : (
        TASK_ROUTES_META.map((t) => {
          const route = taskRoutes[t.id] || {};
          const pinned = !!route.providerId;
          const models = pinned ? modelsFor(route.providerId) : [];
          return (
            <SetRow key={t.id} label={t.label} hint={t.hint}>
              <div className="set-row__inline" data-task-route={t.id}>
                <SetSelect value={route.providerId || ""} options={providerOptions}
                  onChange={(pid) => setRoute(t.id, pid, "")}/>
                {pinned && models.length > 0 && (
                  <SetSelect value={route.model || models[0]} options={models}
                    onChange={(m) => setRoute(t.id, route.providerId, m)}/>
                )}
                {pinned && models.length === 0 && (
                  <SetInput value={route.model || ""} placeholder="model name"
                    onChange={(m) => setRoute(t.id, route.providerId, m)}/>
                )}
              </div>
            </SetRow>
          );
        })
      )}
    </SetGroupCard>
  );
};

// =====================================================================
// PRIVACY
// =====================================================================
const SetPrivacy = () => {
  const [s, setS] = useLWSettingState("privacy", {
    localOnly: false, requireConfirm: true, disableCloud: false,
    redactSensitive: false,
  });
  const up = (k, v) => setS({ ...s, [k]: v });
  return (
    <SetGroupCard title="Privacy" hint="What leaves your machine, and when.">
      <SetRow label="Mode">
        <SetSegmented value={s.localOnly ? "local" : "byok"} onChange={(v) => up("localOnly", v === "local")}
          options={[{ id: "local", label: "Local-only" }, { id: "byok", label: "BYOK (you've added keys)" }]}/>
      </SetRow>
      <SetRow label="Confirmations"><div className="set-stack">
        <SetToggle checked={s.requireConfirm} onChange={(v) => up("requireConfirm", v)} label="Require confirmation before sending manuscript content to AI"/>
        <SetToggle checked={s.disableCloud}   onChange={(v) => up("disableCloud", v)}   label="Disable all cloud calls" hint="Includes provider 'test connection' calls."/>
        <SetToggle checked={s.redactSensitive} onChange={(v) => up("redactSensitive", v)} label="Redact sensitive fields before export" hint="Author secrets, real-world names, drafts marked private."/>
      </div></SetRow>
      <SetRow label="Cache">
        <div className="set-row__inline">
          <button className="set-btn set-btn--outline" data-callback="onClearCachedContext"><Icon name="trash" size={11}/> Clear cached AI context</button>
          <button className="set-btn set-btn--outline" data-callback="onExportPrivacyProfile"><Icon name="download" size={11}/> Export privacy profile</button>
        </div>
      </SetRow>
    </SetGroupCard>
  );
};

// =====================================================================
// EXTRACTION
// =====================================================================
const SetExtraction = () => {
  const [s, setS] = useLWSettingState("extraction", {
    aggressiveness: "balanced",
    autoAdd95: true, showAutoAddedInReview: true,
    scan: { cast: true, locations: true, items: true, quests: true, events: true, stats: true, relationships: true, lore: true, timeline: true, inventory: true },
    threshold: 80,
  });
  const up = (k, v) => setS({ ...s, [k]: v });
  return (
    <SetGroupCard title="Extraction" hint="What scans the manuscript and how aggressively.">
      <SetRow label="Aggressiveness">
        <SetSegmented value={s.aggressiveness} onChange={(v) => up("aggressiveness", v)}
          options={[{ id: "gentle", label: "Gentle" }, { id: "balanced", label: "Balanced" }, { id: "aggressive", label: "Aggressive" }]}/>
      </SetRow>
      <SetRow label="Auto-add (high-confidence)">
        <div className="set-stack">
          <SetToggle checked={s.autoAdd95} onChange={(v) => up("autoAdd95", v)} label="Auto-add candidates ≥95% confidence" hint="Skip the review queue when very sure."/>
          <SetToggle checked={s.showAutoAddedInReview} onChange={(v) => up("showAutoAddedInReview", v)} label="Show auto-added in review queue anyway"/>
        </div>
      </SetRow>
      <SetRow label="Confidence threshold" hint="Minimum % before a candidate is suggested.">
        <SetSlider value={s.threshold} onChange={(v) => up("threshold", v)} min={50} max={99} unit="%"/>
      </SetRow>
      <SetRow label="Scan" hint="Toggle which entity types extraction looks for.">
        <div className="set-scan-grid">
          {Object.keys(s.scan).map((k) => (
            <label key={k} className="set-use">
              <input type="checkbox" checked={s.scan[k]} onChange={(e) => up("scan", { ...s.scan, [k]: e.target.checked })}/>
              <span style={{ textTransform: "capitalize" }}>{k}</span>
            </label>
          ))}
        </div>
      </SetRow>
    </SetGroupCard>
  );
};

// =====================================================================
// REVIEW QUEUE
// =====================================================================
const SetReview = () => {
  const [s, setS] = useLWSettingState("review", {
    defaultFilter: "uncertain",
    showBands: true, bulkActions: true, sourceQuote: true,
    showAutoAdded: false, showDenied: false, mergeSuggestions: true,
  });
  const up = (k, v) => setS({ ...s, [k]: v });
  return (
    <SetGroupCard title="Review queue" hint="What the queue shows by default and how it behaves.">
      <SetRow label="Default filter">
        <SetSegmented value={s.defaultFilter} onChange={(v) => up("defaultFilter", v)}
          options={[{ id: "all", label: "All" }, { id: "uncertain", label: "Uncertain" }, { id: "high", label: "High-confidence" }, { id: "denied", label: "Denied" }]}/>
      </SetRow>
      <SetRow label="Display"><div className="set-stack">
        <SetToggle checked={s.showBands} onChange={(v) => up("showBands", v)} label="Show confidence bands"/>
        <SetToggle checked={s.bulkActions} onChange={(v) => up("bulkActions", v)} label="Enable bulk actions"/>
        <SetToggle checked={s.sourceQuote} onChange={(v) => up("sourceQuote", v)} label="Show source quote preview"/>
        <SetToggle checked={s.showAutoAdded} onChange={(v) => up("showAutoAdded", v)} label="Show auto-added items"/>
        <SetToggle checked={s.showDenied} onChange={(v) => up("showDenied", v)} label="Show denied history"/>
        <SetToggle checked={s.mergeSuggestions} onChange={(v) => up("mergeSuggestions", v)} label="Suggest merges with existing entities"/>
      </div></SetRow>
    </SetGroupCard>
  );
};

// =====================================================================
// PROJECT INTELLIGENCE
// =====================================================================
const SetIntel = ({ onRequest }) => {
  const openRefs = () => onRequest && onRequest.openPanel ? onRequest.openPanel("references") : window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "references" } }));
  const openResearchLibrary = () => window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
    detail: { workspaceId: "research-library", panelKind: "references", sourcePanel: "p-references" },
  }));
  const openOnboardingAnswers = () => {
    openResearchLibrary();
    // After the workspace mounts, switch it into onboarding mode.
    setTimeout(() => window.dispatchEvent(new CustomEvent("lw:open-onboarding-answers")), 80);
  };
  return (
    <SetGroupCard title="Project Intelligence" hint="The curated brief shown to AI: style, canon, voice, taboos, current arc.">
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 12, lineHeight: 1.55, margin: "0 0 12px" }}>
        Project Intelligence is the file every AI surface reads from. References holds source material;
        Project Intelligence distills it into a structured brief. Onboarding answers live inside it too.
      </p>
      <div className="set-stack">
        <button className="set-btn set-btn--outline" data-callback="onOpenProjectIntelligenceFile">
          <Icon name="paper" size={11}/> Open Project Intelligence File
        </button>
        <button className="set-btn set-btn--outline" onClick={openResearchLibrary} data-callback="onOpenReferences">
          <Icon name="paper" size={11}/> Open References / Research Library
        </button>
        <button className="set-btn set-btn--outline" onClick={openOnboardingAnswers} data-callback="onOpenOnboardingAnswers">
          <Icon name="info" size={11}/> Open onboarding answers
        </button>
      </div>

      <div className="set-card__divider"/>

      <div className="set-card__title set-card__title--sm">External-AI handoff</div>
      <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "4px 0 8px" }}>
        Hand the project bible off to an external AI for improvement, then paste the improved JSON back in.
      </p>
      {typeof AIHandoffButton !== "undefined" && (
        <div className="set-row__inline">
          <AIHandoffButton
            surface="project-intelligence"
            variant="primary"
            label="Project Intelligence Handoff"
            icon="sparkle"
            context={{
              outputType: "entity",
              instructions: "Improve this Project Intelligence brief. Return JSON with the same top-level keys.",
              projectContext: { title: "The Auger's Door", genre: "Literary fantasy", projectIntelligence: { voice: "—", canon: [], taboos: [], currentArc: "—" } },
            }}/>
          <button className="set-btn set-btn--outline" data-callback="onCopyProjectContextPack"><Icon name="code" size={11}/> Copy full project context</button>
          <button className="set-btn set-btn--outline" data-callback="onCopyStyleProfilePack"><Icon name="code" size={11}/> Copy style profile</button>
          <button className="set-btn set-btn--outline" data-callback="onCopyCanonRulesPack"><Icon name="code" size={11}/> Copy canon rules</button>
          <button className="set-btn set-btn--outline" data-callback="onCopyCharacterBiblePack"><Icon name="code" size={11}/> Copy character bible</button>
        </div>
      )}
    </SetGroupCard>
  );
};

// =====================================================================
// REFERENCES (link to Research Library)
// =====================================================================
const SetReferences = ({ onRequest }) => {
  const openResearchLibrary = () => window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
    detail: { workspaceId: "research-library", panelKind: "references", sourcePanel: "p-references" },
  }));
  return (
    <SetGroupCard title="References / Research" hint="Source materials Loomwright can show your AI. Style samples, canon sources, research notes.">
      <div className="set-stack">
        <button className="set-btn set-btn--outline" onClick={openResearchLibrary} data-callback="onOpenReferences">
          <Icon name="paper" size={11}/> Open Research Library →
        </button>
        <SetToggle checked label="Include references in AI context by default"/>
        <SetToggle checked label="Include style samples in AI context"/>
        <SetToggle label="Include canon sources only when relevant"/>
      </div>
      {typeof AIHandoffButton !== "undefined" && (
        <>
          <div className="set-card__divider"/>
          <div className="set-row__inline">
            <button className="set-btn set-btn--outline" data-callback="onBuildReferenceContextPack"><Icon name="code" size={11}/> Build reference context pack</button>
            <button className="set-btn set-btn--outline" data-callback="onExportStyleInfluencePack"><Icon name="code" size={11}/> Export style pack</button>
            <button className="set-btn set-btn--outline" data-callback="onExportCanonSourcePack"><Icon name="code" size={11}/> Export canon pack</button>
            <button className="set-btn set-btn--outline" data-callback="onImportExternalResearchNotes"><Icon name="download" size={11}/> Import research notes</button>
          </div>
        </>
      )}
    </SetGroupCard>
  );
};

// =====================================================================
// IMPORT / EXPORT
// =====================================================================
const SetImport = () => (
  <SetGroupCard title="Import / Export" hint="Move your project in and out.">
    <div className="set-grid-2">
      <button className="set-btn set-btn--outline" data-callback="onExportProjectData"><Icon name="download" size={11}/> Export project</button>
      <button className="set-btn set-btn--outline" data-callback="onImportProjectData"><Icon name="paper" size={11}/> Import project</button>
      <button className="set-btn set-btn--outline" data-callback="onExportEntityLibrary"><Icon name="download" size={11}/> Export entity library</button>
      <button className="set-btn set-btn--outline" data-callback="onImportEntityLibrary"><Icon name="paper" size={11}/> Import entity library</button>
      <button className="set-btn set-btn--outline" data-callback="onExportAIHandoffPack"><Icon name="sparkle" size={11}/> Export AI Handoff Pack</button>
      <button className="set-btn set-btn--outline" data-callback="onExportSettingsProfile"><Icon name="download" size={11}/> Export settings profile</button>
      <button className="set-btn set-btn--outline" data-callback="onImportSettingsProfile"><Icon name="paper" size={11}/> Import settings profile</button>
      <button className="set-btn set-btn--outline" data-callback="onBackupNow"><Icon name="stack" size={11}/> Backup now</button>
      <button className="set-btn set-btn--primary" data-callback="onLoadSampleProject"><Icon name="sparkle" size={11}/> Load sample project</button>
    </div>
  </SetGroupCard>
);

// =====================================================================
// SHORTCUTS
// =====================================================================
const SetShortcuts = () => (
  <SetGroupCard title="Keyboard shortcuts">
    <div className="set-grid-2">
      {[
        ["Command palette", "⌘P"],
        ["Adaptive wheel", "⌘K"],
        ["Open Writer's Room", "⌘1"],
        ["Open search", "⌘F"],
        ["Open review queue", "⌘⇧R"],
        ["Quick create", "⌘N"],
        ["Open Composition Overlay", "⌘⇧C"],
        ["Save", "⌘S"],
        ["Save & extract", "⌘E"],
        ["Focus mode", "⌘⌥F"],
        ["Speed Reader play/pause", "Space"],
        ["Speed Reader bookmark", "B"],
        ["Speed Reader next sentence", "⇧→"],
      ].map(([k, v], i) => (
        <div key={i} className="set-shortcut">
          <span>{k}</span>
          <span className="set-kbd">{v}</span>
        </div>
      ))}
    </div>
  </SetGroupCard>
);

// =====================================================================
// DEBUG
// =====================================================================
const SetDebug = () => (
  <SetGroupCard title="Debug & tweaks" hint="State diagnostics and reset tools.">
    <div className="set-stack">
      <SetToggle label="Show debug panel" hint="Live panel/route state + last drag payload."/>
      <SetToggle label="Verbose extraction logs"/>
      <SetToggle label="Show z-index ladder overlay"/>
    </div>
    <div className="set-card__divider"/>
    <div className="set-row__inline">
      <button className="set-btn set-btn--outline" data-callback="onResetLayout"><Icon name="refresh" size={11}/> Reset layout</button>
      <button className="set-btn set-btn--outline" data-callback="onClearLocalDemoData"><Icon name="trash" size={11}/> Clear sample data</button>
      <button className="set-btn set-btn--outline" data-callback="onResetProjectData"><Icon name="trash" size={11}/> Reset project data</button>
      <button className="set-btn set-btn--outline" data-callback="onShowLastAIHandoff"><Icon name="sparkle" size={11}/> Show last AI handoff pack</button>
    </div>
  </SetGroupCard>
);

// =====================================================================
// Dispatcher — used by ControlCentreWorkspace
// =====================================================================
const RichSettingsSection = ({ sectionId, onRequest }) => {
  switch (sectionId) {
    case "project":    return <SetProject/>;
    case "brand":      return <SetBrand/>;
    case "editor":     return <SetEditor/>;
    case "authors":    return <SetAuthors/>;
    case "ai":         return <SetAIProviders/>;
    case "ai-routing": return <><SetAIRouting/><SetTaskRouting/></>;
    case "privacy":    return <SetPrivacy/>;
    case "extraction": return <SetExtraction/>;
    case "review":     return <SetReview/>;
    case "intel":      return <SetIntel onRequest={onRequest}/>;
    case "references": return <SetReferences onRequest={onRequest}/>;
    case "import":     return <SetImport/>;
    case "shortcuts":  return <SetShortcuts/>;
    case "debug":      return <SetDebug/>;
    default:           return null;
  }
};

Object.assign(window, {
  RichSettingsSection, SetTaskRouting, TASK_ROUTES_META,
  SET_AI_PROVIDERS, SET_AI_PROVIDERS_MORE, SET_AI_USE_CASES,
});
