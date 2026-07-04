// =====================================================================
// primitives.jsx — Reusable atoms: BrandMark, badges, chips, buttons,
// EmptyState, LoadingState, ErrorState, ConfirmModal, Tooltip.
// =====================================================================

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ---------------------------------------------------------------------
// BrandMark — swappable logo glyph driven by brand.logoMark
// ---------------------------------------------------------------------
const BrandMark = ({ variant = BRAND.logoMark, size = 28, className = "", short = BRAND.shortName }) => {
  const s = size;
  return (
    <span className={"brand-mark brand-mark--" + variant + " " + className} data-ui="BrandMark" style={{ width: s, height: s }} aria-hidden>
      {variant === "wax-seal" && (
        <svg viewBox="0 0 32 32" width={s} height={s}>
          <defs>
            <radialGradient id="wax" cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="var(--accent-soft)"/>
              <stop offset="60%" stopColor="var(--accent)"/>
              <stop offset="100%" stopColor="var(--accent-deep)"/>
            </radialGradient>
          </defs>
          <circle cx="16" cy="16" r="14" fill="url(#wax)"/>
          <circle cx="16" cy="16" r="14" fill="none" stroke="var(--accent-deep)" strokeOpacity="0.6"/>
          <circle cx="16" cy="16" r="11" fill="none" stroke="var(--accent-deep)" strokeOpacity="0.45" strokeDasharray="1 2"/>
          <text x="16" y="20" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="600" fontSize="12" fill="var(--ink-on-accent)">{short}</text>
        </svg>
      )}
      {variant === "loom-glyph" && (
        <svg viewBox="0 0 32 32" width={s} height={s}>
          <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--accent)"/>
          <path d="M8 9h16M8 16h16M8 23h16M11 6v20M21 6v20" stroke="var(--ink-on-accent)" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      )}
      {variant === "quill-thread" && (
        <svg viewBox="0 0 32 32" width={s} height={s}>
          <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--accent-deep)"/>
          <path d="M22 8c-6 0-12 4-14 10 4 0 10-2 14-10z" fill="var(--accent-soft)" stroke="var(--accent-soft)"/>
          <path d="M8 24c4-2 8-6 14-12" stroke="var(--accent-soft)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      )}
      {variant === "letter-mark" && (
        <svg viewBox="0 0 32 32" width={s} height={s}>
          <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--accent)"/>
          <text x="16" y="22" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="600" fontSize="18" fill="var(--ink-on-accent)">{short}</text>
        </svg>
      )}
    </span>
  );
};

// ---------------------------------------------------------------------
// EntityTypeBadge
// ---------------------------------------------------------------------
const EntityTypeBadge = ({ type, size = "sm", showLabel = true, className = "", ...rest }) => {
  const t = ENTITY_TYPES[type];
  if (!t) return null;
  return (
    <span
      className={"e-badge e-badge--" + size + " " + className}
      data-ui="EntityTypeBadge"
      data-entity={type}
      style={{ "--ec": t.color, "--es": t.soft, "--ed": t.deep }}
      {...rest}
    >
      <span className="e-badge__dot" aria-hidden>{t.glyph}</span>
      {showLabel && <span className="e-badge__label">{t.label}</span>}
    </span>
  );
};

// ---------------------------------------------------------------------
// ConfidenceBadge — used in review queues only
// ---------------------------------------------------------------------
const ConfidenceBadge = ({ level, value, showRange = false, className = "" }) => {
  const c = CONFIDENCE[level];
  if (!c) return null;
  return (
    <span
      className={"c-badge c-badge--" + level + " " + className}
      data-ui="ConfidenceBadge"
      style={{ "--cc": c.color, "--cs": c.soft, "--cd": c.deep }}
    >
      <span className="c-badge__dot" aria-hidden/>
      <span className="c-badge__label">{value != null ? value + "%" : c.label}</span>
      {showRange && <span className="c-badge__range">{c.range}</span>}
    </span>
  );
};

// ---------------------------------------------------------------------
// ReviewCountBadge
// ---------------------------------------------------------------------
const ReviewCountBadge = ({ count, tone = "default", className = "" }) => {
  if (!count) return null;
  return (
    <span className={"q-badge q-badge--" + tone + " " + className} data-ui="ReviewCountBadge">{count > 99 ? "99+" : count}</span>
  );
};

// ---------------------------------------------------------------------
// PrivacyModeChip — Local Only / Cloud Sync / AI Enabled
// ---------------------------------------------------------------------
const PRIVACY_MODES = {
  local:  { label: "Local Only",  icon: "lock",   tone: "neutral" },
  cloud:  { label: "Cloud Sync",  icon: "cloud",  tone: "info" },
  ai:     { label: "AI Enabled",  icon: "sparkle", tone: "accent" },
};
const PrivacyModeChip = ({ mode = "local", onClick, className = "" }) => {
  const m = PRIVACY_MODES[mode] || PRIVACY_MODES.local;
  return (
    <button
      type="button"
      className={"chip chip--" + m.tone + " " + className}
      data-ui="PrivacyModeChip"
      data-callback="onTogglePrivacyMode"
      data-testid="topbar-privacy-chip"
      onClick={onClick}
      title={"Privacy mode: " + m.label}
    >
      <Icon name={m.icon} size={12}/><span>{m.label}</span>
    </button>
  );
};

// ---------------------------------------------------------------------
// SyncStateChip — Saved / Unsaved / Offline / Syncing / Error
// ---------------------------------------------------------------------
const SYNC_STATES = {
  saved:   { label: "Saved",   tone: "ok",      dot: "static" },
  unsaved: { label: "Unsaved", tone: "warn",    dot: "static" },
  syncing: { label: "Syncing", tone: "info",    dot: "pulse" },
  offline: { label: "Offline", tone: "neutral", dot: "static" },
  error:   { label: "Error",   tone: "danger",  dot: "static" },
};
const SyncStateChip = ({ state = "saved", className = "" }) => {
  const s = SYNC_STATES[state] || SYNC_STATES.saved;
  return (
    <span className={"chip chip--" + s.tone + " " + className} data-ui="SyncStateChip" data-testid="topbar-sync-chip">
      <span className={"chip__dot chip__dot--" + s.dot} aria-hidden/>
      <span>{s.label}</span>
    </span>
  );
};

// ---------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------
const Btn = ({ variant = "ghost", size = "md", icon, iconRight, children, className = "", ...rest }) => (
  <button
    type="button"
    className={`btn btn--${variant} btn--${size} ${icon && !children ? "btn--icon" : ""} ${className}`}
    {...rest}
  >
    {icon && <Icon name={icon} size={size === "sm" ? 12 : 14}/>}
    {children && <span className="btn__lbl">{children}</span>}
    {iconRight && <Icon name={iconRight} size={size === "sm" ? 12 : 14}/>}
  </button>
);

// ---------------------------------------------------------------------
// Kbd
// ---------------------------------------------------------------------
const Kbd = ({ children, className = "" }) => <kbd className={"kbd " + className}>{children}</kbd>;

// ---------------------------------------------------------------------
// EmptyState / LoadingState / ErrorState
// ---------------------------------------------------------------------
const EmptyState = ({ icon = "paper", title = "Nothing here yet", body, action, className = "" }) => (
  <div className={"state state--empty " + className} data-ui="EmptyState" role="status">
    <div className="state__icon"><Icon name={icon} size={22}/></div>
    <div className="state__title">{title}</div>
    {body && <div className="state__body">{body}</div>}
    {action && <div className="state__action">{action}</div>}
  </div>
);

const LoadingState = ({ title = "Loading…", lines = 3, className = "" }) => (
  <div className={"state state--loading " + className} data-ui="LoadingState" role="status" aria-live="polite">
    <div className="state__title state__title--muted">{title}</div>
    <div className="skeleton-stack">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: (90 - i * 12) + "%" }}/>
      ))}
    </div>
  </div>
);

const ErrorState = ({ title = "Something didn't load", body, onRetry, className = "" }) => (
  <div className={"state state--error " + className} data-ui="ErrorState" role="alert">
    <div className="state__icon state__icon--danger"><Icon name="warn" size={22}/></div>
    <div className="state__title">{title}</div>
    {body && <div className="state__body">{body}</div>}
    {onRetry && (
      <div className="state__action">
        <Btn variant="ghost" size="sm" icon="bolt" onClick={onRetry} data-callback="onRetry">Try again</Btn>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------
// ConfirmModal — light shell only
// ---------------------------------------------------------------------
const ConfirmModal = ({ open, title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "default", onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" data-ui="ConfirmModal" role="dialog" aria-modal="true">
      <div className={"modal modal--" + tone}>
        <div className="modal__title">{title}</div>
        {body && <div className="modal__body">{body}</div>}
        <div className="modal__actions">
          <Btn variant="ghost" onClick={onCancel} data-callback="onCancel">{cancelLabel}</Btn>
          <Btn variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} data-callback="onConfirm">{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  BrandMark, EntityTypeBadge, ConfidenceBadge, ReviewCountBadge,
  PrivacyModeChip, SyncStateChip, Btn, Kbd,
  EmptyState, LoadingState, ErrorState, ConfirmModal,
  PRIVACY_MODES, SYNC_STATES,
});
