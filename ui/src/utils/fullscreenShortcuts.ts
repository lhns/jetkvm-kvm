import type { KeySequence } from "@hooks/stores";
import type { MacroStep } from "@hooks/useKeyboard";

export interface TouchSummary {
  /** Most fingers down at once during the gesture. */
  maxFingers: number;
  /** Movement of the finger centroid from when the last finger landed to the end. */
  dx: number;
  dy: number;
  durationMs: number;
}

export type MultiTouchGesture = { type: "swipe"; direction: "left" | "right" } | { type: "menu" };

const SWIPE_MIN_DISTANCE = 60;
const TAP_MAX_MOVE = 24;
const TAP_MAX_MS = 500;

/** Three fingers swiping sideways, or four fingers tapping. Anything else is not ours. */
export function classifyMultiTouch(t: TouchSummary): MultiTouchGesture | null {
  if (t.maxFingers === 3) {
    const ax = Math.abs(t.dx);
    // Mostly horizontal, so a diagonal scroll-ish drag does not fire it.
    if (ax >= SWIPE_MIN_DISTANCE && ax > 2 * Math.abs(t.dy)) {
      return { type: "swipe", direction: t.dx < 0 ? "left" : "right" };
    }
    return null;
  }
  if (t.maxFingers === 4 && t.durationMs <= TAP_MAX_MS && Math.hypot(t.dx, t.dy) <= TAP_MAX_MOVE) {
    return { type: "menu" };
  }
  return null;
}

export const SWIPE_DEFAULT = "winShiftArrow";
export const SWIPE_OFF = "off";
const MACRO_PREFIX = "macro:";
export const macroSwipeValue = (id: string) => `${MACRO_PREFIX}${id}`;

/** What a swipe does: the built-in Win+Shift+Arrow, one of the user's macros, or nothing. */
export function resolveSwipeAction(
  setting: string,
  direction: "left" | "right",
  macros: KeySequence[],
): MacroStep[] | null {
  if (setting === SWIPE_DEFAULT) {
    return [
      {
        keys: [direction === "left" ? "ArrowLeft" : "ArrowRight"],
        modifiers: ["MetaLeft", "ShiftLeft"],
        delay: 100,
      },
    ];
  }
  if (setting.startsWith(MACRO_PREFIX)) {
    const id = setting.slice(MACRO_PREFIX.length);
    return macros.find(m => m.id === id)?.steps ?? null;
  }
  return null;
}

/**
 * Where the menu button can sit without covering the video: the black bar left/right
 * (pillarbox) or top/bottom (letterbox), as a point at the bar's centre. Null if no bar is
 * wide enough.
 */
export function blackBarSpot(
  elementWidth: number,
  elementHeight: number,
  offsetX: number,
  offsetY: number,
  button = 36,
): { x: number; y: number } | null {
  if (offsetX >= button) return { x: offsetX / 2, y: Math.min(elementHeight / 2, button) };
  if (offsetY >= button) return { x: Math.min(elementWidth / 2, button), y: offsetY / 2 };
  return null;
}
