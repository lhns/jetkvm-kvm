import { useCallback, useRef, useState } from "react";

import { useJsonRpc } from "./useJsonRpc";
import { useHidRpc } from "./useHidRpc";
import { useMouseStore, useSettingsStore } from "./stores";
import { splitInt8Delta } from "@/utils/mouseDelta";
import { recentlyTouched } from "@/utils/touchRecency";
import { hidFromNormalized, isReleaseOnly, streamFromClient } from "@/utils/pointerMapping";

const isTouchEvent = (e: MouseEvent | PointerEvent) =>
  ("pointerType" in e && e.pointerType === "touch") || recentlyTouched();

const calcDelta = (pos: number) => (Math.abs(pos) < 10 ? pos * 2 : pos);

export interface AbsMouseMoveHandlerProps {
  videoWidth: number;
  videoHeight: number;
}

export default function useMouse() {
  // states
  const { setMousePosition, setMouseMove } = useMouseStore();
  const [blockWheelEvent, setBlockWheelEvent] = useState(false);

  const { mouseMode, scrollThrottling, invertScroll } = useSettingsStore();

  // Last absolute report: resetMousePosition resends it, and a release outside the picture
  // goes out at this position.
  const lastAbsPos = useRef({ x: 0, y: 0, buttons: 0 });
  // A button went down outside the picture: the drag it starts sends nothing, even once it
  // moves inside, until every button is up.
  const pressedOutside = useRef(false);

  // RPC hooks
  const { send } = useJsonRpc();
  const { reportAbsMouseEvent, reportRelMouseEvent, rpcHidReady } = useHidRpc();
  // Mouse-related

  // Relative report, whatever the mouse mode (touch input uses it too).
  const reportRel = useCallback(
    (dx: number, dy: number, buttons: number) => {
      // The report carries int8 deltas; a fast flick exceeds that and would be dropped whole.
      for (const [cx, cy] of splitInt8Delta(dx, dy)) {
        if (rpcHidReady) {
          reportRelMouseEvent(cx, cy, buttons);
        } else {
          // kept for backward compatibility
          send("relMouseReport", { dx: cx, dy: cy, buttons });
        }
      }
    },
    [send, reportRelMouseEvent, rpcHidReady],
  );

  const sendRelMouseMovement = useCallback(
    (x: number, y: number, buttons: number, locked = false) => {
      if (mouseMode !== "relative") return;
      // if we ignore the event, double-click will not work
      // if (x === 0 && y === 0 && buttons === 0) return;
      // Pointer lock delivers exact device deltas; the boost is only for slow, unlocked moves.
      reportRel(locked ? x : calcDelta(x), locked ? y : calcDelta(y), buttons);
      setMouseMove({ x, y, buttons });
    },
    [reportRel, setMouseMove, mouseMode],
  );

  const getRelMouseMoveHandler = useCallback(
    () => (e: MouseEvent) => {
      if (mouseMode !== "relative") return;
      // A finger is useTouchInput's; browsers also replay a tap as mouse events afterwards.
      if (isTouchEvent(e)) return;

      // Send mouse movement
      const { buttons } = e;
      sendRelMouseMovement(e.movementX, e.movementY, buttons, !!document.pointerLockElement);
    },
    [sendRelMouseMovement, mouseMode],
  );

  // Absolute report, whatever the mouse mode (touch input uses it too).
  const reportAbs = useCallback(
    (x: number, y: number, buttons: number) => {
      if (rpcHidReady) {
        reportAbsMouseEvent(x, y, buttons);
      } else {
        // kept for backward compatibility
        send("absMouseReport", { x, y, buttons });
      }
      // We set that for the debug info bar
      setMousePosition(x, y);
      lastAbsPos.current = { x, y, buttons };
    },
    [send, reportAbsMouseEvent, setMousePosition, rpcHidReady],
  );

  const sendAbsMouseMovement = useCallback(
    (x: number, y: number, buttons: number) => {
      if (mouseMode !== "absolute") return;
      reportAbs(x, y, buttons);
    },
    [reportAbs, mouseMode],
  );

  const getAbsMouseMoveHandler = useCallback(
    ({ videoWidth, videoHeight }: AbsMouseMoveHandlerProps) =>
      (e: PointerEvent | MouseEvent) => {
        if (mouseMode !== "absolute") return;
        if (isTouchEvent(e)) return; // useTouchInput owns touch
        // A second finger must not fight over the single absolute pointer.
        if ("isPrimary" in e && !e.isPrimary) return;

        // clientX/Y against the element's rect: offsetX/Y is unreliable for touch input.
        const target = e.currentTarget as HTMLElement | null;
        if (!target) return;
        const p = streamFromClient(
          e.clientX,
          e.clientY,
          target.getBoundingClientRect(),
          videoWidth,
          videoHeight,
        );
        if (!p) {
          // Outside the picture: nothing, bar the release of a button pressed inside.
          const last = lastAbsPos.current;
          if (e.buttons & ~last.buttons) pressedOutside.current = true;
          if (isReleaseOnly(e.buttons, last.buttons)) {
            sendAbsMouseMovement(last.x, last.y, e.buttons);
          }
          return;
        }
        if (pressedOutside.current) {
          if (e.buttons) return;
          pressedOutside.current = false;
        }

        sendAbsMouseMovement(hidFromNormalized(p.nx), hidFromNormalized(p.ny), e.buttons);
      },
    [mouseMode, sendAbsMouseMovement],
  );

  const getMouseWheelHandler = useCallback(
    () => (e: WheelEvent) => {
      if (scrollThrottling && blockWheelEvent) {
        return;
      }

      // Absolute mode: the bars around the picture are not the remote screen.
      const video = e.currentTarget as HTMLVideoElement | null;
      if (
        mouseMode === "absolute" &&
        video &&
        !streamFromClient(
          e.clientX,
          e.clientY,
          video.getBoundingClientRect(),
          video.videoWidth,
          video.videoHeight,
        )
      ) {
        return;
      }

      const clampWheel = (delta: number): number => {
        const isAccel = Math.abs(delta) >= 100;
        const scrollValue = isAccel ? delta / 100 : Math.sign(delta);
        return Math.max(-127, Math.min(127, scrollValue));
      };

      // Negate Y: browser deltaY positive = scroll down, HID Wheel positive = scroll up
      const wheelY = (invertScroll ? 1 : -1) * clampWheel(e.deltaY);
      // X conventions already match (positive = right), but macOS Natural Scrolling
      // inverts both axes at OS level, so we negate X to counteract when inverted
      const wheelX = (invertScroll ? -1 : 1) * clampWheel(e.deltaX);

      if (wheelY === 0 && wheelX === 0) return;

      send("wheelReport", { wheelY, wheelX });

      // Apply blocking delay based of throttling settings
      if (scrollThrottling && !blockWheelEvent) {
        setBlockWheelEvent(true);
        setTimeout(() => setBlockWheelEvent(false), scrollThrottling);
      }
    },
    [send, blockWheelEvent, scrollThrottling, invertScroll, mouseMode],
  );

  // Wheel steps in browser convention (positive y scrolls down), as the wheel handler gets them.
  const sendScrollSteps = useCallback(
    (x: number, y: number) => {
      const clamp = (n: number) => Math.max(-127, Math.min(127, n));
      const wheelY = (invertScroll ? 1 : -1) * clamp(y);
      const wheelX = (invertScroll ? -1 : 1) * clamp(x);
      if (wheelY === 0 && wheelX === 0) return;
      send("wheelReport", { wheelY, wheelX });
    },
    [send, invertScroll],
  );

  const resetMousePosition = useCallback(() => {
    sendAbsMouseMovement(lastAbsPos.current.x, lastAbsPos.current.y, 0);
  }, [sendAbsMouseMovement]);

  return {
    getRelMouseMoveHandler,
    getAbsMouseMoveHandler,
    getMouseWheelHandler,
    resetMousePosition,
    reportTouchAbs: reportAbs,
    reportTouchRel: reportRel,
    sendScrollSteps,
  };
}
