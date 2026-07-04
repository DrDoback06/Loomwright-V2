import { useCallback, useRef, useState } from 'react';

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

/** Shared pan/zoom/pinch machinery for every Loomwright canvas (atlas,
 * relationship map, skill trees, tangle). Pointer-events based so mouse,
 * pen, and touch all work; two pointers pinch-zoom.
 *
 * Returns handlers to spread on the canvas root plus helpers to convert
 * screen coordinates into canvas space. Dragging individual nodes is the
 * caller's job — call `claimPointer()` from a node's pointerdown to stop
 * the canvas from panning that gesture. */
export function useCanvas(initial: Partial<Viewport> = {}) {
  const [viewport, setViewport] = useState<Viewport>({
    x: initial.x ?? 0,
    y: initial.y ?? 0,
    scale: initial.scale ?? 1,
  });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const claimed = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const claimPointer = useCallback(() => {
    claimed.current = true;
  }, []);

  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = rootRef.current?.getBoundingClientRect();
      const ox = rect?.left ?? 0;
      const oy = rect?.top ?? 0;
      return {
        x: (clientX - ox - viewport.x) / viewport.scale,
        y: (clientY - oy - viewport.y) / viewport.scale,
      };
    },
    [viewport]
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: 0 };
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);

    if (claimed.current) return; // a node drag owns this gesture

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setViewport((v) => {
        const base = pinchStart.current!;
        if (!base.scale) base.scale = v.scale;
        const scale = Math.min(3, Math.max(0.25, (base.scale * dist) / base.dist));
        return { ...v, scale };
      });
      return;
    }
    if (pointers.current.size === 1) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      setViewport((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) claimed.current = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const px = e.clientX - (rect?.left ?? 0);
    const py = e.clientY - (rect?.top ?? 0);
    setViewport((v) => {
      const scale = Math.min(3, Math.max(0.25, v.scale * (e.deltaY < 0 ? 1.1 : 0.9)));
      // Zoom towards the cursor.
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }, []);

  return {
    viewport,
    setViewport,
    rootRef,
    toCanvas,
    claimPointer,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel },
  };
}
