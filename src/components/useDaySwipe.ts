import { useEffect, useRef, type RefObject } from 'react';
import { swipeStep } from '../domain/gesture';

/**
 * Calls `onStep(+1 | -1)` when a quick sideways flick crosses `ref` (Today: next / previous day), then slides the
 * content in from that side. Touches that start in a text field or in an element marked `data-no-swipe` are
 * ignored, and so is press-and-hold, which belongs to dragging blocks (see `swipeStep`).
 */
export function useDaySwipe(ref: RefObject<HTMLElement | null>, onStep: (step: 1 | -1) => void) {
  const handler = useRef(onStep);
  handler.current = onStep;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; t: number; movedAt: number | null } | null = null;

    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (e.touches.length !== 1 || target.closest('input, textarea, select, [data-no-swipe]')) {
        start = null;
        return;
      }
      const p = e.touches[0]!;
      start = { x: p.clientX, y: p.clientY, t: e.timeStamp, movedAt: null };
    };
    const onMove = (e: TouchEvent) => {
      if (!start || start.movedAt !== null) return;
      const p = e.touches[0]!;
      if (Math.hypot(p.clientX - start.x, p.clientY - start.y) >= 10) start.movedAt = e.timeStamp;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const p = e.changedTouches[0]!;
      const step = swipeStep({
        dx: p.clientX - start.x,
        dy: p.clientY - start.y,
        ms: e.timeStamp - start.t,
        holdMs: (start.movedAt ?? e.timeStamp) - start.t,
        startX: start.x,
        width: window.innerWidth,
      });
      start = null;
      if (step === 0) return;
      handler.current(step);
      // Slide in from the side the new day comes from (skipped when the phone asks for less motion).
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.animate(
          [{ transform: `translateX(${step * 28}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
          { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
        );
      }
    };
    const cancel = () => (start = null);

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', cancel);
    };
  }, [ref]);
}
