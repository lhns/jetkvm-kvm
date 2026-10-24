export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}

/**
 * Keeps a detached keyboard on screen so its header (Attach/Hide) stays reachable. One larger
 * than the viewport sticks to the top-left corner instead of going negative.
 */
export function clampToViewport(position: Point, element: Size, viewport: Size): Point {
  const clamp = (value: number, room: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(value, room)) : 0;
  return {
    x: clamp(position.x, viewport.width - element.width),
    y: clamp(position.y, viewport.height - element.height),
  };
}
