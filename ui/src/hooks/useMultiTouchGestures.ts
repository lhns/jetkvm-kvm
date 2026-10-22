import { useEffect, useRef } from "react";

import { classifyMultiTouch, type MultiTouchGesture } from "@/utils/fullscreenShortcuts";

const centroid = (touches: TouchList) => {
  let x = 0;
  let y = 0;
  for (const t of Array.from(touches)) {
    x += t.clientX;
    y += t.clientY;
  }
  return { x: x / touches.length, y: y / touches.length };
};

interface Session {
  startTime: number;
  maxFingers: number;
  start: { x: number; y: number };
  last: { x: number; y: number };
}

/**
 * Reports three-finger swipes and four-finger taps on `element`. Touches that start inside
 * an element marked `data-fs-overlay` (menu, keyboard) are ignored.
 */
export function useMultiTouchGestures(
  element: HTMLElement | null,
  active: boolean,
  onGesture: (g: MultiTouchGesture) => void,
) {
  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;

  useEffect(() => {
    if (!element || !active) return;
    const abort = new AbortController();
    const { signal } = abort;

    let session: Session | null = null;
    let ignored = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        ignored = (e.target as Element | null)?.closest?.("[data-fs-overlay]") != null;
        session = null;
      }
      if (ignored) return;
      const c = centroid(e.touches);
      if (!session) {
        session = { startTime: e.timeStamp, maxFingers: e.touches.length, start: c, last: c };
      } else if (e.touches.length > session.maxFingers) {
        // Fingers land one after another: measure movement from the last landing.
        session.maxFingers = e.touches.length;
        session.start = c;
        session.last = c;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (session && e.touches.length === session.maxFingers) session.last = centroid(e.touches);
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length > 0 || !session) return;
      const s: Session = session;
      session = null;
      const gesture = classifyMultiTouch({
        maxFingers: s.maxFingers,
        dx: s.last.x - s.start.x,
        dy: s.last.y - s.start.y,
        durationMs: e.timeStamp - s.startTime,
      });
      if (gesture) onGestureRef.current(gesture);
    };
    const onCancel = () => {
      session = null;
    };

    element.addEventListener("touchstart", onStart, { signal, passive: true });
    element.addEventListener("touchmove", onMove, { signal, passive: true });
    element.addEventListener("touchend", onEnd, { signal, passive: true });
    element.addEventListener("touchcancel", onCancel, { signal, passive: true });
    return () => abort.abort();
  }, [element, active]);
}
