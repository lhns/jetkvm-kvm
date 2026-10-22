// Browsers replay a tap as mouse events up to a few hundred ms later; ignore those.
const SYNTHETIC_MOUSE_WINDOW_MS = 800;
let lastTouchAt = -Infinity;

export const markTouch = () => {
  lastTouchAt = performance.now();
};

export const recentlyTouched = () => performance.now() - lastTouchAt < SYNTHETIC_MOUSE_WINDOW_MS;
