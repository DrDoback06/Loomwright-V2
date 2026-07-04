import { create } from 'zustand';
import type { EntityType } from '@/domain/entity-types';

export type Theme = 'parchment-light' | 'midnight-ink';

/** Routes that exist in the rebuilt app. Grows milestone by milestone —
 * a nav entry is only rendered once its surface genuinely works. */
export type RouteId =
  | 'home'
  | 'writers-room'
  | 'codex'
  | 'atlas'
  | 'tangle'
  | 'skill-trees'
  | 'review'
  | 'handoff'
  | 'settings'
  | 'trash';

interface UiState {
  theme: Theme;
  route: RouteId;
  /** Which entity type the 'codex' route shows. */
  codexType: EntityType;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setRoute: (route: RouteId) => void;
  setCodexType: (type: EntityType) => void;
}

const THEME_KEY = 'lw:theme';

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'parchment-light' || stored === 'midnight-ink') return stored;
  } catch {
    /* private mode etc. */
  }
  return 'parchment-light';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: initialTheme(),
  route: 'home',
  codexType: 'cast',
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'parchment-light' ? 'midnight-ink' : 'parchment-light';
    applyTheme(next);
    set({ theme: next });
  },
  setRoute: (route) => set({ route }),
  setCodexType: (type) => set({ codexType: type }),
}));
