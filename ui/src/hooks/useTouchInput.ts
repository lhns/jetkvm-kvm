import { useEffect, useRef } from "react";

import { useSettingsStore, useVideoStore } from "@hooks/stores";
import type useMouse from "@hooks/useMouse";
import { hidFromNormalized, streamFromClient, videoDisplayArea } from "@/utils/pointerMapping";
import {
  createCarry,
  type GestureAction,
  type GestureConfig,
  type GestureEvent,
  initialGestureState,
  reduceGesture,
  toStreamDelta,
} from "@/utils/touchGestures";
import { markTouch } from "@/utils/touchRecency";

type Mouse = Pick<
  ReturnType<typeof useMouse>,
  "reportTouchAbs" | "reportTouchRel" | "sendScrollSteps"
>;

const BUTTON_BIT = { left: 1, right: 2, middle: 4 } as const;

/**
 * Finger input on the video. Touch pointers go through the gesture reducer; mouse and pen
 * stay with the handlers in WebRTCVideo. Direct touch sends absolute reports and Trackpad
 * relative ones, whatever the mouse mode is.
 */
export function useTouchInput(mouse: Mouse) {
  const { videoElement, width: streamWidth, height: streamHeight } = useVideoStore();
  const touchInput = useSettingsStore(s => s.touchInput);

  // Everything the long-lived listeners read, refreshed on each render so a settings change
  // never re-attaches them (that would drop a gesture in progress).
  const live = useRef({ mouse, touchInput, streamWidth, streamHeight });
  live.current = { mouse, touchInput, streamWidth, streamHeight };

  useEffect(() => {
    if (!videoElement) return;
    const video: HTMLVideoElement = videoElement;
    const abort = new AbortController();
    const { signal } = abort;

    let state = initialGestureState();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let buttons = 0;
    // Direct touch: where the pointer is, as fractions of the remote screen.
    let cursor: { nx: number; ny: number } | null = null;
    const carry = createCarry();

    const config = (): GestureConfig => ({ mode: live.current.touchInput });

    const sendPosition = () => {
      const { mouse: m, touchInput: mode } = live.current;
      if (mode === "trackpad") {
        m.reportTouchRel(0, 0, buttons);
      } else if (cursor) {
        m.reportTouchAbs(hidFromNormalized(cursor.nx), hidFromNormalized(cursor.ny), buttons);
      }
    };

    const perform = (a: GestureAction) => {
      const { mouse: m, streamWidth: sw, streamHeight: sh } = live.current;
      const rect = video.getBoundingClientRect();
      switch (a.kind) {
        case "moveTo": {
          const p = streamFromClient(a.x, a.y, rect, sw, sh);
          if (!p) return;
          cursor = p;
          sendPosition();
          return;
        }
        case "move": {
          // 1:1 to the displayed video; the host applies its own pointer curve.
          const area = videoDisplayArea(rect, sw, sh);
          const d = toStreamDelta(
            a.dx,
            a.dy,
            1,
            { width: sw, height: sh },
            { width: area.width, height: area.height },
          );
          const whole = carry.take(d.dx, d.dy);
          if (whole.dx || whole.dy) m.reportTouchRel(whole.dx, whole.dy, buttons);
          return;
        }
        case "button":
          buttons = a.down ? buttons | BUTTON_BIT[a.button] : buttons & ~BUTTON_BIT[a.button];
          sendPosition();
          return;
        case "click":
          buttons |= BUTTON_BIT[a.button];
          sendPosition();
          buttons &= ~BUTTON_BIT[a.button];
          sendPosition();
          return;
        case "scroll":
          m.sendScrollSteps(a.x, a.y);
          return;
        case "haptic":
          navigator.vibrate?.(15);
          return;
      }
    };

    const dispatch = (ev: GestureEvent) => {
      const r = reduceGesture(state, ev, config());
      state = r.state;
      r.actions.forEach(perform);
      clearTimeout(timer);
      if (r.deadline !== null) {
        timer = setTimeout(
          () => dispatch({ type: "tick", t: performance.now() }),
          Math.max(0, r.deadline - performance.now()),
        );
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      e.preventDefault(); // no compatibility mouse events, no focus change
      markTouch();
      try {
        video.setPointerCapture(e.pointerId);
      } catch {
        // best effort
      }
      dispatch({ type: "down", id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      markTouch();
      dispatch({ type: "move", id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() });
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      markTouch();
      dispatch({ type: "up", id: e.pointerId, t: performance.now() });
    };
    const release = () => {
      dispatch({ type: "cancel", t: performance.now() });
      if (buttons) {
        buttons = 0;
        sendPosition();
      }
    };
    const onCancel = (e: PointerEvent) => {
      if (e.pointerType === "touch") release();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") release();
    };

    video.addEventListener("pointerdown", onDown, { signal });
    video.addEventListener("pointermove", onMove, { signal });
    video.addEventListener("pointerup", onUp, { signal });
    video.addEventListener("pointercancel", onCancel, { signal });
    window.addEventListener("blur", release, { signal });
    document.addEventListener("visibilitychange", onHidden, { signal });

    return () => {
      abort.abort();
      clearTimeout(timer);
      release(); // never leave a button held on the remote
    };
  }, [videoElement]);
}
