// =====================================================================
// workspaces-system.jsx — Full workspaces for system / utility tabs.
//
// Registered:
//   • research-library  — References → Research Library (amalgamates
//                         onboarding info, AI style sources, canon
//                         sources, research notes, project intelligence
//                         and writing-style influences)
//   • control-centre    — Settings Control Centre
//   • trash-manager     — Trash Manager
//   • speed-reader      — Speed Reader
//   • relationship-map  — Relationship Workspace (only used when the
//                         existing in-panel editor isn't available)
//   • tangle-canvas     — Tangle Canvas shell (uses the existing
//                         TanglePanelBody if available, else placeholder)
// =====================================================================

const { useState: _ws_us, useEffect: _ws_ue, useMemo: _ws_um } = React;

// =====================================================================
// ONBOARDING ANSWERS — editor (inline section editors + JSON I/O)
//
// Lives inside the Research Library workspace so the user can revise
// stored onboarding info without rerunning the full wizard. The wizard
// itself remains the source of truth on first run; this is the editor
// for everything captured *during* onboarding.
//
// Sections mirror the onboarding wizard's groups (see onboarding-data.jsx
// → ONBOARDING_STEPS) but collapsed into eight short tabs to keep the
// edit surface scannable. Each field is a presentational stub — Claude
// Code wires the backing store via the callbacks declared on the controls.
// =====================================================================
const ONBOARDING_ANSWERS_SECTIONS = [
  { id: "project",   label: "Project",        icon: "book"    },
  { id: "style",     label: "Style & tone",   icon: "feather" },
  { id: "world",     label: "World",          icon: "map"     },
  { id: "cast",      label: "Characters",     icon: "user"    },
  { id: "plot",      label: "Plot",           icon: "share"   },
  { id: "refs",      label: "References",     icon: "paper"   },
  { id: "ai",        label: "AI instructions",icon: "sparkle" },
  { id: "privacy",   label: "Privacy",        icon: "shield"  },
];

// Demo defaults — replaced by window.ONBOARDING_ANSWERS once the user has
// actually completed (or revised) the wizard.
const ONBOARDING_ANSWERS_FALLBACK = {
  project: {
    title: "The Auger's Door",
    format: "novel",
    series: "Auger Cycle · Book II",
    stage: "drafting",
    targetLength: "Novel · 90–110k",
    audience: "Adult literary readers",
    goals: "Finish a publishable second-book draft and lock canon for book three.",
  },
  style: {
    genre: "Literary fantasy",
    subgenre: "Mythic / cold-climate",
    tone: "Quiet, austere, occasionally wry. Cold-as-architecture imagery.",
    pov: "Close third, single-POV per scene.",
    tense: "Past, with present-tense intrusions in dream/flashback only.",
    influences: "Le Guin · Susanna Clarke · M. John Harrison",
    sampleNote: "Style sample uploaded during onboarding (1,800 words from Chapter 1).",
  },
  world: {
    setting: "A salt-coast lowland on the eaves of the Pale Reach.",
    magicSystem: "Auger-stones; price is paid in remembered time.",
    technology: "Pre-firearm; clockwork letters; signal-fires.",
    factions: "House of Hess · Grey Coats · Salt-Wraiths",
    canonRules: "Auger Wakes have never been recorded south of the Vraska.",
  },
  cast: {
    protagonist: "Aelinor Vey — heir to House Hess, carrier of the Auger.",
    antagonist: "The Auger Wake (collective entity).",
    supporting: "Captain Brec, Saren of Hess, Mara of Hess, Dav the Quiet.",
    relationshipNote: "Aelinor and Brec — old debt, four winters cold.",
  },
  plot: {
    premise: "A diplomat-thief carries an artefact through a country mourning her family.",
    structure: "Three-arc; arrival, descent, reckoning.",
    arcsOpen: "Saren's bargain · The Vraska road · The Grey Coats' broken oath.",
    endpoint: "The Auger is delivered — or refused.",
  },
  refs: {
    uploaded: "2 PDFs, 1 URL, 1 style sample. See library.",
    influences: "See style influences in the Style tab.",
    sources: "House heraldry sourced from research note r-4.",
  },
  ai: {
    voice: "Match the manuscript's tonal register; never modernise.",
    taboos: "No anachronistic idioms; no contemporary brand names; no on-the-nose exposition.",
    instructions: "Always prefer texture-first description; clipped dialogue; serial commas.",
    autonomy: "Suggest, don't decide. Flag canon changes for review.",
  },
  privacy: {
    cloudOptIn: false,
    aiBYOK: true,
    sendManuscriptToCloud: false,
    handoffPackAllowed: true,
    notes: "Local-first by default. AI calls are user-triggered only.",
  },
};

const OnboardingField = ({ label, value, multiline, type, onChange }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
    <span style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
    {multiline ? (
      <textarea
        defaultValue={value}
        rows={3}
        onChange={(e) => onChange && onChange(e.target.value)}
        data-callback="onEditOnboardingAnswerSection"
        style={{
          fontFamily: "var(--font-serif)", fontSize: 13, color: "var(--ink-1)",
          background: "var(--bg-paper-2)", border: "1px solid var(--line-2)",
          borderRadius: 4, padding: "8px 10px", resize: "vertical", minHeight: 60,
        }}
      />
    ) : type === "boolean" ? (
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-serif)", fontSize: 13, color: "var(--ink-1)" }}>
        <input
          type="checkbox"
          defaultChecked={!!value}
          onChange={(e) => onChange && onChange(e.target.checked)}
          data-callback="onEditOnboardingAnswerSection"
        />
        <span>{String(value)}</span>
      </label>
    ) : (
      <input
        defaultValue={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        data-callback="onEditOnboardingAnswerSection"
        style={{
          fontFamily: "var(--font-serif)", fontSize: 13, color: "var(--ink-1)",
          background: "var(--bg-paper-2)", border: "1px solid var(--line-2)",
          borderRadius: 4, padding: "8px 10px",
        }}
      />
    )}
  </label>
);

const OnboardingAnswersEditor = ({ answers, sectionId, onChangeField, onChangeSection, onRequest }) => {
  const section = ONBOARDING_ANSWERS_SECTIONS.find((s) => s.id === sectionId) || ONBOARDING_ANSWERS_SECTIONS[0];
  const data = (answers && answers[section.id]) || {};
  // Render each key in the section's data object.
  const entries = Object.entries(data);
  return (
    <WorkspaceCard
      title={section.label}
      sub={"Onboarding answer · " + section.id}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12 }}>
        {entries.length === 0 ? (
          <div className="fws-empty">No answers stored for this section.</div>
        ) : entries.map(([k, v]) => {
          const isBool = typeof v === "boolean";
          const isLong = typeof v === "string" && (v.length > 80 || v.includes("\n"));
          return (
            <OnboardingField
              key={k}
              label={k.replace(/([A-Z])/g, " $1").trim()}
              value={v}
              multiline={!isBool && isLong}
              type={isBool ? "boolean" : "text"}
              onChange={(next) => onChangeField && onChangeField(section.id, k, next)}
            />
          );
        })}
        <div style={{
          display: "flex", gap: 8, marginTop: 6, paddingTop: 12,
          borderTop: "1px dashed var(--line-1)",
        }}>
          <button className="fws-topbar__exit" onClick={() => {
            window.dispatchEvent(new CustomEvent("lw:open-onboarding-wizard", { detail: { stepId: section.id } }));
            onRequest && onRequest.setToast && onRequest.setToast({
              title: "Reopen onboarding wizard", sub: "Continuing from " + section.label + ".",
            });
          }} data-callback="onReopenOnboardingWizard">
            <Icon name="sparkle" size={11}/> Reopen full wizard
          </button>
          <button className="fws-topbar__exit" data-callback="onSendOnboardingToProjectIntelligence" onClick={() => {
            window.LoomwrightBackend?.ProjectIntelService?.mergeFromOnboarding(answers || {});
            onRequest && onRequest.setToast && onRequest.setToast({
              title: "Sent to Project Intelligence",
              sub: section.label + " merged into the distilled brief.",
            });
          }}>
            <Icon name="share" size={11}/> Send section to Project Intelligence
          </button>
          {(section.id === "style" || section.id === "refs") && (
            <button className="fws-topbar__exit" data-callback="onMarkOnboardingAsStyleReference" onClick={() => {
              onRequest && onRequest.setToast && onRequest.setToast({
                title: "Marked as style reference",
                sub: section.label + " saved into Style influences.",
              });
            }}>
              <Icon name="feather" size={11}/> Mark as style reference
            </button>
          )}
          {(section.id === "world" || section.id === "plot") && (
            <button className="fws-topbar__exit" data-callback="onMarkOnboardingAsCanonSource" onClick={() => {
              onRequest && onRequest.setToast && onRequest.setToast({
                title: "Marked as canon source",
                sub: section.label + " bound into the canon ruleset.",
              });
            }}>
              <Icon name="book" size={11}/> Mark as canon source
            </button>
          )}
        </div>
      </div>
    </WorkspaceCard>
  );
};

const OnboardingJsonPanel = ({ answers, onCopyJson, onPasteJson, onValidateJson, onPreviewJson, onApplyJson }) => {
  const [text, setText] = _ws_us(() => {
    try { return JSON.stringify(answers || {}, null, 2); } catch (_) { return "{}"; }
  });
  const [status, setStatus] = _ws_us(null); // {ok, message}
  // Re-sync the textarea when `answers` changes from inline edits, but only
  // if the user hasn't started hand-editing the JSON.
  _ws_ue(() => {
    try { setText(JSON.stringify(answers || {}, null, 2)); } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);
  return (
    <WorkspaceCard title="Onboarding JSON" sub="Copy, paste, validate, preview, apply">
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setStatus(null); }}
          rows={14}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-1)",
            background: "var(--bg-paper-2)", border: "1px solid var(--line-2)",
            borderRadius: 4, padding: 10, lineHeight: 1.5, minHeight: 200,
          }}
        />
        {status && (
          <div style={{
            fontSize: 11, fontFamily: "var(--font-mono)",
            color: status.ok ? "#5a8a4a" : "#a84a3a",
            padding: "6px 8px", borderRadius: 4,
            background: status.ok ? "rgba(90,138,74,0.08)" : "rgba(168,74,58,0.08)",
            border: "1px solid " + (status.ok ? "rgba(90,138,74,0.25)" : "rgba(168,74,58,0.25)"),
          }}>{status.message}</div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="fws-topbar__exit" data-callback="onCopyOnboardingJson"
            onClick={() => {
              try {
                navigator.clipboard && navigator.clipboard.writeText(text);
                setStatus({ ok: true, message: "Copied JSON to clipboard." });
              } catch (_) { setStatus({ ok: false, message: "Couldn't copy to clipboard." }); }
              onCopyJson && onCopyJson(text);
            }}>
            <Icon name="code" size={11}/> Copy JSON
          </button>
          <button className="fws-topbar__exit" data-callback="onPasteOnboardingJson"
            onClick={async () => {
              try {
                const v = await (navigator.clipboard && navigator.clipboard.readText());
                if (v) { setText(v); setStatus({ ok: true, message: "Pasted from clipboard." }); }
              } catch (_) { setStatus({ ok: false, message: "Clipboard read denied — paste manually." }); }
              onPasteJson && onPasteJson();
            }}>
            <Icon name="paper" size={11}/> Paste from clipboard
          </button>
          <button className="fws-topbar__exit" data-callback="onValidateOnboardingJson"
            onClick={() => {
              try { JSON.parse(text); setStatus({ ok: true, message: "Valid JSON." }); }
              catch (e) { setStatus({ ok: false, message: "Invalid JSON: " + (e.message || "parse error") }); }
              onValidateJson && onValidateJson(text);
            }}>
            <Icon name="check" size={11}/> Validate
          </button>
          <button className="fws-topbar__exit" data-callback="onPreviewOnboardingImport"
            onClick={() => {
              try {
                JSON.parse(text);
                setStatus({ ok: true, message: "Preview ready — diff would show in the right panel (hook: onPreviewOnboardingImport)." });
              } catch (e) { setStatus({ ok: false, message: "Can't preview: " + (e.message || "invalid JSON") }); }
              onPreviewJson && onPreviewJson(text);
            }}>
            <Icon name="eye" size={11}/> Preview changes
          </button>
          <button className="fws-topbar__exit" data-callback="onApplyOnboardingImport"
            onClick={() => {
              try {
                const parsed = JSON.parse(text);
                onApplyJson && onApplyJson(parsed);
                setStatus({ ok: true, message: "Applied. New answers loaded into the editor." });
              } catch (e) { setStatus({ ok: false, message: "Can't apply: " + (e.message || "invalid JSON") }); }
            }}>
            <Icon name="check" size={11}/> Apply
          </button>
        </div>
      </div>
    </WorkspaceCard>
  );
};

// =====================================================================
// RESEARCH LIBRARY (References) ----------------------------------------
// =====================================================================
const ResearchLibraryWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  // Reference library — pulls window.REFERENCES if available, else mock.
  const [refsVersion, setRefsVersion] = _ws_us(0);
  const live = window.LoomwrightBackend?.ReferencesService?.listSync() || window.REFERENCES || [];
  const fallback = [
    { id: "r-1", kind: "upload",   title: "Loomwright field journal.pdf",       sub: "Uploaded · 14 pages", aiContext: true, style: false, canon: false },
    { id: "r-2", kind: "url",      title: "Atlas of the Pale Reach (atlas.org)",  sub: "Web · referenced 4×", aiContext: true, style: false, canon: false },
    { id: "r-3", kind: "style",    title: "Voice study: ‘Quiet Cold' (excerpt)",  sub: "Style sample · 1,800 words", aiContext: true, style: true, canon: false },
    { id: "r-4", kind: "canon",    title: "House of Hess — heraldry & oaths",     sub: "Canon source", aiContext: true, style: false, canon: true },
    { id: "r-5", kind: "research", title: "Norse salt-rites (research note)",     sub: "Note · 480 words", aiContext: false, style: false, canon: false },
    { id: "r-6", kind: "onboarding", title: "Onboarding · style influences",      sub: "Captured during onboarding", aiContext: true, style: true, canon: false },
    { id: "r-7", kind: "onboarding", title: "Onboarding · project intelligence",  sub: "Project rules, tone, taboos", aiContext: true, style: false, canon: true },
  ];
  const refs = live.length ? live : fallback;

  const [filter, setFilter] = _ws_us("all");
  const [selectedId, setSelectedId] = _ws_us(refs[0]?.id || null);
  const selected = refs.find((r) => r.id === selectedId) || refs[0];

  // View modes: "library" (default) vs. "onboarding" (full editor).
  // The onboarding editor lives inside the same workspace so users stay
  // anchored in the Research Library — they don't get bumped into a
  // separate "setup" flow.
  const [view, setView] = _ws_us("library");
  const [onbSection, setOnbSection] = _ws_us("project");
  const [onbAnswers, setOnbAnswers] = _ws_us(() =>
    (window.LoomwrightBackend?.OnboardingService?.loadSync(ONBOARDING_ANSWERS_FALLBACK))
      ? window.LoomwrightBackend.OnboardingService.loadSync(ONBOARDING_ANSWERS_FALLBACK)
      : (window.ONBOARDING_ANSWERS && typeof window.ONBOARDING_ANSWERS === "object")
      ? window.ONBOARDING_ANSWERS
      : ONBOARDING_ANSWERS_FALLBACK
  );

  _ws_ue(() => {
    const onRefs = () => setRefsVersion(Date.now());
    window.addEventListener("lw:references-updated", onRefs);
    window.addEventListener("lw:backend-ready", onRefs);
    return () => {
      window.removeEventListener("lw:references-updated", onRefs);
      window.removeEventListener("lw:backend-ready", onRefs);
    };
  }, []);

  _ws_ue(() => {
    window.LoomwrightBackend?.OnboardingService?.save(onbAnswers);
  }, [JSON.stringify(onbAnswers), refsVersion]);

  // Workspace-level listener: lets other components ask the library to
  // jump straight into onboarding mode (Settings → Project Intelligence
  // → Open onboarding answers).
  _ws_ue(() => {
    const onOpen = (e) => {
      setView("onboarding");
      const stepId = e && e.detail && e.detail.stepId;
      if (stepId && ONBOARDING_ANSWERS_SECTIONS.some((s) => s.id === stepId)) setOnbSection(stepId);
    };
    window.addEventListener("lw:open-onboarding-answers", onOpen);
    return () => window.removeEventListener("lw:open-onboarding-answers", onOpen);
  }, []);

  const filtered = refs.filter((r) => {
    if (filter === "all") return true;
    if (filter === "uploads") return r.kind === "upload";
    if (filter === "urls") return r.kind === "url";
    if (filter === "style") return r.kind === "style" || r.style;
    if (filter === "canon") return r.kind === "canon" || r.canon;
    if (filter === "research") return r.kind === "research";
    if (filter === "onboarding") return r.kind === "onboarding";
    return true;
  });

  const ICONS = { upload: "paper", url: "link", style: "feather", canon: "book", research: "book", onboarding: "info" };

  const updateAnswerField = (sectionId, key, value) => {
    setOnbAnswers((prev) => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] || {}), [key]: value },
    }));
  };

  // ------------------------------------------------------------------
  // ONBOARDING-MODE VIEW
  // ------------------------------------------------------------------
  if (view === "onboarding") {
    return (
      <WorkspaceShell
        icon="info" entityType="references"
        eyebrow="References · Onboarding"
        title="Onboarding Answers"
        subtitle="Edit what you told Loomwright during setup — without rerunning the wizard."
        onExit={onExit} cols="lcr"
        dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
        extraActions={
          <>
            <button type="button" className="fws-topbar__exit"
              onClick={() => setView("library")}
              data-callback="onCloseOnboardingAnswers"
              title="Back to the library">
              <Icon name="chevron-l" size={11}/> Back to library
            </button>
            <button type="button" className="fws-topbar__exit"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("lw:open-onboarding-wizard"));
                onRequest && onRequest.setToast && onRequest.setToast({
                  title: "Reopening onboarding wizard",
                  sub: "All current answers are preserved.",
                });
              }}
              data-callback="onReopenOnboardingWizard">
              <Icon name="sparkle" size={11}/> Reopen wizard
            </button>
          </>
        }
        left={
          <>
            <div className="fws-section">
              <span className="fws-section__title">Onboarding sections</span>
              <span className="fws-section__count">{ONBOARDING_ANSWERS_SECTIONS.length}</span>
            </div>
            <div className="fws-settings-nav">
              {ONBOARDING_ANSWERS_SECTIONS.map((s) => (
                <button key={s.id}
                  className={"fws-settings-nav__row " + (onbSection === s.id ? "is-on" : "")}
                  onClick={() => setOnbSection(s.id)}
                  data-callback="onEditOnboardingAnswerSection">
                  <Icon name={s.icon} size={11}/> {s.label}
                </button>
              ))}
            </div>
            <div className="fws-section" style={{ marginTop: 12 }}>
              <span className="fws-section__title">Cross-links</span>
            </div>
            <div className="fws-settings-nav">
              <button className="fws-settings-nav__row"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
                    detail: { workspaceId: "control-centre", panelKind: "settings", sourcePanel: "p-settings" },
                  }));
                  // Try to scroll to the intel section.
                  window.dispatchEvent(new CustomEvent("lw:settings-section", { detail: { actionId: "intel" } }));
                }}
                data-callback="onOpenProjectIntelligenceFile">
                <Icon name="sparkle" size={11}/> Open Project Intelligence
              </button>
              <button className="fws-settings-nav__row"
                onClick={() => setView("library")}
                data-callback="onOpenReferencesLibrary">
                <Icon name="paper" size={11}/> Open References library
              </button>
              <button className="fws-settings-nav__row"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
                    detail: { workspaceId: "control-centre", panelKind: "settings", sourcePanel: "p-settings" },
                  }));
                }}
                data-callback="onOpenSettings">
                <Icon name="gear" size={11}/> Open Settings
              </button>
            </div>
          </>
        }
        main={
          <OnboardingAnswersEditor
            answers={onbAnswers}
            sectionId={onbSection}
            onChangeField={updateAnswerField}
            onChangeSection={setOnbSection}
            onRequest={onRequest}
          />
        }
        right={
          <>
            <div className="fws-section">
              <span className="fws-section__title">JSON · Import / Export</span>
            </div>
            <div className="fws-tab-body">
              <OnboardingJsonPanel
                answers={onbAnswers}
                onApplyJson={(parsed) => setOnbAnswers(parsed)}
              />
              <div style={{ marginTop: 10, padding: "8px 12px", fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-serif)", fontStyle: "italic", lineHeight: 1.55 }}>
                Onboarding answers are the raw source. Edits here flow into
                Project Intelligence the next time it rebuilds.
                <div style={{ marginTop: 8, color: "var(--ink-4)" }}>
                  <strong>Last updated:</strong> just now · <strong>Used in Project Intelligence:</strong> yes
                </div>
              </div>
            </div>
          </>
        }
      />
    );
  }

  // ------------------------------------------------------------------
  // LIBRARY VIEW (default)
  // ------------------------------------------------------------------
  return (
    <WorkspaceShell
      icon="paper" entityType="references"
      eyebrow="References" title="Research Library"
      subtitle="Uploads, URLs, style samples, canon sources, research notes, onboarding & project intel — one library."
      createLabel="Add reference"
      onCreate={() => {
        // Use the same popover-style flow by dispatching reference-add.
        window.dispatchEvent(new CustomEvent("lw:reference-add", {
          detail: { actionId: "upload", sourcePanel: "research-library" },
        }));
      }}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      extraActions={
        <>
          <button type="button" className="fws-topbar__exit"
            onClick={() => setView("onboarding")}
            data-callback="onOpenOnboardingAnswers"
            title="Edit onboarding answers">
            <Icon name="info" size={11}/> Onboarding Answers
          </button>
          <button type="button" className="fws-topbar__exit"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
                detail: { workspaceId: "control-centre", panelKind: "settings", sourcePanel: "p-settings" },
              }));
              window.dispatchEvent(new CustomEvent("lw:settings-section", { detail: { actionId: "intel" } }));
            }}
            data-callback="onOpenProjectIntelligenceFile"
            title="Open Project Intelligence (in Settings)">
            <Icon name="sparkle" size={11}/> Project Intelligence
          </button>
          {typeof AIHandoffButton !== "undefined" && (
            <AIHandoffButton
              surface="references"
              variant="accent"
              label="AI Handoff"
              icon="sparkle"
              context={{
                outputType: "outline",
                instructions: "Help me organise / improve my research library. Suggest tags, missing canon sources, and a style profile from the samples.",
                projectContext: { references: (window.REFERENCES || []).slice(0, 50) },
              }}/>
          )}
          <button type="button" className="fws-topbar__exit"
            onClick={() => onRequest.openEntityEditor({ type: "references", mode: "json" })}>
            <Icon name="code" size={11}/> Import JSON
          </button>
        </>
      }
      left={
        <>
          <div className="fws-section">
            <span className="fws-section__title">Library</span>
            <span className="fws-section__count">{refs.length}</span>
          </div>
          <div style={{ padding: "8px 10px 0", display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { id: "upload",     label: "Upload reference",     icon: "paper" },
              { id: "paste",      label: "Paste reference",      icon: "bookmark" },
              { id: "url",        label: "Add website / URL",    icon: "link" },
              { id: "style",      label: "Add style sample",     icon: "feather" },
              { id: "canon",      label: "Add canon source",     icon: "book" },
              { id: "research",   label: "Add research note",    icon: "book" },
              { id: "onboarding", label: "Add onboarding info",  icon: "info" },
            ].map((row) => (
              <button key={row.id}
                className="fws-settings-nav__row"
                onClick={() => {
                  // Onboarding is special — its answers live in the
                  // Onboarding editor, not as a new reference card.
                  if (row.id === "onboarding") { setView("onboarding"); return; }
                  window.dispatchEvent(new CustomEvent("lw:reference-add", {
                    detail: { actionId: row.id, sourcePanel: "research-library" },
                  }));
                }}
                data-callback="onReferenceAdd">
                <Icon name={row.icon} size={11}/> {row.label}
              </button>
            ))}
          </div>
          <WorkspaceFilters
            filters={[
              { key: "all", label: "All", count: refs.length },
              { key: "uploads", label: "Uploads" },
              { key: "urls", label: "URLs" },
              { key: "style", label: "Style" },
              { key: "canon", label: "Canon" },
              { key: "research", label: "Research" },
              { key: "onboarding", label: "Onboarding" },
            ]}
            active={filter} onChange={setFilter}
          />
          <div className="fws-section" style={{ marginTop: 12 }}>
            <span className="fws-section__title">Cross-links</span>
          </div>
          <div className="fws-settings-nav">
            <button className="fws-settings-nav__row"
              onClick={() => setView("onboarding")}
              data-callback="onOpenOnboardingAnswers">
              <Icon name="info" size={11}/> Onboarding Answers
            </button>
            <button className="fws-settings-nav__row"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
                  detail: { workspaceId: "control-centre", panelKind: "settings", sourcePanel: "p-settings" },
                }));
                window.dispatchEvent(new CustomEvent("lw:settings-section", { detail: { actionId: "intel" } }));
              }}
              data-callback="onOpenProjectIntelligenceFile">
              <Icon name="sparkle" size={11}/> Project Intelligence
            </button>
            <button className="fws-settings-nav__row"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
                  detail: { workspaceId: "control-centre", panelKind: "settings", sourcePanel: "p-settings" },
                }));
              }}
              data-callback="onOpenSettings">
              <Icon name="gear" size={11}/> Settings
            </button>
          </div>
        </>
      }
      main={
        <>
          <WorkspaceCard
            title="Drop zone"
            sub="Drag files, URLs, or pasted text here."
            style={{ borderStyle: "dashed" }}
          >
            <div style={{ padding: 22, textAlign: "center", color: "var(--ink-3)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
              Drop a PDF, an image, or a web link. Or pick "Add" on the left.
            </div>
          </WorkspaceCard>

          <WorkspaceCard title={"Library · " + filter}>
            {filtered.length === 0 ? (
              <div className="fws-empty" style={{ padding: 18 }}>No references in this filter.</div>
            ) : filtered.map((r) => (
              <div key={r.id}
                className={"fws-tile " + (selectedId === r.id ? "is-selected" : "")}
                onClick={() => setSelectedId(r.id)}>
                <div className="fws-tile__icon"><Icon name={ICONS[r.kind] || "paper"} size={14}/></div>
                <div>
                  <div className="fws-tile__title">{r.title || r.name}</div>
                  <div className="fws-tile__sub">{r.sub || r.subtitle}</div>
                  <div style={{ marginTop: 4 }}>
                    <span className="fws-chip">{r.kind}</span>
                  </div>
                </div>
                <div className="fws-tile__badges">
                  {r.aiContext && <span className="fws-chip fws-chip--accent">AI</span>}
                  {(r.style || r.kind === "style") && <span className="fws-chip">style</span>}
                  {(r.canon || r.kind === "canon") && <span className="fws-chip">canon</span>}
                </div>
              </div>
            ))}
          </WorkspaceCard>
        </>
      }
      right={
        <>
          <div className="fws-section">
            <span className="fws-section__title">Inspector</span>
          </div>
          <div className="fws-tab-body">
            {selected ? (
              <>
                <div className="fws-card" style={{ padding: 12 }}>
                  <div className="fws-card__title">{selected.title || selected.name}</div>
                  <div className="fws-card__sub">{selected.sub || selected.subtitle}</div>
                  <hr className="hr" style={{ margin: "10px 0" }}/>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <input type="checkbox" defaultChecked={selected.aiContext} data-callback="onToggleReferenceAIContext"/>
                      <span>Include in AI context</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <input type="checkbox" defaultChecked={selected.style} data-callback="onToggleReferenceStyleInfluence"/>
                      <span>Use as writing-style influence</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <input type="checkbox" defaultChecked={selected.canon} data-callback="onToggleReferenceCanonSource"/>
                      <span>Treat as canon source</span>
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="fws-section__title" style={{ marginBottom: 6 }}>Linked entities</div>
                  {["Aelinor Vey", "Pale Reach"].map((n, i) => (
                    <button key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{n}</button>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <button className="fws-section__action" data-callback="onLinkReferenceToEntity">+ Link entity</button>
                </div>

                {selected.kind === "onboarding" && (
                  <div style={{ marginTop: 16 }}>
                    <div className="fws-section__title" style={{ marginBottom: 6 }}>Onboarding action</div>
                    <button className="fws-topbar__exit"
                      onClick={() => setView("onboarding")}
                      data-callback="onOpenOnboardingAnswers">
                      <Icon name="info" size={11}/> Edit onboarding answers
                    </button>
                  </div>
                )}
              </>
            ) : <div className="fws-empty">Select a reference.</div>}
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// SETTINGS CONTROL CENTRE ----------------------------------------------
// =====================================================================
const ControlCentreWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const SECTIONS = [
    { group: "Project",     id: "project",     label: "Project settings",       icon: "book" },
    { group: "Project",     id: "intel",       label: "Project Intelligence",   icon: "sparkle" },
    { group: "Project",     id: "brand",       label: "Brand / theme",          icon: "drop" },
    { group: "Author",      id: "authors",     label: "Author profiles",        icon: "feather" },
    { group: "Author",      id: "ai",          label: "AI providers",           icon: "bolt" },
    { group: "Author",      id: "ai-routing",  label: "AI routing & cost",      icon: "wheel" },
    { group: "Author",      id: "privacy",     label: "Privacy",                icon: "shield" },
    { group: "Editor",      id: "editor",      label: "Editor settings",        icon: "edit" },
    { group: "Editor",      id: "extraction",  label: "Extraction settings",    icon: "bolt" },
    { group: "Editor",      id: "review",      label: "Review queue settings",  icon: "bell" },
    { group: "Library",     id: "references",  label: "References / Research",  icon: "paper" },
    { group: "Library",     id: "import",      label: "Import / export",        icon: "share" },
    { group: "System",      id: "shortcuts",   label: "Keyboard shortcuts",     icon: "wheel" },
    { group: "System",      id: "debug",       label: "Debug / tweaks",         icon: "warn" },
  ];
  const [activeId, setActiveId] = _ws_us("project");

  // Allow other surfaces (References → "Project Intelligence" button,
  // app.jsx → "lw:settings-add" event) to deep-link into a specific
  // Control Centre section. The event detail.actionId names the section.
  _ws_ue(() => {
    const onSection = (e) => {
      const id = e && e.detail && e.detail.actionId;
      if (!id) return;
      // Map create-menu actionIds (project/author/ai) → matching section ids.
      const map = {
        author: "authors", "author-profile": "authors",
        provider: "ai", "ai-provider": "ai",
        routing: "ai-routing",
      };
      const target = map[id] || id;
      if (SECTIONS.some((s) => s.id === target)) setActiveId(target);
    };
    window.addEventListener("lw:settings-section", onSection);
    return () => window.removeEventListener("lw:settings-section", onSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = _ws_um(() => {
    const m = new Map();
    SECTIONS.forEach((s) => {
      if (!m.has(s.group)) m.set(s.group, []);
      m.get(s.group).push(s);
    });
    return Array.from(m.entries());
  }, []);

  const active = SECTIONS.find((s) => s.id === activeId);

  return (
    <WorkspaceShell
      icon="gear"
      eyebrow="Settings" title="Settings Control Centre"
      subtitle="Project, author, editor, library, system — everything that's not a content tab."
      onExit={onExit} cols="lc"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      extraActions={
        <button type="button" className="fws-topbar__primary" onClick={() => {
          window.dispatchEvent(new CustomEvent("lw:settings-add", { detail: { actionId: "author" } }));
        }}>
          <Icon name="plus" size={11}/> Author Profile
        </button>
      }
      left={
        <>
          {groups.map(([groupName, rows]) => (
            <React.Fragment key={groupName}>
              <div className="fws-settings-nav__group">{groupName}</div>
              <div className="fws-settings-nav">
                {rows.map((s) => (
                  <button key={s.id}
                    className={"fws-settings-nav__row " + (activeId === s.id ? "is-on" : "")}
                    onClick={() => setActiveId(s.id)}>
                    <Icon name={s.icon} size={11}/> {s.label}
                  </button>
                ))}
              </div>
            </React.Fragment>
          ))}
        </>
      }
      main={
        <WorkspaceCard title={active?.label} sub={"Settings · " + (active?.group || "")}>
          {typeof RichSettingsSection !== "undefined" && (
            (() => {
              const rich = <RichSettingsSection sectionId={activeId} onRequest={onRequest}/>;
              if (rich) return rich;
              return null;
            })()
          ) || null}
          {/* Fallback: legacy inline content (shown only if RichSettingsSection
              didn't handle this id — kept for safety). */}
          {typeof RichSettingsSection === "undefined" && (<>
          {activeId === "project" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ControlField label="Project name" value="The Auger's Door" placeholder="Untitled project"/>
              <ControlField label="Book"        value="Book II"/>
              <ControlField label="Author"      value="E. Marlowe"/>
              <ControlField label="Genre"       value="Literary fantasy"/>
            </div>
          )}
          {activeId === "intel" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 12 }}>
                Project Intelligence is the curated context shown to the AI — voice, tone, taboos, hard canon, current arc.
              </p>
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("references")}>
                <Icon name="paper" size={11}/> Manage source documents in Research Library →
              </button>
              <button className="fws-section__action" data-callback="onAddProjectIntelligenceSection">+ Add section</button>
            </div>
          )}
          {activeId === "brand" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ControlField label="Theme" value="parchment-light"/>
              <ControlField label="Accent" value="#9a7b3a"/>
              <ControlField label="Density" value="balanced"/>
            </div>
          )}
          {activeId === "authors" && (
            <>
              {["E. Marlowe", "Ann (co-writer)", "Loomwright AI"].map((n, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 6 }}>
                  <div className="fws-roster__row__avatar">{n.slice(0, 2)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 13 }}>{n}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Default colour, attribution stamp, voice</div>
                  </div>
                  <button className="fws-section__action">Edit</button>
                </div>
              ))}
              <button className="fws-section__action" data-callback="onCreateAuthorProfile">+ Add author profile</button>
            </>
          )}
          {activeId === "ai" && (
            <>
              {[
                { provider: "Loomwright Local", model: "Local · llama-class", status: "Active" },
                { provider: "Anthropic", model: "claude-haiku-4-5", status: "Configured" },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 6 }}>
                  <Icon name="sparkle" size={14}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 13 }}>{row.provider}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{row.model}</div>
                  </div>
                  <span className="fws-chip fws-chip--accent">{row.status}</span>
                </div>
              ))}
              <button className="fws-section__action" data-callback="onAddAIProvider">+ Add AI provider</button>
            </>
          )}
          {activeId === "privacy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ControlField label="Privacy mode" value="local"/>
              <ControlField label="Cloud sync" value="off"/>
              <ControlField label="AI access" value="explicit per chapter"/>
            </div>
          )}
          {activeId === "editor" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ControlField label="Default font" value="Source Serif 4"/>
              <ControlField label="Editor width" value="740px"/>
              <ControlField label="Typewriter mode" value="off"/>
            </div>
          )}
          {activeId === "extraction" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ControlField label="On save" value="quick extract"/>
              <ControlField label="Deep extract" value="manual"/>
              <ControlField label="Auto-accept threshold" value="92%"/>
            </div>
          )}
          {activeId === "review" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ControlField label="Group by" value="chapter"/>
              <ControlField label="Notify on uncertain" value="badge only"/>
            </div>
          )}
          {activeId === "references" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("references")}>
                <Icon name="paper" size={11}/> Open Research Library →
              </button>
              <button className="fws-section__action" data-callback="onAddReferenceSource">+ Add reference source</button>
            </div>
          )}
          {activeId === "import" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="fws-section__action">Import .docx manuscript</button>
              <button className="fws-section__action">Import entities (JSON)</button>
              <button className="fws-section__action" data-callback="onExportProfile">Export project profile</button>
            </div>
          )}
          {activeId === "backup" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ControlField label="Auto-backup" value="hourly"/>
              <ControlField label="Backup location" value="~/Loomwright/Backups"/>
              <button className="fws-section__action">Run backup now</button>
            </div>
          )}
          {activeId === "shortcuts" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
              {[
                ["Command palette", "⌘P"],
                ["Adaptive wheel", "⌘K"],
                ["New chapter", "⌘⇧N"],
                ["Save", "⌘S"],
                ["Save + Extract", "⌘E"],
                ["Toggle margins", "⌘⌥M"],
              ].map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)" }}>
                  <span>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>{v}</span>
                </div>
              ))}
            </div>
          )}
          {activeId === "debug" && (
            <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
              Tweaks panel is available from the right side of the app (toolbar toggle).
              State diagnostics live there too — open it to see live panel/route state.
            </div>
          )}
          </>)}
        </WorkspaceCard>
      }
    />
  );
};

// Small helper for control fields
const ControlField = ({ label, value, placeholder }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)", fontWeight: 600 }}>{label}</span>
    <input defaultValue={value} placeholder={placeholder} style={{
      padding: "8px 10px",
      background: "var(--bg-paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: "var(--r-2)",
      fontFamily: "var(--font-serif)",
      fontSize: "var(--fs-md)",
      color: "var(--ink-1)",
    }}/>
  </label>
);

// =====================================================================
// TRASH MANAGER --------------------------------------------------------
// =====================================================================
const TrashManagerWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = [
    { id: "t1", name: "The Glass Court",  type: "locations", deleted: "2 days ago",   author: "EM" },
    { id: "t2", name: "Old Mara",         type: "cast",      deleted: "5 days ago",   author: "EM" },
    { id: "t3", name: "Bone Augerlet",    type: "items",     deleted: "11 days ago",  author: "AN" },
    { id: "t4", name: "Greyhound clause", type: "lore",      deleted: "1 month ago",  author: "EM" },
    { id: "t5", name: "Chapter 4 draft 1", type: "manuscript", deleted: "20 days ago", author: "EM" },
  ];
  const [filter, setFilter] = _ws_us("all");
  const [search, setSearch] = _ws_us("");
  const [selectedId, setSelectedId] = _ws_us(items[0]?.id || null);
  const [confirmingDelete, setConfirmingDelete] = _ws_us(false);

  const filtered = items.filter((i) => {
    if (filter !== "all" && i.type !== filter) return false;
    if (search && !(i.name.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });
  const selected = items.find((x) => x.id === selectedId) || filtered[0];

  return (
    <WorkspaceShell
      icon="trash"
      eyebrow="Trash" title="Trash Manager"
      subtitle="Deleted entries sit here for 30 days before they vanish. Restore, preview, or delete forever."
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
        <>
          <div className="fws-section"><span className="fws-section__title">Filter by type</span></div>
          <div className="fws-settings-nav">
            {[
              { id: "all",        label: "All",           count: items.length },
              { id: "cast",       label: "Cast",          count: items.filter((i) => i.type === "cast").length },
              { id: "locations",  label: "Locations",     count: items.filter((i) => i.type === "locations").length },
              { id: "items",      label: "Items",         count: items.filter((i) => i.type === "items").length },
              { id: "lore",       label: "Lore / Canon",  count: items.filter((i) => i.type === "lore").length },
              { id: "manuscript", label: "Manuscripts",   count: items.filter((i) => i.type === "manuscript").length },
            ].map((f) => (
              <button key={f.id}
                className={"fws-settings-nav__row " + (filter === f.id ? "is-on" : "")}
                onClick={() => setFilter(f.id)}>
                <span style={{ flex: 1 }}>{f.label}</span>
                <span style={{ color: "var(--ink-4)" }}>{f.count}</span>
              </button>
            ))}
          </div>
        </>
      }
      main={
        <>
          <WorkspaceCard title="Deleted entries" sub={`${filtered.length} in trash · sorted by deleted date`}
            action={
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trash…"
                style={{ padding: "5px 8px", fontSize: 12, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", color: "var(--ink-1)" }}
              />
            }
          >
            <div style={{ background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)" }}>
              <div className="fws-trash-row" style={{ background: "var(--bg-paper)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-3)", fontWeight: 600 }}>
                <span/>
                <span>Name</span>
                <span>Type</span>
                <span>Author</span>
                <span>Deleted</span>
              </div>
              {filtered.map((i) => (
                <div key={i.id}
                  className={"fws-trash-row " + (selectedId === i.id ? "is-selected" : "")}
                  onClick={() => setSelectedId(i.id)}>
                  <Icon name="trash" size={11}/>
                  <span className="fws-trash-row__name">{i.name}</span>
                  <span className="fws-trash-row__meta">{i.type}</span>
                  <span className="fws-trash-row__meta">{i.author}</span>
                  <span className="fws-trash-row__meta">{i.deleted}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="fws-empty" style={{ padding: 20 }}>Trash is empty for this filter.</div>
              )}
            </div>
          </WorkspaceCard>
        </>
      }
      right={
        selected ? (
          <>
            <div className="fws-section">
              <span className="fws-section__title">Preview</span>
            </div>
            <div className="fws-tab-body">
              <div className="fws-card" style={{ padding: 12 }}>
                <div className="fws-card__title">{selected.name}</div>
                <div className="fws-card__sub">{selected.type} · deleted {selected.deleted}</div>
                <hr className="hr" style={{ margin: "10px 0" }}/>
                <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 12, lineHeight: 1.55 }}>
                  Preview placeholder — first paragraph or key fields of the deleted record will appear here.
                </p>
              </div>

              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                <button className="fws-topbar__primary" data-callback="onRestoreFromTrash">
                  <Icon name="check" size={11}/> Restore
                </button>
                <button className="fws-section__action">Preview full record</button>
                {!confirmingDelete ? (
                  <button className="fws-section__action" style={{ color: "#a84a3a" }} onClick={() => setConfirmingDelete(true)}>Delete forever…</button>
                ) : (
                  <div className="fws-card" style={{ padding: 10, borderColor: "rgba(168, 74, 58, 0.4)" }}>
                    <div style={{ fontSize: 12, color: "var(--ink-1)", marginBottom: 8 }}>This cannot be undone.</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="fws-topbar__primary" style={{ background: "#a84a3a", borderColor: "#a84a3a" }} data-callback="onDeleteForever">Delete forever</button>
                      <button className="fws-section__action" onClick={() => setConfirmingDelete(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="fws-empty">Select a deleted record.</div>
        )
      }
    />
  );
};

// =====================================================================
// SPEED READER WORKSPACE -----------------------------------------------
// =====================================================================
const SpeedReaderWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  // Static word list driven by a tiny demo paragraph from the manuscript.
  const PASSAGE = "The light over Pale Reach was the colour of cooled tin when Aelinor Vey came through the stockade gate. Snow had been falling all morning, and the wind off the salt flats turned each flake into a small, deliberate cut.";
  const WORDS = PASSAGE.split(/\s+/);

  const [idx, setIdx] = _ws_us(0);
  const [playing, setPlaying] = _ws_us(false);
  const [wpm, setWpm] = _ws_us(360);
  const [doc, setDoc] = _ws_us("ch7");
  const [fontSize, setFontSize] = _ws_us(64);

  _ws_ue(() => {
    if (!playing) return;
    const ms = Math.max(60, 60000 / wpm);
    const t = setTimeout(() => {
      setIdx((i) => (i + 1) % WORDS.length);
    }, ms);
    return () => clearTimeout(t);
  }, [playing, idx, wpm]);

  // Find the pivot letter (~30% in)
  const word = WORDS[idx] || "—";
  const pivotIdx = Math.max(0, Math.min(word.length - 1, Math.floor(word.length * 0.3)));
  const before = word.slice(0, pivotIdx);
  const pivot = word[pivotIdx];
  const after = word.slice(pivotIdx + 1);

  const fraction = (idx + 1) / WORDS.length;

  return (
    <WorkspaceShell
      icon="eye"
      eyebrow="Speed Reader" title="Speed Reader"
      subtitle="Read the manuscript at pace. Flag inconsistencies and bookmark passages."
      createLabel="Add reading source"
      onCreate={() => window.dispatchEvent(new CustomEvent("lw:speed-reader-add", { detail: { sourcePanel: workspace.sourcePanel } }))}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
        <>
          <div className="fws-section"><span className="fws-section__title">Source</span></div>
          <div className="fws-settings-nav">
            {[
              { id: "ch1", label: "Ch.1 — The Hollow Crown" },
              { id: "ch2", label: "Ch.2 — Pale Reach" },
              { id: "ch3", label: "Ch.3 — Saren's Bargain" },
              { id: "ch7", label: "Ch.7 — Ash & Auger" },
              { id: "ch9", label: "Ch.9 — The Auger's Door" },
            ].map((c) => (
              <button key={c.id}
                className={"fws-settings-nav__row " + (doc === c.id ? "is-on" : "")}
                onClick={() => { setDoc(c.id); setIdx(0); }}>
                <Icon name="paper" size={11}/> {c.label}
              </button>
            ))}
          </div>
          <div className="fws-section" style={{ marginTop: 12 }}><span className="fws-section__title">Bookmarks</span></div>
          <div className="fws-empty" style={{ padding: 16, fontSize: 11 }}>No bookmarks yet.</div>
        </>
      }
      main={
        <>
          <div className="fws-reader-stage">
            <div className="fws-reader-word" style={{ fontSize }}>
              <span style={{ opacity: 0.6 }}>{before}</span>
              <span className="fws-reader-word__pivot">{pivot}</span>
              <span style={{ opacity: 0.6 }}>{after}</span>
            </div>
            <div className="fws-reader-ctrls">
              <button className="fws-section__action" onClick={() => setIdx(Math.max(0, idx - 1))}>← prev</button>
              <button className="fws-topbar__primary" onClick={() => setPlaying((p) => !p)}>
                <Icon name={playing ? "close" : "bolt"} size={11}/> {playing ? "Pause" : "Play"}
              </button>
              <button className="fws-section__action" onClick={() => setIdx(Math.min(WORDS.length - 1, idx + 1))}>next →</button>
            </div>
            <div className="fws-reader-bar">
              <div className="fws-reader-bar__fill" style={{ width: (fraction * 100) + "%" }}/>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)", fontSize: 11 }}>
              word {idx + 1} of {WORDS.length}  ·  {wpm} wpm
            </div>
          </div>
        </>
      }
      right={
        <>
          <div className="fws-section"><span className="fws-section__title">Reader settings</span></div>
          <div className="fws-tab-body">
            <ControlField label="WPM" value={String(wpm)}/>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -8 }}>
              <input type="range" min="100" max="900" step="20" value={wpm} onChange={(e) => setWpm(Number(e.target.value))} style={{ flex: 1 }}/>
            </div>
            <ControlField label="Font size" value={fontSize + "px"}/>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -8 }}>
              <input type="range" min="28" max="120" step="4" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ flex: 1 }}/>
            </div>
            <hr className="hr" style={{ margin: "12px 0" }}/>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input type="checkbox" defaultChecked/> Punctuation pause
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input type="checkbox" defaultChecked/> Sentence pause
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input type="checkbox"/> Focus mode (dim everything else)
            </label>
            <hr className="hr" style={{ margin: "12px 0" }}/>
            <div className="fws-section__title" style={{ marginBottom: 6 }}>Session stats</div>
            <div style={{ fontSize: 12 }}>
              Words read: <b>{idx + 1}</b><br/>
              Estimated time: <b>{Math.ceil((idx + 1) / wpm * 60)}s</b>
            </div>
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// RELATIONSHIP MAP WORKSPACE -------------------------------------------
// (a lightweight shell — the existing in-panel relationship graph
// continues to live in relationships.jsx and is preferred when present)
// =====================================================================
const RelationshipMapWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  return (
    <WorkspaceShell
      icon="link" entityType="relationships"
      eyebrow="Relationships" title="Relationship Workspace"
      subtitle="Bonds, rivalries, debts — the graph between Cast."
      createLabel="Add relationship"
      onCreate={() => onRequest.openEntityEditor({ type: "relationships" })}
      onExit={onExit} cols="cr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      main={
        <WorkspaceCard title="Relationship graph" sub="The in-panel graph stays the canonical view. This workspace gives it room to breathe.">
          <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            (Re-rendering the in-panel relationship graph at scale.)
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("relationships")}>
              <Icon name="link" size={11}/> Open Relationships panel →
            </button>
          </div>
        </WorkspaceCard>
      }
      right={
        <>
          <div className="fws-section"><span className="fws-section__title">Tools</span></div>
          <div className="fws-tab-body">
            <button className="fws-section__action" data-callback="onAddEvidence">+ Add evidence</button>
            <button className="fws-section__action">Filter by faction</button>
            <button className="fws-section__action">Filter by quest</button>
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// TANGLE CANVAS WORKSPACE (shell) --------------------------------------
// =====================================================================
const TangleCanvasWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  return (
    <WorkspaceShell
      icon="knot"
      eyebrow="Tangle" title="Tangle Canvas"
      subtitle="A canvas for non-linear thinking — clusters become quests, notes, and threads."
      createLabel="Add note"
      onCreate={() => onRequest.openEntityEditor({ type: "generic" })}
      onExit={onExit} cols="c"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      main={
        <WorkspaceCard title="Canvas" sub="The bespoke in-panel Tangle canvas is the canonical surface — this is the same canvas, but full-bleed.">
          <div style={{ padding: 48, textAlign: "center", color: "var(--ink-3)" }}>
            <Icon name="knot" size={32}/>
            <p style={{ marginTop: 12, fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
              (Tangle canvas — drag notes, cluster them into quests, send to Writer's Room.)
            </p>
            <div style={{ marginTop: 14 }}>
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("tangle")}>
                Open in-panel canvas →
              </button>
            </div>
          </div>
        </WorkspaceCard>
      }
    />
  );
};

// Register
Object.assign(window.WORKSPACE_COMPONENTS, {
  "research-library": ResearchLibraryWorkspace,
  "control-centre":   ControlCentreWorkspace,
  "trash-manager":    TrashManagerWorkspace,
  "speed-reader":     SpeedReaderWorkspace,
  "relationship-map": RelationshipMapWorkspace,
  "tangle-canvas":    TangleCanvasWorkspace,
});

Object.assign(window, {
  ResearchLibraryWorkspace, ControlCentreWorkspace,
  TrashManagerWorkspace, SpeedReaderWorkspace,
  RelationshipMapWorkspace, TangleCanvasWorkspace,
});
