import { create } from 'zustand';
import type { EntityType } from '@/domain/entity-types';

/** Four themes in two families. Studio is the default — a modern dark
 * studio, neutral ground and one vivid accent. The parchment/midnight
 * pair is the original warm literary look, kept because a stored choice
 * is a choice: an existing reader is never moved off it. */
export type Theme = 'studio-dark' | 'studio-light' | 'parchment-light' | 'midnight-ink';

export const ALL_THEMES: readonly Theme[] = [
  'studio-dark',
  'studio-light',
  'parchment-light',
  'midnight-ink',
] as const;

/** The toggle flips within a family rather than cycling all four, so the
 * one-key light/dark switch never changes the app's character. */
const THEME_COUNTERPART: Record<Theme, Theme> = {
  'studio-dark': 'studio-light',
  'studio-light': 'studio-dark',
  'parchment-light': 'midnight-ink',
  'midnight-ink': 'parchment-light',
};
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
    if (stored && (ALL_THEMES as readonly string[]).includes(stored)) return stored as Theme;
  } catch {
    /* private mode etc. */
  }
  return 'studio-dark';
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
    const next = THEME_COUNTERPART[get().theme];
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
