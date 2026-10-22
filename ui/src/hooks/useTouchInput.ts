import { useEffect, useRef, useState } from "react";

import { useMouseStore, useSettingsStore, useVideoStore } from "@hooks/stores";
import type useMouse from "@hooks/useMouse";
import {
  hidFromNormalized,
  normalizedFromHid,
  streamFromClient,
  videoDisplayArea,
} from "@/utils/pointerMapping";
import {
  createCarry,
  DEFAULT_GESTURE_CONFIG,
  type GestureAction,
  type GestureConfig,
  type GestureEvent,
  gainFor,
  initialGestureState,
  moveVirtualCursor,
  reduceGesture,
  speedOf,
  toStreamDelta,
} from "@/utils/touchGestures";
import { markTouch } from "@/utils/touchRecency";

type Mouse = Pick<
  ReturnType<typeof useMouse>,
  "reportTouchAbs" | "reportTouchRel" | "sendScrollSteps"
>;

const BUTTON_BIT = { left: 1, right: 2, middle: 4 } as const;
const CURSOR_LINGER_MS = 1000;

/**
 * Finger input on the video. Touch pointers go through the gesture reducer; mouse and pen
 * stay with the handlers in WebRTCVideo. Returns whether the touch cursor marker is shown
 * (absolute mode, touchpad style, during a touch and shortly after).
 */
export function useTouchInput(mouse: Mouse) {
  const { videoElement, width: streamWidth, height: streamHeight } = useVideoStore();
  const settings = useSettingsStore();
  const [cursorVisible, setCursorVisible] = useState(false);

  // Everything the long-lived listeners read, refreshed on each render so a settings change
  // never re-attaches them (that would drop a gesture in progress).
  const live = useRef({ mouse, settings, streamWidth, streamHeight });
  live.current = { mouse, settings, streamWidth, streamHeight };

  useEffect(() => {
    if (!videoElement) return;
    const video: HTMLVideoElement = videoElement;
    const abort = new AbortController();
    const { signal } = abort;

    let state = initialGestureState();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let buttons = 0;
    let cursor: { nx: number; ny: number } | null = null;
    let synced = false;
    const carry = createCarry();

    const config = (): GestureConfig => {
      const s = live.current.settings;
      const touchpad = s.mouseMode === "relative" || s.touchStyle === "touchpad";
      return {
        ...DEFAULT_GESTURE_CONFIG,
        mode: touchpad ? "touchpad" : "direct",
        tapDelay: s.touchTapDelay,
        longPress: s.touchLongPress,
        tapDrag: s.touchTapDrag,
      };
    };

    const showCursor = (linger: boolean) => {
      clearTimeout(hideTimer);
      setCursorVisible(true);
      if (linger) hideTimer = setTimeout(() => setCursorVisible(false), CURSOR_LINGER_MS);
    };

    // The touchpad cursor continues from wherever the mouse last was.
    const ensureCursor = () => {
      if (!cursor) {
        const { mouseX, mouseY } = useMouseStore.getState();
        cursor =
          mouseX === 0 && mouseY === 0
            ? { nx: 0.5, ny: 0.5 }
            : { nx: normalizedFromHid(mouseX), ny: normalizedFromHid(mouseY) };
      }
      return cursor;
    };

    const sendPosition = () => {
      const { mouse: m, settings: s } = live.current;
      if (s.mouseMode === "relative") {
        m.reportTouchRel(0, 0, buttons);
      } else {
        const c = ensureCursor();
        m.reportTouchAbs(hidFromNormalized(c.nx), hidFromNormalized(c.ny), buttons);
      }
    };

    const perform = (a: GestureAction) => {
      const { mouse: m, settings: s, streamWidth: sw, streamHeight: sh } = live.current;
      const rect = video.getBoundingClientRect();
      const area = videoDisplayArea(rect, sw, sh);
      switch (a.kind) {
        case "moveTo": {
          const p = streamFromClient(a.x, a.y, rect, sw, sh);
          if (!p) return;
          cursor = p;
          sendPosition();
          return;
        }
        case "move": {
          const gain = gainFor(speedOf(a.dx, a.dy, a.dt), s.touchSensitivity);
          if (s.mouseMode === "relative") {
            const d = toStreamDelta(
              a.dx,
              a.dy,
              gain,
              { width: sw, height: sh },
              { width: area.width, height: area.height },
            );
            const whole = carry.take(d.dx, d.dy);
            if (whole.dx || whole.dy) m.reportTouchRel(whole.dx, whole.dy, buttons);
          } else {
            cursor = moveVirtualCursor(ensureCursor(), a.dx, a.dy, gain, area);
            sendPosition();
          }
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

    // First touch after a mouse or reload: put the remote cursor where the virtual one is.
    const resync = () => {
      const s = live.current.settings;
      if (synced || s.mouseMode === "relative" || s.touchStyle !== "touchpad") return;
      synced = true;
      sendPosition();
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
      if (live.current.settings.mouseMode === "absolute" && config().mode === "touchpad") {
        showCursor(false);
      }
      resync();
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
      showCursor(true);
    };
    const release = () => {
      dispatch({ type: "cancel", t: performance.now() });
      if (buttons) {
        buttons = 0;
        sendPosition();
      }
      showCursor(true);
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
      clearTimeout(hideTimer);
      // Never leave a button held on the remote.
      dispatch({ type: "cancel", t: performance.now() });
      if (buttons) {
        buttons = 0;
        sendPosition();
      }
    };
  }, [videoElement]);

  const markerEnabled = settings.mouseMode === "absolute" && settings.touchStyle === "touchpad";
  return { cursorVisible: cursorVisible && markerEnabled };
}
