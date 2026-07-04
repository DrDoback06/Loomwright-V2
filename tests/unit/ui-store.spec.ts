// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/ui';

describe('ui store', () => {
  it('toggles the theme and stamps it on <html> + localStorage', () => {
    const initial = useUiStore.getState().theme;
    useUiStore.getState().toggleTheme();
    const next = useUiStore.getState().theme;
    expect(next).not.toBe(initial);
    expect(document.documentElement.getAttribute('data-theme')).toBe(next);
    expect(localStorage.getItem('lw:theme')).toBe(next);
  });
});
