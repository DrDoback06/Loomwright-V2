// =====================================================================
// onboarding.jsx — OnboardingWizard host. Controls step state, autosave,
// data, top bar, footer nav, and renders the active step body.
// =====================================================================

const { useState: _us_W, useEffect: _ue_W, useMemo: _um_W, useRef: _ur_W, useCallback: _uc_W } = React;

// --- defaults --------------------------------------------------------
const ONBOARDING_DEFAULTS = {
  welcome:    { title: "The Hollow Crown", series: "The Auger Cycle", book: "Book II — Ash & Auger", format: "Novel", genre: "Fantasy", subgenre: "Gothic", audience: "Adult", length: "Standard (60–100k)", stage: "Outlining", start: "blank" },
  foundation: { premise: "", logline: "", coreConflict: "", themes: [], toneWords: [], comparables: "", isNot: "", pov: "Close third", tense: "Past", readerExperience: "Atmospheric" },
  style:      { dials: { vocab: 3, sentence: 3, pacing: 2, dialogue: 2, description: 3, humour: 1, tension: 3 }, narratorTone: "", avoid: "", signature: "" },
  voice:      { sample: "", samples: [], primary: false, analyzed: false },
  world:      { worldType: "Secondary fantasy", magic: "", politics: "", factions: "", locations: "", history: "", canonRules: [], forbidden: [], terminology: [] },
  cast:       { seeds: [] },
  rpg:        { template: "Genre-neutral", suggestExamples: true, toggles: { classes: false, races: false, stats: false, abilities: false, skillTrees: false, inventory: false, quests: true, factions: true } },
  plot:       { beats: [], targetChapters: 28 },
  manuscript: { mode: "blank", chapters: [], autoDetect: true, manualSplit: true, reserve: true, runExtraction: true },
  references: { items: [], pasteTitle: "", pasteText: "" },
  ai:         { mode: "local", provider: "anthropic", storeLocal: true, allowEgress: false, key: "", validation: "idle" },
  review:     { autoAddHigh: true, showAutoInQueue: true, aggressiveness: 2, falsePositive: 1, missingTolerance: 2, queueDisplay: "by-confidence", scan: { cast: true, locations: true, items: true, factions: true, lore: true, stats: false, relationships: true, events: true } },
  workspace:  { startTab: "writers-room", editorWidth: 740, font: "Source Serif 4", margins: true, panelStack: "stack-right", focus: false, themeIntensity: 50, chapterRail: "left", authorAttribution: true, mobileCompact: true },
};

// --- progress / completion ------------------------------------------
const isStepComplete = (id, data) => {
  switch (id) {
    case "welcome":    return !!(data.welcome?.title && data.welcome?.format && data.welcome?.start);
    case "foundation": return !!(data.foundation?.premise && (data.foundation?.themes?.length || data.foundation?.toneWords?.length));
    case "style":      return Object.keys(data.style?.dials || {}).length >= 4;
    case "voice":      return !!(data.voice?.sample || data.voice?.uploaded);
    case "world":      return (data.world?.canonRules?.length || 0) > 0 || !!data.world?.worldType;
    case "cast":       return (data.cast?.seeds?.length || 0) > 0;
    case "rpg":        return Object.values(data.rpg?.toggles || {}).some(Boolean) || !!data.rpg?.template;
    case "plot":       return (data.plot?.beats?.length || 0) > 0;
    case "manuscript": return !!data.manuscript?.mode;
    case "references": return true;
    case "ai":         return !!data.ai?.mode;
    case "review":     return !!data.review?.queueDisplay;
    case "workspace":  return !!data.workspace?.startTab;
    case "summary":    return false;
    default: return false;
  }
};

// --- top bar ---------------------------------------------------------
const OnboardingTopBar = ({ saveState, onExit, onMinimize }) => (
  <div className="ob__topbar" data-ui="OnboardingTopBar">
    <div className="ob__topbar__brand">
      <div className="ob__topbar__seal">{BRAND.shortName}</div>
      <div className="ob__topbar__title">
        <strong>{BRAND.name}</strong>
        <span>New project ritual · Welcome to your writing room</span>
      </div>
    </div>
    <div className="ob__topbar__right">
      <span className={"ob__autosave ob__autosave--" + saveState.kind}>
        <span className="chip__dot"/>{saveState.label}
      </span>
      <Btn variant="ghost"   size="sm" icon="bookmark" onClick={onMinimize} data-callback="onMinimizeOnboarding">Save & continue later</Btn>
      <Btn variant="outline" size="sm" icon="x"        onClick={onExit}     data-callback="onExitOnboarding">Exit setup</Btn>
    </div>
  </div>
);

// --- footer / nav ----------------------------------------------------
const OnboardingFooter = ({ stepIdx, total, step, complete, onBack, onSkip, onNext, onFinish, isLast }) => (
  <div className="ob__footer">
    <div className="ob__footer__hint">
      <span><kbd>↵</kbd> next</span>
      <span><kbd>⇧↵</kbd> back</span>
      <span><kbd>⌘S</kbd> save draft</span>
      <span><kbd>esc</kbd> close</span>
    </div>
    <div className="ob__footer__btns">
      <Btn variant="ghost" icon="arrow-left" onClick={onBack} disabled={stepIdx === 0} data-callback="onOnboardingStepChange">Back</Btn>
      {step.optional && !isLast && <Btn variant="outline" onClick={onSkip} data-callback="onSkipOnboardingStep">Skip step</Btn>}
      {isLast ? (
        <Btn variant="primary" icon="feather" onClick={onFinish} data-callback="onCompleteOnboarding">Open the door</Btn>
      ) : (
        <Btn variant="primary" icon="arrow-right" onClick={onNext} data-callback="onOnboardingStepChange">
          {complete ? "Continue" : (step.optional ? "Continue" : "Save & continue")}
        </Btn>
      )}
    </div>
  </div>
);

// --- step header -----------------------------------------------------
const OnboardingStepHeader = ({ step, idx, total }) => (
  <div className="ob__step__header">
    <div className="ob__step__eyebrow" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span>Step {idx + 1} of {total} · {step.short}</span>
      {step.optional && <span className="chip chip--neutral">optional</span>}
      {step.id !== "summary" && <IntelSaveIndicator category={step.id}/>}
    </div>
    <h1 className="ob__step__h1">{step.title}</h1>
    <p className="ob__step__lede">{step.lede}</p>
    {step.payoff && (
      <div className="ob__step__payoff" data-ui="OnboardingPayoff"
           style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(201,138,44,0.10)", border: "1px solid rgba(201,138,44,0.30)", fontSize: "var(--fs-sm)", color: "var(--ink-2)", lineHeight: 1.4 }}>
        <Icon name="sparkle" size={13}/>
        <span><b style={{ fontWeight: 600 }}>What you get — </b>{step.payoff}</span>
      </div>
    )}
  </div>
);

// =====================================================================
// OnboardingWizard — the host
// =====================================================================
const OnboardingWizard = ({ initial = {}, onCompleteOnboarding, onExitOnboarding, onMinimizeOnboarding }) => {
  const [data, setData] = _us_W({ ...ONBOARDING_DEFAULTS, ...initial });
  const [currentId, setCurrentId] = _us_W("welcome");
  const [completedIds, setCompletedIds] = _us_W([]);
  const [saveState, setSaveState] = _us_W({ kind: "saved", label: "Draft saved · just now" });

  // "Import existing project" start option: a real project import IS the
  // setup — mark onboarding complete and close the wizard.
  _ue_W(() => {
    const onImported = async (e) => {
      if (e?.detail?.sample) return;
      try { await window.LoomwrightBackend?.OnboardingService?.setStatus("complete"); } catch (_e) {}
      try { window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message: "Project imported — setup complete." } })); } catch (_e) {}
      // Close WITHOUT the host's exit path (that one stamps "skipped").
      window.dispatchEvent(new CustomEvent("lw:close-onboarding"));
    };
    window.addEventListener("lw:project-imported", onImported);
    return () => window.removeEventListener("lw:project-imported", onImported);
  }, []);
  const [intelOpen, setIntelOpen] = _us_W(false);
  const [history, setHistory] = _us_W([]);
  const saveTimer = _ur_W(null);

  const stepIdx  = ONBOARDING_STEPS.findIndex((s) => s.id === currentId);
  const step     = ONBOARDING_STEPS[stepIdx] || ONBOARDING_STEPS[0];
  const total    = ONBOARDING_STEPS.length;
  const isLast   = currentId === "summary";
  const complete = isStepComplete(currentId, data);
  const percent  = Math.round(
    (ONBOARDING_STEPS.filter((s) => isStepComplete(s.id, data)).length / (total - 1)) * 100
  );

  // setData for one section
  const setSection = _uc_W((key, val) => {
    let nextData = null;
    setData((d) => {
      setHistory((h) => [...h.slice(-9), { key, prev: d[key] }]);
      nextData = { ...d, [key]: val };
      return nextData;
    });
    // schedule autosave — actually persist to the backend so "save & continue
    // later" and reopening the wizard restore the answers.
    setSaveState({ kind: "saving", label: "Saving draft…" });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { if (nextData) window.LoomwrightBackend?.OnboardingService?.save(nextData, { skipAudit: true }); } catch (_e) {}
      setSaveState({ kind: "saved", label: "Draft saved · just now" });
    }, 700);
  }, []);

  // navigation
  const jumpTo = (id) => setCurrentId(id);
  const goNext = () => {
    if (complete && !completedIds.includes(currentId) && currentId !== "summary") {
      setCompletedIds((ids) => [...ids, currentId]);
    }
    if (stepIdx < total - 1) setCurrentId(ONBOARDING_STEPS[stepIdx + 1].id);
  };
  const goBack = () => {
    if (stepIdx > 0) setCurrentId(ONBOARDING_STEPS[stepIdx - 1].id);
  };
  const skip = () => {
    if (stepIdx < total - 1) setCurrentId(ONBOARDING_STEPS[stepIdx + 1].id);
  };
  const finish = () => {
    onCompleteOnboarding && onCompleteOnboarding(data);
  };

  // keybindings
  _ue_W(() => {
    const onKey = (e) => {
      const inField = e.target?.matches?.("input,textarea,select,[contenteditable]");
      if (e.key === "Enter" && !e.shiftKey && !inField) { e.preventDefault(); isLast ? finish() : goNext(); }
      if (e.key === "Enter" &&  e.shiftKey && !inField) { e.preventDefault(); goBack(); }
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSaveState({ kind: "saved", label: "Draft saved · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }); }
      if (e.key === "Escape") { onExitOnboarding && onExitOnboarding(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepIdx, isLast]);

  // scroll content area to top on step change
  const scrollRef = _ur_W(null);
  _ue_W(() => { scrollRef.current && scrollRef.current.scrollTo({ top: 0, behavior: "smooth" }); }, [currentId]);

  // --- callbacks bag passed to step bodies ---------------------------
  const callbacks = {
    onCopyHelperPrompt: (p) => {
      try { navigator.clipboard && navigator.clipboard.writeText(typeof p === "string" ? p : JSON.stringify(p, null, 2)); } catch (_e) {}
      setSaveState({ kind: "saved", label: "Prompt copied to clipboard" });
    },
    onQuickImportJson: (obj) => {
      try {
        const parsed = typeof obj === "string" ? JSON.parse(stripJsonFence(obj)) : obj;
        if (parsed && typeof parsed === "object") {
          setData((d) => {
            const next = { ...d, ...parsed };
            try { window.LoomwrightBackend?.OnboardingService?.save(next, { skipAudit: true }); } catch (_e) {}
            return next;
          });
          setSaveState({ kind: "saved", label: "Imported answers" });
        }
      } catch (_e) { setSaveState({ kind: "error", label: "Couldn't parse JSON" }); }
    },
    onCopyStepJsonPrompt: ({ category, prompt }) => {
      try { navigator.clipboard && navigator.clipboard.writeText(prompt || ""); } catch (_e) {}
      setSaveState({ kind: "saved", label: "Prompt copied" + (category ? " · " + category : "") });
    },
    onPasteStepJson: () => {},
    onApplyStepJson: ({ category, parsed }) => {
      if (category && parsed && typeof parsed === "object") setSection(category, { ...(data[category] || {}), ...parsed });
    },
    // One-click AI draft for a step: runs the step's existing JSON prompt
    // through the author's configured BYOK model and returns parsed fields to
    // preview (same apply path as a pasted reply — never auto-applied).
    onDraftStepWithAI: async ({ category, prompt } = {}) => {
      const B = window.LoomwrightBackend;
      if (!B || !B.AIService || !B.AIService.completeJson) return { ok: false, error: "AI is unavailable in this project." };
      const prov = (data.ai && data.ai.provider) || "anthropic";
      try {
        const cur = data[category] || {};
        const ctx = Object.keys(cur).length ? ("\n\nThe author already entered some values — improve and extend these, don't discard them:\n" + JSON.stringify(cur)) : "";
        const parsed = await B.AIService.completeJson({ providerId: prov, prompt: (prompt || "") + ctx, temperature: 0.7 });
        if (!parsed || typeof parsed !== "object") return { ok: false, error: "The AI didn't return usable JSON — try again, or paste a reply manually." };
        return { ok: true, parsed };
      } catch (e) {
        const msg = (e && e.message) || "";
        if (/api key|no key|configured/i.test(msg)) return { ok: false, error: "Add & validate your key in the “AI & Privacy” step to enable one-click drafting." };
        return { ok: false, error: msg.slice(0, 140) || "AI drafting failed." };
      }
    },
    onOpenIntelFile: () => setIntelOpen(true),
    onValidateProviderKey: async ({ provider, key } = {}) => {
      const prov = provider || data.ai?.provider || "anthropic";
      const k = key != null ? key : data.ai?.key;
      setData((d) => ({ ...d, ai: { ...(d.ai || {}), validation: "validating" } }));
      try {
        const B = window.LoomwrightBackend;
        if (!B || !B.AIService) { setData((d) => ({ ...d, ai: { ...(d.ai || {}), validation: "err", validationMessage: "Backend unavailable" } })); return; }
        if (k) await B.AIService.saveProviderConfig({ id: prov, providerType: prov, apiKey: k });
        const res = await B.AIService.testConnection(prov);
        setData((d) => ({ ...d, ai: { ...(d.ai || {}), validation: res && res.ok ? "ok" : "err", validationMessage: (res && res.message) || "" } }));
      } catch (e) { setData((d) => ({ ...d, ai: { ...(d.ai || {}), validation: "err", validationMessage: (e && e.message) || "Validation failed" } })); }
    },
    onTogglePrivacyMode: (m) => setSection("ai", { ...(data.ai || {}), mode: m, allowEgress: m === "local" ? false : (data.ai?.allowEgress || false) }),
    onStartWriting:        () => onCompleteOnboarding && onCompleteOnboarding({ ...data, __dest: "writers-room" }),
    onOpenCast:            () => onCompleteOnboarding && onCompleteOnboarding({ ...data, __dest: "cast" }),
    onOpenAtlas:           () => onCompleteOnboarding && onCompleteOnboarding({ ...data, __dest: "atlas" }),
    onGoToDashboard:       () => onCompleteOnboarding && onCompleteOnboarding({ ...data, __dest: "home" }),
  };

  // --- intel actions -------------------------------------------------
  const exportIntel = () => {
    const json = JSON.stringify(data, null, 2);
    try { navigator.clipboard?.writeText(json); } catch (e) {}
    setSaveState({ kind: "saved", label: "JSON copied to clipboard" });
  };
  const undoLast = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setData((d) => ({ ...d, [last.key]: last.prev }));
      return h.slice(0, -1);
    });
  };
  const resetIntel = () => {
    if (confirm("Reset every answer to defaults? This cannot be undone after closing.")) {
      setData({ ...ONBOARDING_DEFAULTS });
      setHistory([]);
    }
  };

  // --- conflict detection (simple heuristics) -----------------------
  const conflicts = [];
  if (data.ai?.mode === "local" && data.ai?.allowEgress)
    conflicts.push("AI is set to 'Local only' but egress is allowed.");
  if (data.foundation?.themes?.length === 0 && data.foundation?.toneWords?.length === 0 && completedIds.includes("foundation"))
    conflicts.push("Foundation marked complete but no themes or tone words set.");

  const StepBody = STEP_RENDERERS[currentId] || STEP_RENDERERS.welcome;

  return (
    <div className="ob" data-screen-label={"Onboarding · " + step.num + " " + step.title}>
      <OnboardingTopBar
        saveState={saveState}
        onExit={onExitOnboarding}
        onMinimize={onMinimizeOnboarding}
      />
      <div className="ob__layout">
        <OnboardingStepRail
          steps={ONBOARDING_STEPS}
          currentId={currentId}
          completedIds={completedIds}
          onOnboardingStepChange={jumpTo}
          projectName={data.welcome?.title}
          percent={percent}
        />
        <main className="ob__main" ref={scrollRef} data-ui="OnboardingStepBody" data-step={currentId}>
          {currentId !== "summary" && (
            <StepJsonTools
              category={currentId}
              prompt={STEP_JSON_PROMPTS[currentId] || FOUNDATION_PROMPT}
              current={data[currentId] || {}}
              onCopyStepJsonPrompt={callbacks.onCopyStepJsonPrompt}
              onPasteStepJson={callbacks.onPasteStepJson}
              onApplyStepJson={callbacks.onApplyStepJson}
              onDraftStepWithAI={callbacks.onDraftStepWithAI}
              onOpenIntelFile={() => setIntelOpen(true)}
            />
          )}
          <div className="ob__main__inner">
            <OnboardingStepHeader step={step} idx={stepIdx} total={total}/>
            <StepBody
              data={data}
              set={setSection}
              callbacks={callbacks}
              jumpTo={jumpTo}
            />
          </div>
          <OnboardingFooter
            stepIdx={stepIdx}
            total={total}
            step={step}
            complete={complete}
            isLast={isLast}
            onBack={goBack}
            onSkip={skip}
            onNext={goNext}
            onFinish={finish}
          />
        </main>
        <ProjectIntelligencePanel
          data={data}
          percent={percent}
          conflicts={conflicts}
          onOpenIntelFile={() => setIntelOpen(true)}
          onExportIntelFile={exportIntel}
          onUndoLast={undoLast}
          onResetIntel={resetIntel}
        />
      </div>
      {intelOpen && (
        <ProjectIntelligenceFileModal
          data={data}
          percent={percent}
          onClose={() => setIntelOpen(false)}
          onCopyIntelFile={exportIntel}
          onExportIntelFile={exportIntel}
        />
      )}
    </div>
  );
};

Object.assign(window, { OnboardingWizard, ONBOARDING_DEFAULTS, isStepComplete });
