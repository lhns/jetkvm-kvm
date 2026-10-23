export type KeyboardMode = "page" | "fullscreen" | "detached";

export const MIN_KEY_HEIGHT = 24;
export const MAX_KEY_HEIGHT = 40;
/** Video height kept visible above the attached keyboard. */
export const MIN_VIDEO_HEIGHT = 48;
/** Below this width the control and arrow blocks go under the main block. */
export const STACK_BELOW_WIDTH = 560;
/** Never budget less than a header plus a bit of scrolling room. */
const MIN_BUDGET = 96;

export function isStacked(width: number): boolean {
  return width < STACK_BELOW_WIDTH;
}

/** Height the keyboard may take. `boxHeight` is the attached keyboard's grid; the others use the viewport. */
export function keyboardBudget({
  mode,
  boxHeight,
  viewportHeight,
}: {
  mode: KeyboardMode;
  boxHeight: number;
  viewportHeight: number;
}): number {
  const budget =
    mode === "page"
      ? Math.min(boxHeight - MIN_VIDEO_HEIGHT, viewportHeight * 0.6)
      : // The fullscreen keyboard overlays the video, so keep half of it visible.
        viewportHeight * (mode === "fullscreen" ? 0.5 : 0.6);
  return Math.max(MIN_BUDGET, budget);
}

/** Keeps a box of the given size inside the viewport; a box wider or taller than it sticks to the origin. */
export function clampPosition(
  position: { x: number; y: number },
  box: { width: number; height: number },
  viewport: { width: number; height: number },
): { x: number; y: number } {
  const clamp = (value: number, room: number) => Math.min(Math.max(0, room), Math.max(0, value));
  return {
    x: clamp(position.x, viewport.width - box.width),
    y: clamp(position.y, viewport.height - box.height),
  };
}

/**
 * Key height that makes the keyboard fill `budget`. Keyboard height is linear in key height (the
 * row gap is fixed), so one step from the measured height is exact. The result is whole pixels
 * rounded down, so it never overshoots the budget and does not oscillate.
 */
export function fitKeyHeight({
  budget,
  measuredHeight,
  keyHeight,
  rows,
  min = MIN_KEY_HEIGHT,
  max = MAX_KEY_HEIGHT,
}: {
  budget: number;
  measuredHeight: number;
  keyHeight: number;
  rows: number;
  min?: number;
  max?: number;
}): number {
  const wanted = Math.floor(keyHeight + (budget - measuredHeight) / rows);
  return Math.min(max, Math.max(min, wanted));
}
