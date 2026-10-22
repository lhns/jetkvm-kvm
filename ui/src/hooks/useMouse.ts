import { useCallback, useRef, useState } from "react";

import { useJsonRpc } from "./useJsonRpc";
import { useHidRpc } from "./useHidRpc";
import { useMouseStore, useSettingsStore } from "./stores";
import { splitInt8Delta } from "@/utils/mouseDelta";
import { hidFromNormalized, streamFromClient } from "@/utils/pointerMapping";

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

  // Track last absolute mouse position for resetMousePosition
  const lastAbsPos = useRef({ x: 0, y: 0 });

  // RPC hooks
  const { send } = useJsonRpc();
  const { reportAbsMouseEvent, reportRelMouseEvent, rpcHidReady } = useHidRpc();
  // Mouse-related

  const sendRelMouseMovement = useCallback(
    (x: number, y: number, buttons: number) => {
      if (mouseMode !== "relative") return;
      // if we ignore the event, double-click will not work
      // if (x === 0 && y === 0 && buttons === 0) return;
      const dx = calcDelta(x);
      const dy = calcDelta(y);
      // The report carries int8 deltas; a fast flick exceeds that and would be dropped whole.
      for (const [cx, cy] of splitInt8Delta(dx, dy)) {
        if (rpcHidReady) {
          reportRelMouseEvent(cx, cy, buttons);
        } else {
          // kept for backward compatibility
          send("relMouseReport", { dx: cx, dy: cy, buttons });
        }
      }
      setMouseMove({ x, y, buttons });
    },
    [send, reportRelMouseEvent, setMouseMove, mouseMode, rpcHidReady],
  );

  const getRelMouseMoveHandler = useCallback(
    () => (e: MouseEvent) => {
      if (mouseMode !== "relative") return;

      // Send mouse movement
      const { buttons } = e;
      sendRelMouseMovement(e.movementX, e.movementY, buttons);
    },
    [sendRelMouseMovement, mouseMode],
  );

  const sendAbsMouseMovement = useCallback(
    (x: number, y: number, buttons: number) => {
      if (mouseMode !== "absolute") return;
      if (rpcHidReady) {
        reportAbsMouseEvent(x, y, buttons);
      } else {
        // kept for backward compatibility
        send("absMouseReport", { x, y, buttons });
      }
      // We set that for the debug info bar
      setMousePosition(x, y);
      lastAbsPos.current = { x, y };
    },
    [send, reportAbsMouseEvent, setMousePosition, mouseMode, rpcHidReady],
  );

  const getAbsMouseMoveHandler = useCallback(
    ({ videoWidth, videoHeight }: AbsMouseMoveHandlerProps) =>
      (e: PointerEvent | MouseEvent) => {
        if (mouseMode !== "absolute") return;
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
        if (!p) return;

        sendAbsMouseMovement(hidFromNormalized(p.nx), hidFromNormalized(p.ny), e.buttons);
      },
    [mouseMode, sendAbsMouseMovement],
  );

  const getMouseWheelHandler = useCallback(
    () => (e: WheelEvent) => {
      if (scrollThrottling && blockWheelEvent) {
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
    [send, blockWheelEvent, scrollThrottling, invertScroll],
  );

  const resetMousePosition = useCallback(() => {
    sendAbsMouseMovement(lastAbsPos.current.x, lastAbsPos.current.y, 0);
  }, [sendAbsMouseMovement]);

  return {
    getRelMouseMoveHandler,
    getAbsMouseMoveHandler,
    getMouseWheelHandler,
    resetMousePosition,
  };
}
