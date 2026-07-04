import { useUiStore } from '@/stores/ui';
import icon from '/icons/loomwright.svg';

export function TopBar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const dark = theme === 'midnight-ink';

  return (
    <header className="lw-topbar">
      <div className="lw-brand">
        <img className="lw-brand__seal" src={icon} alt="" />
        <span className="lw-brand__name">Loomwright</span>
        <span className="lw-brand__tag">Shape the book. Track the world.</span>
      </div>
      <div className="lw-topbar__spacer" />
      <button
        type="button"
        className="lw-iconbtn"
        onClick={toggleTheme}
        aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {dark ? '☀' : '☾'}
      </button>
    </header>
  );
}
