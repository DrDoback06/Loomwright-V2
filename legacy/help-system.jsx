// =====================================================================
// help-system.jsx — persistent Help "?" + help panel + guided tour.
//
//   • HelpService    — seen-state in localStorage (lw:v2:help_seen),
//                      active-surface resolution.
//   • HelpButton     — the "?" affordance; dispatches lw:open-help.
//   • HelpOverlay    — per-surface panel: intro + every control with a
//                      hover-highlight of the real DOM target.
//   • CoachmarkTour  — spotlight walk over the surface's real controls
//                      (querySelector + rect ring), next/prev/skip/done,
//                      centered-card fallback on mobile or missing targets.
//   • HelpHost       — mounted once in app.jsx; owns open/tour state and
//                      resolves the current surface from live app state.
//
// Content lives in help-content.jsx (window.HELP_CONTENT) keyed by the
// real selectors, so the docs cannot silently drift from the UI.
// Deterministic and zero-token.
// =====================================================================

const { useState: _hp_us, useEffect: _hp_ue, useMemo: _hp_um, useRef: _hp_ur } = React;

const HELP_SEEN_KEY = "lw:v2:help_seen";

const HelpService = {
  _load() {
    try { return JSON.parse(window.localStorage.getItem(HELP_SEEN_KEY) || "{}") || {}; } catch (_) { return {}; }
  },
  _save(map) {
    try { window.localStorage.setItem(HELP_SEEN_KEY, JSON.stringify(map)); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent("lw:help-seen-updated")); } catch (_) {}
  },
  isSeen(surfaceId) {
    return !!this._load()[surfaceId];
  },
  markSeen(surfaceId, extra = {}) {
    if (!surfaceId) return;
    const map = this._load();
    map[surfaceId] = { ...(map[surfaceId] || {}), seenAt: Date.now(), ...extra };
    this._save(map);
  },
  resetAll() {
    this._save({});
  },
  // Resolve what the user is looking at, most specific first:
  // open full workspace → front docked panel → the current route.
  getActiveSurface({ routeId, panelWorkspace, panels } = {}) {
    if (panelWorkspace && panelWorkspace.open && panelWorkspace.id) return "workspace:" + panelWorkspace.id;
    const domWs = document.querySelector("[data-ui='FullWorkspaceHost']");
    if (domWs) return "workspace:" + domWs.getAttribute("data-workspace-id");
    const open = (panels || []).filter((p) => p && !p.collapsed);
    if (open.length) {
      const front = open.reduce((a, b) => ((a.order || 0) >= (b.order || 0) ? a : b));
      const kind = front.entityType || (front.id || "").replace(/^p-/, "") || front.kind;
      if (kind && window.HELP_CONTENT && window.HELP_CONTENT["panel:" + kind]) return "panel:" + kind;
    }
    return "route:" + (routeId || "home");
  },
  contentFor(surfaceId) {
    const reg = window.HELP_CONTENT || {};
    return reg[surfaceId] || null;
  },
};

// ---------------------------------------------------------------------
// HelpButton — drop-in "?" for topbars / panel headers / workspaces.
// Passing surfaceId pins the topic; omitting it lets HelpHost resolve
// the active surface at open time.
// ---------------------------------------------------------------------
const HelpButton = ({ surfaceId, className = "", size = 12, title = "Help for this page (what every control does)" }) => (
  <button
    type="button"
    className={"helpbtn " + className}
    data-callback="onOpenHelp"
    data-help-surface={surfaceId || undefined}
    title={title}
    onMouseDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("lw:open-help", { detail: { surfaceId: surfaceId || null } }));
    }}
  >
    <span aria-hidden>?</span>
  </button>
);

// Flash a ring around a control so "which button is that?" answers itself.
const _helpFlashTarget = (selector) => {
  try {
    const el = document.querySelector(selector);
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    const ring = document.createElement("div");
    ring.className = "help-flash-ring";
    Object.assign(ring.style, {
      left: r.left - 6 + "px", top: r.top - 6 + "px",
      width: r.width + 12 + "px", height: r.height + 12 + "px",
    });
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 1400);
    return true;
  } catch (_) { return false; }
};

// ---------------------------------------------------------------------
// HelpOverlay — the per-surface help panel.
// ---------------------------------------------------------------------
const HelpOverlay = ({ surfaceId, content, onClose, onStartTour }) => {
  _hp_ue(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  if (!content) return null;
  // Only list controls that exist on screen right now — the same surface
  // can hide controls by state (e.g. multibar buttons before a selection).
  const present = (content.controls || []).map((c) => ({ ...c, onScreen: !!document.querySelector(c.selector) }));
  const tourAvailable = (content.tour || []).some((s) => document.querySelector(s.selector));
  return (
    <div className="help-overlay" data-ui="HelpOverlay" role="dialog" aria-modal="true" aria-label={"Help: " + content.title} onClick={onClose}>
      <div className="help-overlay__card" onClick={(e) => e.stopPropagation()}>
        <div className="help-overlay__head">
          <span className="help-overlay__eyebrow">Help</span>
          <h2 className="help-overlay__title">{content.title}</h2>
          <span className="help-overlay__spacer"/>
          {(content.tour || []).length > 0 && (
            <button className="help-overlay__tour" data-callback="onStartHelpTour"
              disabled={!tourAvailable}
              title={tourAvailable ? "Step through the real controls on this page" : "Tour targets aren't on screen right now"}
              onClick={onStartTour}>
              ▶ Take the tour
            </button>
          )}
          <button className="help-overlay__x" data-callback="onCloseHelp" title="Close (Esc)" onClick={onClose}>
            <Icon name="close" size={11}/>
          </button>
        </div>
        <p className="help-overlay__intro">{content.intro}</p>
        {present.length > 0 && (
          <>
            <div className="help-overlay__subhead">Controls on this page</div>
            <ul className="help-overlay__controls">
              {present.map((c, i) => (
                <li key={i} className={"help-overlay__control" + (c.onScreen ? "" : " is-offscreen")}>
                  <button
                    className="help-overlay__control-name"
                    title={c.onScreen ? "Show me" : "Appears in another state of this page"}
                    onClick={() => c.onScreen && _helpFlashTarget(c.selector)}
                  >
                    {c.label}
                    {c.onScreen && <span className="help-overlay__locate">◎</span>}
                  </button>
                  <span className="help-overlay__control-desc">{c.desc}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="help-overlay__foot">
          <span className="help-overlay__hint">Every page has this “?” — including full editors and mobile.</span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// CoachmarkTour — spotlight steps over real DOM targets.
// ---------------------------------------------------------------------
const CoachmarkTour = ({ surfaceId, steps, onDone }) => {
  const [ix, setIx] = _hp_us(0);
  const [rect, setRect] = _hp_us(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 700;
  const step = steps[ix];

  _hp_ue(() => {
    if (!step) return;
    const el = document.querySelector(step.selector);
    if (el && !isMobile) {
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const measure = () => {
        const r = el.getBoundingClientRect();
        setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      };
      const t = setTimeout(measure, 180); // after scroll settles
      measure();
      window.addEventListener("resize", measure);
      return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
    }
    // Mobile / missing target: centered card, flash if present.
    if (el) _helpFlashTarget(step.selector);
    setRect(null);
  }, [ix, step && step.selector, isMobile]);

  _hp_ue(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onDone(); }
      if (e.key === "ArrowRight" || e.key === "Enter") setIx((i) => Math.min(steps.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDone, steps.length]);

  if (!step) return null;
  // Card position: under the target (clamped), or centered as fallback.
  const cardStyle = rect
    ? {
        left: Math.max(12, Math.min(window.innerWidth - 332, rect.left)),
        top: rect.top + rect.height + 14 > window.innerHeight - 170
          ? Math.max(12, rect.top - 160)
          : rect.top + rect.height + 14,
      }
    : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="help-tour" data-ui="CoachmarkTour">
      {/* The ring's cutout shadow doubles as the scrim when a target is
          highlighted; the flat scrim only renders for centered fallback. */}
      {!rect && <div className="help-tour__scrim" onClick={onDone}/>}
      {rect && <div className="help-tour__scrim help-tour__scrim--transparent" onClick={onDone}/>}
      {rect && (
        <div className="help-tour__ring" style={{
          left: rect.left - 8, top: rect.top - 8,
          width: rect.width + 16, height: rect.height + 16,
        }}/>
      )}
      <div className="help-tour__card" data-testid="help-tour-card" style={cardStyle}>
        <div className="help-tour__step">{ix + 1} / {steps.length}</div>
        <div className="help-tour__title">{step.title}</div>
        <div className="help-tour__body">{step.body}</div>
        <div className="help-tour__actions">
          <button className="help-tour__btn" data-callback="onTourPrev" disabled={ix === 0} onClick={() => setIx((i) => Math.max(0, i - 1))}>← Back</button>
          <span className="help-tour__spacer"/>
          <button className="help-tour__btn help-tour__btn--ghost" data-callback="onTourSkip" onClick={onDone}>Skip</button>
          {ix < steps.length - 1 ? (
            <button className="help-tour__btn help-tour__btn--primary" data-callback="onTourNext" onClick={() => setIx((i) => i + 1)}>Next →</button>
          ) : (
            <button className="help-tour__btn help-tour__btn--primary" data-callback="onTourDone" onClick={onDone}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// HelpHost — single mount in app.jsx.
// ---------------------------------------------------------------------
const HelpHost = ({ routeId, panelWorkspace, panels }) => {
  const [open, setOpen] = _hp_us(null);   // { surfaceId } | null
  const [tour, setTour] = _hp_us(null);   // { surfaceId, steps } | null
  const stateRef = _hp_ur({});
  stateRef.current = { routeId, panelWorkspace, panels };

  _hp_ue(() => {
    const onOpenHelp = (e) => {
      const requested = e?.detail?.surfaceId;
      const surfaceId = (requested && HelpService.contentFor(requested))
        ? requested
        : HelpService.getActiveSurface(stateRef.current);
      setTour(null);
      setOpen({ surfaceId });
      HelpService.markSeen(surfaceId);
    };
    window.addEventListener("lw:open-help", onOpenHelp);
    return () => window.removeEventListener("lw:open-help", onOpenHelp);
  }, []);

  if (tour) {
    return <CoachmarkTour surfaceId={tour.surfaceId} steps={tour.steps}
      onDone={() => { HelpService.markSeen(tour.surfaceId, { tourDone: Date.now() }); setTour(null); }}/>;
  }
  if (!open) return null;
  const content = HelpService.contentFor(open.surfaceId) || {
    title: open.surfaceId,
    intro: "No help entry for this surface yet — that's a bug; every page should have one.",
    controls: [], tour: [],
  };
  return (
    <HelpOverlay
      surfaceId={open.surfaceId}
      content={content}
      onClose={() => setOpen(null)}
      onStartTour={() => {
        const steps = (content.tour || []).filter((s) => document.querySelector(s.selector));
        setOpen(null);
        if (steps.length) setTour({ surfaceId: open.surfaceId, steps });
      }}
    />
  );
};

Object.assign(window, { HelpService, HelpButton, HelpOverlay, CoachmarkTour, HelpHost });
