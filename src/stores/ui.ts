import { create } from 'zustand';
import type { EntityType } from '@/domain/entity-types';

export type Theme = 'parchment-light' | 'midnight-ink';
export type PalettePurpose = 'search' | 'merge-target';

/** Routes that exist in the rebuilt app. Grows milestone by milestone —
 * a nav entry is only rendered once its surface genuinely works. */
export type RouteId =
  | 'home'
  | 'today'
  | 'writers-room'
  | 'codex'
  | 'atlas'
  | 'tangle'
  | 'skill-trees'
  | 'review'
  | 'handoff'
  | 'settings'
  | 'trash'
  | 'random-tables'
  | 'speed-reader'
  | 'templates';

interface UiState {
  theme: Theme;
  route: RouteId;
  /** Which entity type the 'codex' route shows. */
  codexType: EntityType;
  /** Command palette (Ctrl/Cmd+K) visibility. */
  paletteOpen: boolean;
  palettePurpose: PalettePurpose;
  leftRailExpanded: boolean;
  rightDockExpanded: boolean;
  /** Onboarding interview wizard visibility. */
  onboardingOpen: boolean;
  /** Per-surface help dialog visibility. */
  helpOpen: boolean;
  /** Consume-once request for the Writer's Room to open a specific
   * chapter (set by the palette / Today before routing there). */
  pendingChapterId: string | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setRoute: (route: RouteId) => void;
  setCodexType: (type: EntityType) => void;
  setPaletteOpen: (open: boolean) => void;
  setPalettePurpose: (purpose: PalettePurpose) => void;
  toggleLeftRail: () => void;
  toggleRightDock: () => void;
  setOnboardingOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  requestChapter: (chapterId: string) => void;
  consumePendingChapter: () => string | null;
}

const THEME_KEY = 'lw:theme';
const LEFT_RAIL_KEY = 'lw:left-rail-expanded';
const RIGHT_DOCK_KEY = 'lw:right-dock-expanded';

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'parchment-light' || stored === 'midnight-ink') return stored;
  } catch {
    /* private mode etc. */
  }
  return 'parchment-light';
}


function storedBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    if (value === 'true') return true;
    if (value === 'false') return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

function storeBoolean(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
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
  paletteOpen: false,
  palettePurpose: 'search',
  leftRailExpanded: storedBoolean(LEFT_RAIL_KEY, true),
  rightDockExpanded: storedBoolean(RIGHT_DOCK_KEY, false),
  onboardingOpen: false,
  helpOpen: false,
  pendingChapterId: null,
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setPalettePurpose: (palettePurpose) => set({ palettePurpose }),
  toggleLeftRail: () =>
    set((state) => {
      const leftRailExpanded = !state.leftRailExpanded;
      storeBoolean(LEFT_RAIL_KEY, leftRailExpanded);
      return { leftRailExpanded };
    }),
  toggleRightDock: () =>
    set((state) => {
      const rightDockExpanded = !state.rightDockExpanded;
      storeBoolean(RIGHT_DOCK_KEY, rightDockExpanded);
      return { rightDockExpanded };
    }),
  setOnboardingOpen: (open) => set({ onboardingOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  requestChapter: (chapterId) => set({ pendingChapterId: chapterId }),
  consumePendingChapter: () => {
    const id = get().pendingChapterId;
    if (id) set({ pendingChapterId: null });
    return id;
  },
}));
