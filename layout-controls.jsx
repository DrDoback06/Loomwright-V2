// =====================================================================
// layout-controls.jsx — WritingLayoutMenu + WorkspaceLayoutMenu
// Two compact dropdowns for the writers-room toolbar
// =====================================================================

const { useState: _lc_us, useEffect: _lc_ue, useRef: _lc_ur } = React;

// Generic outside-click closer
function useOutsideClose(ref, onClose) {
  _lc_ue(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref, onClose]);
}

// ---------------------------------------------------------------------
// WritingLayoutMenu — picks among full / manuscript-focus / clean / review / notes
// ---------------------------------------------------------------------
const WritingLayoutMenu = ({ value, onChange }) => {
  const [open, setOpen] = _lc_us(false);
  const ref = _lc_ur(null);
  useOutsideClose(ref, () => setOpen(false));
  const current = WRITING_LAYOUT_MODES.find((m) => m.id === value) || WRITING_LAYOUT_MODES[0];
  return (
    <div className="wr-layout-menu" ref={ref} data-ui="WritingLayoutMenu">
      <button
        className="wr-layout-menu__btn"
        onClick={() => setOpen((v) => !v)}
        title="Writing layout"
        data-callback="onChangeWritingLayout"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name={current.icon} size={12}/>
        <span>{current.label}</span>
        <Icon name="chevron-d" size={10}/>
      </button>
      {open && (
        <div className="wr-layout-menu__pop" role="menu">
          <div className="wr-layout-menu__head">Writing layout</div>
          {WRITING_LAYOUT_MODES.map((m) => (
            <button
              key={m.id}
              className={"wr-layout-menu__row " + (m.id === value ? "is-active" : "")}
              onClick={() => { onChange(m.id); setOpen(false); }}
              role="menuitemradio"
              aria-checked={m.id === value}
            >
              <Icon name={m.icon} size={14}/>
              <span style={{ flex: 1 }}>
                <span className="wr-layout-menu__row__title">{m.label}</span>
                <span className="wr-layout-menu__row__sub">{m.sub}</span>
              </span>
              {m.id === value && <Icon name="check" size={12}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// WorkspaceLayoutMenu — preset that opens/closes panels
// ---------------------------------------------------------------------
const WorkspaceLayoutMenu = ({ value, onChange }) => {
  const [open, setOpen] = _lc_us(false);
  const ref = _lc_ur(null);
  useOutsideClose(ref, () => setOpen(false));
  const current = WORKSPACE_LAYOUT_PRESETS.find((p) => p.id === value) || WORKSPACE_LAYOUT_PRESETS[0];
  return (
    <div className="wr-layout-menu" ref={ref} data-ui="WorkspaceLayoutMenu">
      <button
        className="wr-layout-menu__btn"
        onClick={() => setOpen((v) => !v)}
        title="Workspace layout"
        data-callback="onChangeWorkspaceLayout"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="panel-right" size={12}/>
        <span>{current.label}</span>
        <Icon name="chevron-d" size={10}/>
      </button>
      {open && (
        <div className="wr-layout-menu__pop" role="menu" style={{ minWidth: 220 }}>
          <div className="wr-layout-menu__head">Workspace presets</div>
          {WORKSPACE_LAYOUT_PRESETS.map((p) => (
            <button
              key={p.id}
              className={"wr-layout-menu__row " + (p.id === value ? "is-active" : "")}
              onClick={() => { onChange(p.id, p.panels); setOpen(false); }}
              role="menuitemradio"
              aria-checked={p.id === value}
            >
              <Icon name="stack" size={14}/>
              <span style={{ flex: 1 }}>
                <span className="wr-layout-menu__row__title">{p.label}</span>
              </span>
              {p.id === value && <Icon name="check" size={12}/>}
            </button>
          ))}
          <div className="wr-layout-menu__sep"/>
          <button
            className="wr-layout-menu__row"
            onClick={() => { onChange("clear", []); setOpen(false); }}
          >
            <Icon name="close" size={14}/>
            <span style={{ flex: 1 }}>
              <span className="wr-layout-menu__row__title">Close all panels</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// MarginResizer — thin draggable handle for column resize
// ---------------------------------------------------------------------
const MarginResizer = ({ side, value, min, max, onChange }) => {
  const startRef = _lc_ur({ x: 0, w: value });
  const onDown = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, w: value };
    const onMove = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const next = side === "left"
        ? Math.max(min, Math.min(max, startRef.current.w + dx))
        : Math.max(min, Math.min(max, startRef.current.w - dx));
      onChange(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  return (
    <div
      className="wr-resize"
      data-ui="MarginResizer"
      data-side={side}
      onMouseDown={onDown}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize"
    />
  );
};

// ---------------------------------------------------------------------
// MarginEdgeTab — vertical tab to expand a collapsed margin
// ---------------------------------------------------------------------
const MarginEdgeTab = ({ side, label, count, onClick }) => (
  <button
    className={"wr-margin-tab " + (side === "right" ? "wr-margin-tab--right" : "")}
    onClick={onClick}
    title={label + " — click to expand"}
    data-callback="onExpandMargin"
  >
    {label}{count ? " (" + count + ")" : ""}
  </button>
);

Object.assign(window, { WritingLayoutMenu, WorkspaceLayoutMenu, MarginResizer, MarginEdgeTab });
