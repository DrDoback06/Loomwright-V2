// =====================================================================
// layout-state.jsx — shared layout state hooks and presets
// localStorage-backed; survives reload until Claude Code wires real settings
// =====================================================================

const LAYOUT_STORAGE_KEY = "loomwright.layout.v1";

const LAYOUT_DEFAULTS = {
  // Writer's Room column widths
  leftMarginWidth: 280,
  rightMarginWidth: 320,
  // Margin collapse
  leftMarginCollapsed: false,
  rightMarginCollapsed: false,
  leftMarginPinned: true,
  rightMarginPinned: true,
  leftMarginAutoHide: false,
  rightMarginAutoHide: false,
  // Writing layout mode
  writingLayoutMode: "full",      // full | manuscript-focus | clean | review | notes
  // Workspace layout preset (panels + margins)
  workspaceLayoutPreset: "writing-only",
  // Right-side panel system
  panelsDockMode: "docked",       // docked | floating
};

const LAYOUT_CONSTRAINTS = {
  leftMarginMin: 220,
  leftMarginMax: 420,
  rightMarginMin: 260,
  rightMarginMax: 460,
  manuscriptMin: 520,
};

const WRITING_LAYOUT_MODES = [
  { id: "full",              label: "Full Workspace",   sub: "Margins, manuscript, all visible.", icon: "panel-right" },
  { id: "manuscript-focus",  label: "Manuscript Focus", sub: "Margins collapsed to side rails.",  icon: "feather" },
  { id: "clean",             label: "Clean Writing",    sub: "Hide everything but the page.",     icon: "eye" },
  { id: "review",            label: "Review Mode",      sub: "Manuscript + right review margin.", icon: "bell" },
  { id: "notes",             label: "Notes Mode",       sub: "Manuscript + left notes margin.",   icon: "paper" },
];

const WORKSPACE_LAYOUT_PRESETS = [
  { id: "writing-only",         label: "Writing Only",            panels: [] },
  { id: "writing-reviews",      label: "Writing + Reviews",       panels: ["review"] },
  { id: "writing-cast",         label: "Writing + Cast",          panels: ["cast"] },
  { id: "writing-cast-map",     label: "Writing + Cast + Map",    panels: ["cast", "atlas"] },
  { id: "writing-references",   label: "Writing + References",    panels: ["refs"] },
  { id: "writing-timeline",     label: "Writing + Timeline",      panels: ["timeline"] },
  { id: "custom",               label: "Custom Layout",           panels: null },
];

function readLayout() {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return { ...LAYOUT_DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...LAYOUT_DEFAULTS, ...parsed };
  } catch (e) {
    return { ...LAYOUT_DEFAULTS };
  }
}

function writeLayout(state) {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* noop */ }
}

const useLayoutState = () => {
  const [state, setState] = React.useState(() => readLayout());

  const setLayout = React.useCallback((patch) => {
    setState((prev) => {
      const next = (typeof patch === "function") ? patch(prev) : { ...prev, ...patch };
      writeLayout(next);
      return next;
    });
  }, []);

  const resetLayout = React.useCallback(() => {
    writeLayout(LAYOUT_DEFAULTS);
    setState({ ...LAYOUT_DEFAULTS });
  }, []);

  return [state, setLayout, resetLayout];
};

Object.assign(window, {
  LAYOUT_DEFAULTS,
  LAYOUT_CONSTRAINTS,
  LAYOUT_STORAGE_KEY,
  WRITING_LAYOUT_MODES,
  WORKSPACE_LAYOUT_PRESETS,
  useLayoutState,
});
