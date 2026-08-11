import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { prefersReducedMotion } from '@/lib/motion';
import { loadTweaks, type Tweaks } from '@/lib/tweaks';

/** How long a burst of typing has to run before the chrome fades. Long
 * enough that a one-word correction never dims the toolbar, short enough
 * that a paragraph does. */
const FADE_AFTER_MS = 3000;
/** Where the caret is pinned. Not 50%: more of the page you have already
 * written stays above the line you are writing, which is what you read
 * back from. */
const TYPEWRITER_RATIO = 0.45;

/** Focus mode, in three parts, all driven by the one Tweaks setting.
 *
 *   1. **Dimming** — a decoration plugin (`focus-dim.ts`). A visual state
 *      rather than motion, so it stays on under reduced motion; only its
 *      transition is dropped.
 *   2. **Chrome fade** — the toolbar, strips and rails fade after a
 *      sustained burst of typing and come back on any mouse move or
 *      Escape. Better than a mode toggle because it costs no decisions.
 *   3. **Typewriter scrolling** — the caret is pinned partway down the
 *      canvas rather than allowed to walk to the bottom edge.
 *
 * Returns whether the chrome is currently faded, which the Writer's Room
 * stamps on its root so CSS can do the rest. */
export function useFocusMode(
  editor: Editor | null,
  canvasRef: RefObject<HTMLDivElement | null>
): { mode: Tweaks['focus']; typing: boolean } {
  const [mode, setMode] = useState<Tweaks['focus']>(() => loadTweaks().focus);
  const [typing, setTyping] = useState(false);
  const burstStart = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tweaks are stamped on <html>, and Settings is a different surface, so
  // observe the attribute rather than re-reading localStorage on a poll.
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setMode((root.getAttribute('data-focus') as Tweaks['focus']) || 'off');
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-focus'] });
    return () => observer.disconnect();
  }, []);

  // Publish the mode to the decoration plugin and force one rebuild, the
  // same way the Writer's Room refreshes mention highlights.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.storage.focusDim.mode = mode;
    editor.view.dispatch(editor.state.tr.setMeta('focus:refresh', true));
  }, [editor, mode]);

  useEffect(() => {
    if (mode === 'off') {
      setTyping(false);
      return;
    }
    const wake = () => {
      burstStart.current = null;
      setTyping(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        wake();
        return;
      }
      // Only real text entry starts a burst. Tabbing through the toolbar
      // must never dim the toolbar you are tabbing through.
      if (e.key.length !== 1 && e.key !== 'Enter' && e.key !== 'Backspace') return;
      if (!editor?.isFocused) return;
      if (burstStart.current == null) burstStart.current = Date.now();
      if (timer.current) clearTimeout(timer.current);
      const elapsed = Date.now() - burstStart.current;
      timer.current = setTimeout(() => setTyping(true), Math.max(0, FADE_AFTER_MS - elapsed));
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousemove', wake);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousemove', wake);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [editor, mode]);

  // Typewriter scrolling. The scroller is the canvas, not the window, so
  // this sets its `scrollTop` directly — `scrollIntoView` would also scroll
  // every ancestor, which on a phone drags the whole shell.
  useEffect(() => {
    if (!editor || editor.isDestroyed || mode === 'off') return;
    const pin = () => {
      const canvas = canvasRef.current;
      if (!canvas || !editor.isFocused) return;
      const caret = editor.view.coordsAtPos(editor.state.selection.head);
      const box = canvas.getBoundingClientRect();
      const target = canvas.scrollTop + (caret.top - box.top) - box.height * TYPEWRITER_RATIO;
      if (Math.abs(target - canvas.scrollTop) < 2) return;
      // A JS smooth scroll bypasses the CSS reduced-motion rules entirely,
      // so the preference is consulted here rather than left to the
      // stylesheet.
      canvas.scrollTo({
        top: Math.max(0, target),
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    };
    editor.on('transaction', pin);
    return () => {
      editor.off('transaction', pin);
    };
  }, [editor, canvasRef, mode]);

  return { mode, typing };
}
