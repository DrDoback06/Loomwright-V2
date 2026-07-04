// =====================================================================
// workspaces-system.jsx — Full workspaces for system / utility tabs.
//
// Registered:
//   • research-library  — References → Research Library (amalgamates
//                         onboarding info, AI style sources, canon
//                         sources, research notes, project intelligence
//                         and writing-style influences)
//   • control-centre    — Settings Control Centre
//   • trash-manager     — Trash Manager (live TrashService)
//   • relationship-map  — Relationship Workspace (embeds the live
//                         RelationshipsPanelBody graph)
//   • tangle-canvas     — Tangle Canvas (renders the live
//                         TangleFullScreen canvas)
// ("speed-reader" is registered by speed-reader.jsx, which loads later.)
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
  // Reference library — the LIVE ReferencesService is the only source;
  // a fresh project shows the designed empty state, never demo rows.
  const [refsVersion, setRefsVersion] = _ws_us(0);
  void refsVersion;
  const refs = (window.LoomwrightBackend?.ReferencesService?.listSync() || [])
    .filter((r) => r && r.status !== "archived");

  const [filter, setFilter] = _ws_us("all");
  const [selectedId, setSelectedId] = _ws_us(refs[0]?.id || null);
  const selected = refs.find((r) => r.id === selectedId) || refs[0];

  // Inline "+ Link entity" picker for the inspector.
  const [linkPickerOpen, setLinkPickerOpen] = _ws_us(false);
  const [linkQuery, setLinkQuery] = _ws_us("");

  const allEntities = (() => {
    const out = [];
    const all = window.LoomwrightBackend?.EntityService?.listAllSync?.() || {};
    for (const byId of Object.values(all)) {
      for (const e of Object.values(byId || {})) {
        if (e && e.id) out.push({ id: e.id, name: e.name || e.id, type: e.type });
      }
    }
    return out;
  })();
  const entityNameById = new Map(allEntities.map((e) => [e.id, e.name]));

  const linkedIdsOf = (r) => {
    const v = r && (r.linkedEntities || r.linkedEntityIds);
    if (v == null) return [];
    return (Array.isArray(v) ? v : [v])
      .map((x) => (typeof x === "string" ? x : x && x.id))
      .filter(Boolean);
  };
  const linkedIds = linkedIdsOf(selected);

  const saveSelectedRef = async (patch) => {
    if (!selected) return;
    await window.LoomwrightBackend?.ReferencesService?.save({ ...selected, ...patch });
  };
  const toggleLinkedEntity = async (entityId) => {
    const next = linkedIds.includes(entityId)
      ? linkedIds.filter((id) => id !== entityId)
      : linkedIds.concat(entityId);
    await saveSelectedRef({ linkedEntities: next });
  };

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
    if (filter === "style") return r.kind === "style" || r.styleSource || r.isStyleInfluence;
    if (filter === "canon") return r.kind === "canon" || r.canonSource || r.isCanonSource;
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
                  {r.aiContext !== false && <span className="fws-chip fws-chip--accent">AI</span>}
                  {(r.styleSource || r.isStyleInfluence || r.kind === "style") && <span className="fws-chip">style</span>}
                  {(r.canonSource || r.isCanonSource || r.kind === "canon") && <span className="fws-chip">canon</span>}
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
                      <input type="checkbox" checked={selected.aiContext !== false} data-callback="onToggleReferenceAIContext"
                        onChange={() => saveSelectedRef({ aiContext: selected.aiContext === false })}/>
                      <span>Include in AI context</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <input type="checkbox" checked={!!(selected.styleSource || selected.isStyleInfluence)} data-callback="onToggleReferenceStyleInfluence"
                        onChange={() => {
                          const next = !(selected.styleSource || selected.isStyleInfluence);
                          saveSelectedRef({ styleSource: next, isStyleInfluence: next });
                        }}/>
                      <span>Use as writing-style influence</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <input type="checkbox" checked={!!(selected.canonSource || selected.isCanonSource)} data-callback="onToggleReferenceCanonSource"
                        onChange={() => {
                          const next = !(selected.canonSource || selected.isCanonSource);
                          saveSelectedRef({ canonSource: next, isCanonSource: next });
                        }}/>
                      <span>Treat as canon source</span>
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: 12 }} data-testid="rlw-linked-entities">
                  <div className="fws-section__title" style={{ marginBottom: 6 }}>Linked entities</div>
                  {linkedIds.length === 0 && (
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontStyle: "italic" }}>
                      None yet — link the entities this reference informs.
                    </div>
                  )}
                  {linkedIds.map((id) => (
                    <button key={id} className="fws-chip" style={{ marginRight: 4, marginBottom: 4, cursor: "pointer" }}
                      data-callback="onOpenRelatedEntity" title="Open this entity"
                      onClick={() => window.dispatchEvent(new CustomEvent("lw:open-search-result", {
                        detail: { type: "entity", entityId: id, entityType: window.LoomwrightBackend?.EntityService?.getSync?.(id)?.type },
                      }))}>
                      {entityNameById.get(id) || id}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <button className="fws-section__action" data-callback="onLinkReferenceToEntity"
                    data-testid="rlw-link-entity"
                    onClick={() => { setLinkPickerOpen((v) => !v); setLinkQuery(""); }}>
                    {linkPickerOpen ? "Done linking" : "+ Link entity"}
                  </button>
                  {linkPickerOpen && (
                    <div className="fws-card" style={{ padding: 8, marginTop: 6 }} data-testid="rlw-link-picker">
                      <input
                        autoFocus
                        value={linkQuery}
                        onChange={(e) => setLinkQuery(e.target.value)}
                        placeholder="Search entities…"
                        style={{ width: "100%", boxSizing: "border-box", padding: "5px 8px", fontSize: 12, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", color: "var(--ink-1)", marginBottom: 6 }}
                      />
                      {(() => {
                        const q = linkQuery.trim().toLowerCase();
                        const rows = allEntities
                          .filter((e) => !q || e.name.toLowerCase().includes(q))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .slice(0, 8);
                        if (allEntities.length === 0) return (
                          <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontStyle: "italic", padding: 4 }}>
                            No entities in this project yet.
                          </div>
                        );
                        if (rows.length === 0) return (
                          <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontStyle: "italic", padding: 4 }}>
                            No entities match "{linkQuery}".
                          </div>
                        );
                        return rows.map((e) => {
                          const isLinked = linkedIds.includes(e.id);
                          return (
                            <button key={e.id} type="button"
                              data-callback="onLinkReferenceToEntity"
                              data-testid={"rlw-pick-" + e.id}
                              onClick={() => toggleLinkedEntity(e.id)}
                              title={isLinked ? "Unlink this entity" : "Link this entity"}
                              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "5px 6px", background: "transparent", border: "none", borderRadius: "var(--r-2)", cursor: "pointer", color: "var(--ink-1)", fontSize: 12, textAlign: "left" }}>
                              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                              <span className={"fws-chip " + (isLinked ? "fws-chip--ok" : "")}>{isLinked ? "linked ✓" : e.type}</span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  )}
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
          <RichSettingsSection sectionId={activeId} onRequest={onRequest}/>
        </WorkspaceCard>
      }
    />
  );
};

// =====================================================================
// TRASH MANAGER --------------------------------------------------------
// =====================================================================
const _wsAgo = (iso) => {
  if (!iso) return "recently";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "recently";
  const mins = Math.round(ms / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return mins + " min ago";
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
  const days = Math.round(hours / 24);
  if (days < 31) return days + (days === 1 ? " day ago" : " days ago");
  return Math.round(days / 30) + " months ago";
};

const TrashManagerWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  // The LIVE TrashService is the only source — a project with no
  // deletions shows the designed empty state, never demo rows.
  const [trashVersion, setTrashVersion] = _ws_us(0);
  void trashVersion;
  const items = (window.LoomwrightBackend?.TrashService?.listSync() || [])
    .map((t) => ({
      id: t.id,
      name: t.name || t.title || "Untitled",
      type: t.type || "entity",
      summary: t.summary || (t.data && (t.data.summary || t.data.description)) || "",
      deleted: _wsAgo(t.deletedAt),
      deletedAt: t.deletedAt,
      raw: t,
    }));

  const [filter, setFilter] = _ws_us("all");
  const [search, setSearch] = _ws_us("");
  const [selectedId, setSelectedId] = _ws_us(items[0]?.id || null);
  const [confirmingDelete, setConfirmingDelete] = _ws_us(false);
  const [showFullRecord, setShowFullRecord] = _ws_us(false);

  _ws_ue(() => {
    const refresh = () => setTrashVersion(Date.now());
    window.addEventListener("lw:entity-store-updated", refresh);
    window.addEventListener("lw:project-imported", refresh);
    window.addEventListener("lw:backend-ready", refresh);
    return () => {
      window.removeEventListener("lw:entity-store-updated", refresh);
      window.removeEventListener("lw:project-imported", refresh);
      window.removeEventListener("lw:backend-ready", refresh);
    };
  }, []);

  const typeRows = (() => {
    const counts = new Map();
    items.forEach((i) => counts.set(i.type, (counts.get(i.type) || 0) + 1));
    const rows = Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, count]) => ({ id: type, label: type.charAt(0).toUpperCase() + type.slice(1), count }));
    return [{ id: "all", label: "All", count: items.length }, ...rows];
  })();

  const filtered = items.filter((i) => {
    if (filter !== "all" && i.type !== filter) return false;
    if (search && !(i.name.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });
  const selected = items.find((x) => x.id === selectedId) || filtered[0];

  const notify = (message) => window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message } }));
  const restoreSelected = async () => {
    if (!selected) return;
    await window.LoomwrightBackend?.TrashService?.restore(selected.id);
    setSelectedId(null);
    setConfirmingDelete(false);
    setShowFullRecord(false);
    setTrashVersion(Date.now());
    notify('"' + selected.name + '" restored.');
  };
  const purgeSelected = async () => {
    if (!selected) return;
    await window.LoomwrightBackend?.TrashService?.purge(selected.id);
    setSelectedId(null);
    setConfirmingDelete(false);
    setShowFullRecord(false);
    setTrashVersion(Date.now());
    notify('"' + selected.name + '" permanently deleted.');
  };

  // First paragraph / key fields of the deleted record, for the preview.
  const previewFields = (() => {
    if (!selected) return [];
    const d = (selected.raw && selected.raw.data) || {};
    return Object.entries(d)
      .filter(([, v]) => (typeof v === "string" && v.trim()) || typeof v === "number" || (Array.isArray(v) && v.length))
      .slice(0, 6)
      .map(([k, v]) => ({
        label: k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
        value: Array.isArray(v)
          ? v.map((x) => (x && typeof x === "object" ? (x.name || x.id || "") : String(x))).filter(Boolean).join(", ")
          : String(v),
      }))
      .filter((f) => f.value);
  })();

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
            {typeRows.map((f) => (
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
                <span>Detail</span>
                <span>Deleted</span>
              </div>
              {filtered.map((i) => (
                <div key={i.id}
                  data-testid={"tmw-row-" + i.id}
                  className={"fws-trash-row " + (selected && selected.id === i.id ? "is-selected" : "")}
                  onClick={() => { setSelectedId(i.id); setConfirmingDelete(false); setShowFullRecord(false); }}>
                  <Icon name="trash" size={11}/>
                  <span className="fws-trash-row__name">{i.name}</span>
                  <span className="fws-trash-row__meta">{i.type}</span>
                  <span className="fws-trash-row__meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.summary || "—"}</span>
                  <span className="fws-trash-row__meta">{i.deleted}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="fws-empty" style={{ padding: 20 }}>
                  {items.length === 0
                    ? "Trash is empty — deleted entities wait here for 30 days before they vanish."
                    : "Trash is empty for this filter."}
                </div>
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
              <div className="fws-card" style={{ padding: 12 }} data-testid="tmw-preview">
                <div className="fws-card__title">{selected.name}</div>
                <div className="fws-card__sub">{selected.type} · deleted {selected.deleted}</div>
                <hr className="hr" style={{ margin: "10px 0" }}/>
                {selected.summary ? (
                  <p style={{ margin: 0, fontFamily: "var(--font-serif)", color: "var(--ink-2)", fontSize: 12, lineHeight: 1.55 }}>
                    {selected.summary}
                  </p>
                ) : previewFields.length === 0 ? (
                  <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 12, lineHeight: 1.55 }}>
                    No summary on this record — restore it to see the full sheet, or preview the raw record below.
                  </p>
                ) : null}
                {previewFields.length > 0 && (
                  <div style={{ marginTop: selected.summary ? 10 : 0, display: "flex", flexDirection: "column", gap: 5 }}>
                    {previewFields.map((f) => (
                      <div key={f.label} style={{ fontSize: 11.5, lineHeight: 1.45 }}>
                        <span style={{ color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 9.5, fontWeight: 600 }}>{f.label}</span>
                        <div style={{ color: "var(--ink-2)" }}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                <button className="fws-topbar__primary" data-callback="onRestoreFromTrash"
                  data-testid="tmw-restore" onClick={restoreSelected}>
                  <Icon name="check" size={11}/> Restore
                </button>
                <button className="fws-section__action" data-callback="onPreviewTrashItem"
                  data-testid="tmw-full-record"
                  onClick={() => setShowFullRecord((v) => !v)}>
                  {showFullRecord ? "Hide full record" : "Preview full record"}
                </button>
                {showFullRecord && (
                  <pre data-testid="tmw-record-json" style={{ margin: 0, padding: 10, maxHeight: 240, overflow: "auto", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", fontSize: 10.5, lineHeight: 1.5, color: "var(--ink-2)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {JSON.stringify(selected.raw, null, 2)}
                  </pre>
                )}
                {!confirmingDelete ? (
                  <button className="fws-section__action" style={{ color: "#a84a3a" }} onClick={() => setConfirmingDelete(true)}>Delete forever…</button>
                ) : (
                  <div className="fws-card" style={{ padding: 10, borderColor: "rgba(168, 74, 58, 0.4)" }}>
                    <div style={{ fontSize: 12, color: "var(--ink-1)", marginBottom: 8 }}>This cannot be undone.</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="fws-topbar__primary" style={{ background: "#a84a3a", borderColor: "#a84a3a" }}
                        data-callback="onDeleteForever" data-testid="tmw-delete-forever" onClick={purgeSelected}>Delete forever</button>
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
// RELATIONSHIP MAP WORKSPACE -------------------------------------------
// (a lightweight shell — the existing in-panel relationship graph
// continues to live in relationships.jsx and is preferred when present)
// =====================================================================
const RelationshipMapWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const [relVersion, setRelVersion] = _ws_us(0);
  void relVersion;
  _ws_ue(() => {
    const refresh = () => setRelVersion(Date.now());
    window.addEventListener("lw:entity-store-updated", refresh);
    window.addEventListener("lw:backend-ready", refresh);
    return () => {
      window.removeEventListener("lw:entity-store-updated", refresh);
      window.removeEventListener("lw:backend-ready", refresh);
    };
  }, []);

  // Live graph health for the Tools rail.
  const bonds = (window.LoomwrightBackend?.EntityService?.listSync("relationships") || []);
  const byType = (() => {
    const m = new Map();
    bonds.forEach((b) => {
      const t = (b.data && (b.data.bondType || b.data.type)) || "bond";
      m.set(t, (m.get(t) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  })();
  const withEvidence = bonds.filter((b) => Array.isArray(b.data?.evidence) && b.data.evidence.length).length;

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
        <WorkspaceCard title="Relationship graph" sub="The same live graph as the docked panel, with room to breathe.">
          {typeof RelationshipsPanelBody !== "undefined" ? (
            <div style={{ minHeight: 420 }} data-testid="rmw-graph">
              <RelationshipsPanelBody panel={{ id: "p-relationships", entityType: "relationships", workspace: true }}/>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("relationships")}>
                <Icon name="link" size={11}/> Open Relationships panel →
              </button>
            </div>
          )}
        </WorkspaceCard>
      }
      right={
        <>
          <div className="fws-section"><span className="fws-section__title">Graph health</span></div>
          <div className="fws-tab-body" data-testid="rmw-tools">
            <div className="fws-card" style={{ padding: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 4 }}>
                <span><strong>{bonds.length}</strong> tracked {bonds.length === 1 ? "bond" : "bonds"}</span>
                <span><strong>{withEvidence}</strong> with source evidence</span>
              </div>
              {byType.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {byType.map(([t, n]) => (
                    <span key={t} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{t} · {n}</span>
                  ))}
                </div>
              )}
            </div>
            <button className="fws-section__action" data-callback="onAddEvidence"
              title="Open a relationship record to attach manuscript evidence"
              onClick={() => onRequest.openEntityEditor({ type: "relationships" })}>
              + Add evidence
            </button>
            <button className="fws-section__action" onClick={() => onRequest.openPanel("relationships")}>
              Open docked panel
            </button>
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// TANGLE CANVAS WORKSPACE ----------------------------------------------
// The live full-screen Tangle canvas (tangle.jsx) IS the workspace —
// same nodes, edges, and clusters as the docked panel.
// =====================================================================
const TangleCanvasWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  if (typeof TangleFullScreen !== "undefined") {
    return <TangleFullScreen onClose={onExit}/>;
  }
  // Defensive fallback if tangle.jsx didn't load.
  return (
    <WorkspaceShell
      icon="knot"
      eyebrow="Tangle" title="Tangle Canvas"
      subtitle="A canvas for non-linear thinking — clusters become quests, notes, and threads."
      onExit={onExit} cols="c"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      main={
        <WorkspaceCard title="Canvas">
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("tangle")}>
              Open in-panel canvas →
            </button>
          </div>
        </WorkspaceCard>
      }
    />
  );
};

// Register. NOTE: speed-reader.jsx (loaded after this file) registers
// the live SpeedReaderWorkspaceFull under "speed-reader".
Object.assign(window.WORKSPACE_COMPONENTS, {
  "research-library": ResearchLibraryWorkspace,
  "control-centre":   ControlCentreWorkspace,
  "trash-manager":    TrashManagerWorkspace,
  "relationship-map": RelationshipMapWorkspace,
  "tangle-canvas":    TangleCanvasWorkspace,
});

Object.assign(window, {
  ResearchLibraryWorkspace, ControlCentreWorkspace,
  TrashManagerWorkspace,
  RelationshipMapWorkspace, TangleCanvasWorkspace,
});
