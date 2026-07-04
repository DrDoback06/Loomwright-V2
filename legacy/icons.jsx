// =====================================================================
// icons.jsx — Tiny stroke-based icon set (16px viewBox).
// All icons accept size + className. Stroke uses currentColor.
// =====================================================================

const Icon = ({ name, size = 16, className = "", strokeWidth = 1.5, ...rest }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 16 16",
    fill: "none", stroke: "currentColor",
    strokeWidth, strokeLinecap: "round", strokeLinejoin: "round",
    className: "icon-svg " + className,
    ...rest,
  };
  switch (name) {
    case "home":     return <svg {...props}><path d="M2.5 7.5 8 2.5l5.5 5M3.5 7v6.5h9V7"/><path d="M6.5 13.5V10h3v3.5"/></svg>;
    case "sun":      return <svg {...props}><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.3 3.3l1 1M11.7 11.7l1 1M3.3 12.7l1-1M11.7 4.3l1-1"/></svg>;
    case "feather":  return <svg {...props}><path d="M13 2c-3 0-7 2-9 5-1.5 2.3-1 5 0 6 1 1 3.7 1.5 6-.5 3-2 5-6 5-9l-1 1c-1.5 0-3.5.5-5 2s-2.5 3-2.5 4.5"/><path d="M3 13l4-4"/></svg>;
    case "user":     return <svg {...props}><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5c.5-2.5 2.5-4 5-4s4.5 1.5 5 4"/></svg>;
    case "claw":     return <svg {...props}><path d="M3 3c1.5 4 4 7 8 8M5 3c.5 3.5 3 6.5 7 7.5M7 3c0 3 2 5.5 5 6.5"/><path d="M2 13.5l3-1.5M2.5 11l2.5-1"/></svg>;
    case "compass":  return <svg {...props}><circle cx="8" cy="8" r="6"/><path d="m10.5 5.5-3 1.5-1 3 3-1.5 1-3z"/></svg>;
    case "pin":      return <svg {...props}><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 1 0-9 0C3.5 9.8 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.5"/></svg>;
    case "gem":      return <svg {...props}><path d="m8 2 4 3.5-4 8.5-4-8.5L8 2z"/><path d="M4 5.5h8M8 2v12"/></svg>;
    case "shield":   return <svg {...props}><path d="M8 1.5 3 3.5v4c0 3 2.2 5.5 5 7 2.8-1.5 5-4 5-7v-4L8 1.5z"/></svg>;
    case "branch":   return <svg {...props}><path d="M8 14V4M8 4 5 1.5M8 4l3-2.5M8 8 5 6M8 10l3-2"/></svg>;
    case "bars":     return <svg {...props}><path d="M3 13V9M7 13V5M11 13V7"/></svg>;
    case "spark":    return <svg {...props}><path d="M8 2v4M8 10v4M2 8h4M10 8h4M4 4l2.5 2.5M9.5 9.5 12 12M4 12l2.5-2.5M9.5 6.5 12 4"/></svg>;
    case "tree":     return <svg {...props}><circle cx="8" cy="3" r="1.5"/><circle cx="3.5" cy="8" r="1.5"/><circle cx="12.5" cy="8" r="1.5"/><circle cx="6" cy="13" r="1.5"/><circle cx="10" cy="13" r="1.5"/><path d="M8 4.5v3M8 7.5l-3 .5M8 7.5l3 .5M5 9.5l1 2M11 9.5l-1 2"/></svg>;
    case "link":     return <svg {...props}><path d="M6.5 9.5 4.5 11.5a2.1 2.1 0 1 1-3-3l2-2M9.5 6.5l2-2a2.1 2.1 0 1 1 3 3l-2 2M6 10l4-4"/></svg>;
    case "scroll":   return <svg {...props}><path d="M3 3.5h7.5v9c0 .8-.7 1.5-1.5 1.5H4M10.5 3.5c.8 0 1.5.7 1.5 1.5v1H3"/><path d="M5.5 6.5h3M5.5 9h3"/></svg>;
    case "bolt":     return <svg {...props}><path d="M9 1.5 3.5 9h4l-1 5.5L12 7H8l1-5.5z"/></svg>;
    case "clock":    return <svg {...props}><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>;
    case "book":     return <svg {...props}><path d="M3 3.5C5 3 7 3 8 4c1-1 3-1 5-.5v9c-2-.5-4-.5-5 .5-1-1-3-1-5-.5v-9z"/><path d="M8 4v9"/></svg>;
    case "knot":     return <svg {...props}><path d="M3 5c2 0 3 2 5 2s3-2 5-2-1 5-3 5-3-3-5-3-5 5-3 5 3-5 5-5 3 5 5 5"/></svg>;
    case "eye":      return <svg {...props}><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>;
    case "paper":    return <svg {...props}><path d="M4 1.5h5l3 3v10H4v-13z"/><path d="M9 1.5v3h3M6 7.5h4M6 10h4M6 12.5h2.5"/></svg>;
    case "trash":    return <svg {...props}><path d="M3 4.5h10M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M4.5 4.5l.5 9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-9"/><path d="M7 7v5M9 7v5"/></svg>;
    case "gear":     return <svg {...props}><circle cx="8" cy="8" r="2"/><path d="M8 1.5v1.7M8 12.8v1.7M14.5 8h-1.7M3.2 8H1.5M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2M12.6 12.6l-1.2-1.2M4.6 4.6 3.4 3.4"/></svg>;
    case "search":   return <svg {...props}><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>;
    case "filter":   return <svg {...props}><path d="M2.5 3.5h11l-4 5v4l-3 1.5v-5.5l-4-5z"/></svg>;
    case "sort":     return <svg {...props}><path d="M4 3v10M4 13l-2-2M4 13l2-2M12 13V3M12 3l-2 2M12 3l2 2"/></svg>;
    case "pin-tack": return <svg {...props}><path d="M9 1.5 14.5 7l-2 1-1.5 1.5-1 4.5-3-3-3.5 3.5L4 14l3.5-3.5-3-3 4.5-1L10.5 5l1-2-2.5-1.5z"/></svg>;
    case "expand":   return <svg {...props}><path d="M3 6.5V3h3.5M13 6.5V3H9.5M3 9.5V13h3.5M13 9.5V13H9.5"/></svg>;
    case "close":    return <svg {...props}><path d="m4 4 8 8M12 4l-8 8"/></svg>;
    case "more":     return <svg {...props}><circle cx="3.5" cy="8" r=".8"/><circle cx="8" cy="8" r=".8"/><circle cx="12.5" cy="8" r=".8"/></svg>;
    case "menu":     return <svg {...props}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/></svg>;
    case "panel-left":return <svg {...props}><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M6 3v10"/></svg>;
    case "panel-right":return <svg {...props}><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M10 3v10"/></svg>;
    case "chevron-r":return <svg {...props}><path d="m6 3 4 5-4 5"/></svg>;
    case "chevron-d":return <svg {...props}><path d="m3 6 5 4 5-4"/></svg>;
    case "chevron-up":return <svg {...props}><path d="m3 10 5-4 5 4"/></svg>;
    case "plus":     return <svg {...props}><path d="M8 3v10M3 8h10"/></svg>;
    case "check":    return <svg {...props}><path d="m3 8 3.5 3.5L13 5"/></svg>;
    case "command":  return <svg {...props}><path d="M5 3.5h6v6h-6v-6z"/><path d="M5 3.5a1.5 1.5 0 1 0-1.5 1.5H5M11 3.5a1.5 1.5 0 1 1 1.5 1.5H11M5 9.5a1.5 1.5 0 1 1-1.5 1.5V9.5h1.5zM11 9.5a1.5 1.5 0 1 0 1.5 1.5V9.5H11z"/></svg>;
    case "lock":     return <svg {...props}><rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>;
    case "cloud":    return <svg {...props}><path d="M4.5 12.5h7.2a2.8 2.8 0 0 0 .3-5.6 4 4 0 0 0-7.7-.4 2.6 2.6 0 0 0 .2 6z"/></svg>;
    case "sparkle":  return <svg {...props}><path d="M5 2.5v3M3.5 4h3M11 9.5v4M9 11.5h4M8 1.5l1.5 4.5L14 7.5l-4.5 1.5L8 13.5l-1.5-4.5L2 7.5l4.5-1.5L8 1.5z"/></svg>;
    case "warn":     return <svg {...props}><path d="M8 2 14.5 13.5h-13L8 2z"/><path d="M8 6.5v3M8 11.5v.5"/></svg>;
    case "bell":     return <svg {...props}><path d="M8 2c-2.5 0-4 1.8-4 4.5 0 3-1.5 4-1.5 4h11s-1.5-1-1.5-4c0-2.7-1.5-4.5-4-4.5z"/><path d="M6.5 13a1.5 1.5 0 0 0 3 0"/></svg>;
    case "stack":    return <svg {...props}><path d="m2 5 6-3 6 3-6 3-6-3z"/><path d="m2 8 6 3 6-3M2 11l6 3 6-3"/></svg>;
    case "bookmark": return <svg {...props}><path d="M4 2.5h8v11l-4-2.5-4 2.5v-11z"/></svg>;
    case "drop":     return <svg {...props}><path d="M8 2c2 3 4 5 4 7.5a4 4 0 1 1-8 0C4 7 6 5 8 2z"/></svg>;
    case "wheel":    return <svg {...props}><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/><path d="M8 2v4M8 10v4M2 8h4M10 8h4"/></svg>;
    case "grip":     return <svg {...props}><circle cx="6" cy="4" r="0.9"/><circle cx="10" cy="4" r="0.9"/><circle cx="6" cy="8" r="0.9"/><circle cx="10" cy="8" r="0.9"/><circle cx="6" cy="12" r="0.9"/><circle cx="10" cy="12" r="0.9"/></svg>;
    default:         return <svg {...props}><rect x="3" y="3" width="10" height="10" rx="2"/></svg>;
  }
};

window.Icon = Icon;
