// Touch gestures as a pure reducer: events and a clock in, mouse actions and the next
// deadline out. useTouchInput feeds it pointer events and timers and performs the actions.
//
// Trackpad (relative reports): one finger moves, a tap clicks after `tapDelay`, double-tap
// and hold then drag, two fingers scroll or right-click, three fingers middle-click, a still
// long press right-clicks on release.
// Direct touch (absolute reports): touching puts the pointer under the finger, moving presses
// and drags, a second tap close to the first lands on the same point (a double click).

/** Fixed timings (ms) and thresholds (CSS px). */
export const TOUCH = {
  /** A tap lifts before this; still this long is press-and-hold (haptic, right click on release). */
  holdMs: 550,
  /** Movement below this still counts as a tap or a hold. */
  slop: 10,
  /** Direct: a touch landing within this of the previous tap's lift... */
  doubleTapMs: 500,
  /** ...and within this of its point lands on that point. */
  doubleTapDist: 16,
  /** Direct: a drag starting this soon after landing waits, so a second finger can still make it a scroll. */
  graceMs: 100,
  /** Trackpad: a tap's click is held back this long, so a second tap can still become a drag. */
  tapDelay: 180,
  /** Trackpad: second touch held still this long presses and holds. */
  holdDelay: 300,
  /** CSS px of two-finger travel per wheel step. */
  scrollStep: 24,
  /** Two or three fingers lifting within this are a tap. */
  multiTapMax: 400,
} as const;

export interface GestureConfig {
  mode: "direct" | "trackpad";
}

export type Button = "left" | "right" | "middle";

export type GestureEvent =
  | { type: "down"; id: number; x: number; y: number; t: number }
  | { type: "move"; id: number; x: number; y: number; t: number }
  | { type: "up"; id: number; t: number }
  | { type: "cancel"; t: number }
  | { type: "tick"; t: number };

export type GestureAction =
  /** Trackpad: relative movement in CSS px. */
  | { kind: "move"; dx: number; dy: number }
  /** Direct: put the pointer on this client point. */
  | { kind: "moveTo"; x: number; y: number }
  | { kind: "button"; button: Button; down: boolean }
  | { kind: "click"; button: Button }
  /** Wheel steps in browser convention: positive y scrolls down, positive x right. */
  | { kind: "scroll"; x: number; y: number }
  | { kind: "haptic" };

interface Finger {
  id: number;
  sx: number;
  sy: number;
  x: number;
  y: number;
}

type Phase = "idle" | "one" | "tap2" | "drag" | "two" | "three" | "many" | "done";

export interface GestureState {
  phase: Phase;
  fingers: Finger[];
  /** Trackpad: a tap whose click is still held back until this time. */
  pendingClickAt: number | null;
  /** Direct: a drag that started inside the grace period presses at this time. */
  graceAt: number | null;
  /** Direct: where the gesture's pointer sits (the landing point, or the snapped one). */
  ax: number;
  ay: number;
  /** Direct: pointer point and lift time of the last left-click tap, for the double-tap snap. */
  lastTap: { x: number; y: number; t: number } | null;
  /** Landing time of the gesture's first finger. */
  t0: number;
  /** Time the current two/three-finger phase began. */
  tMulti: number;
  moved: boolean;
  longArmed: boolean;
  /** Left button held by a drag. */
  pressed: boolean;
  primaryId: number;
  lastX: number;
  lastY: number;
  /** Two fingers: centroid at the start and scroll remainder. */
  cx0: number;
  cy0: number;
  cxLast: number;
  cyLast: number;
  accX: number;
  accY: number;
  scrolling: boolean;
  /** Moves seen during a multi-finger phase (suppresses the tap). */
  multiMoved: boolean;
}

export const initialGestureState = (): GestureState => ({
  phase: "idle",
  fingers: [],
  pendingClickAt: null,
  graceAt: null,
  ax: 0,
  ay: 0,
  lastTap: null,
  t0: 0,
  tMulti: 0,
  moved: false,
  longArmed: false,
  pressed: false,
  primaryId: -1,
  lastX: 0,
  lastY: 0,
  cx0: 0,
  cy0: 0,
  cxLast: 0,
  cyLast: 0,
  accX: 0,
  accY: 0,
  scrolling: false,
  multiMoved: false,
});

export interface Reduced {
  state: GestureState;
  actions: GestureAction[];
  /** When to send a `tick` next, or null for no timer. */
  deadline: number | null;
}

const centroid = (fs: Finger[]) => ({
  x: fs.reduce((a, f) => a + f.x, 0) / fs.length,
  y: fs.reduce((a, f) => a + f.y, 0) / fs.length,
});

function deadlineOf(s: GestureState): number | null {
  const ds: number[] = [];
  if (s.pendingClickAt !== null) ds.push(s.pendingClickAt);
  if (s.graceAt !== null) ds.push(s.graceAt);
  if (s.phase === "one" && !s.moved && !s.longArmed) ds.push(s.t0 + TOUCH.holdMs);
  if (s.phase === "tap2") ds.push(s.t0 + TOUCH.holdDelay);
  return ds.length ? Math.min(...ds) : null;
}

export function reduceGesture(prev: GestureState, ev: GestureEvent, cfg: GestureConfig): Reduced {
  const s: GestureState = { ...prev, fingers: prev.fingers.map(f => ({ ...f })) };
  const out: GestureAction[] = [];
  const direct = cfg.mode === "direct";

  const finish = (): Reduced => ({ state: s, actions: out, deadline: deadlineOf(s) });

  const press = () => {
    s.pressed = true;
    out.push({ kind: "button", button: "left", down: true });
  };
  const release = () => {
    if (s.pressed) out.push({ kind: "button", button: "left", down: false });
    s.pressed = false;
  };
  /** Direct: press at the gesture's anchor, then follow the finger to where it is now. */
  const startDrag = (f: Finger) => {
    s.graceAt = null;
    s.phase = "drag";
    out.push({ kind: "moveTo", x: s.ax, y: s.ay });
    press();
    out.push({ kind: "moveTo", x: f.x, y: f.y });
  };

  if (ev.type === "cancel") {
    release();
    return {
      state: initialGestureState(),
      actions: out,
      deadline: null,
    };
  }

  if (ev.type === "tick") {
    if (s.pendingClickAt !== null && ev.t >= s.pendingClickAt) {
      out.push({ kind: "click", button: "left" });
      s.pendingClickAt = null;
    }
    if (s.graceAt !== null && ev.t >= s.graceAt) startDrag(s.fingers[0]);
    if (s.phase === "one" && !s.moved && !s.longArmed && ev.t - s.t0 >= TOUCH.holdMs) {
      s.longArmed = true;
      out.push({ kind: "haptic" });
    }
    if (s.phase === "tap2" && ev.t - s.t0 >= TOUCH.holdDelay) {
      // Touch held still on the second tap: press and hold.
      s.phase = "drag";
      press();
    }
    return finish();
  }

  if (ev.type === "down") {
    s.fingers.push({ id: ev.id, sx: ev.x, sy: ev.y, x: ev.x, y: ev.y });
    const n = s.fingers.length;
    if (n === 1) {
      s.t0 = ev.t;
      s.moved = false;
      s.longArmed = false;
      s.multiMoved = false;
      s.primaryId = ev.id;
      s.lastX = ev.x;
      s.lastY = ev.y;
      if (direct) {
        // A second tap close to the first lands on the same point, so the host sees a
        // double click. The finger's own landing point still decides tap versus drag.
        const tap = s.lastTap;
        const snap =
          tap !== null &&
          ev.t - tap.t <= TOUCH.doubleTapMs &&
          Math.hypot(ev.x - tap.x, ev.y - tap.y) <= TOUCH.doubleTapDist;
        s.ax = snap ? tap.x : ev.x;
        s.ay = snap ? tap.y : ev.y;
        s.lastTap = null;
        out.push({ kind: "moveTo", x: s.ax, y: s.ay });
        s.phase = "one";
      } else if (s.pendingClickAt !== null) {
        // Second tap of a double-tap: the held-back click becomes a double-click, a drag or
        // a hold, decided by what this touch does.
        s.pendingClickAt = null;
        s.phase = "tap2";
      } else {
        s.phase = "one";
      }
    } else if (s.phase === "drag") {
      // A drag keeps its finger; extra ones are ignored.
    } else if (n === 2 && (s.phase === "one" || s.phase === "tap2")) {
      if (s.phase === "tap2") out.push({ kind: "click", button: "left" });
      s.graceAt = null; // a drag that was waiting becomes a scroll
      s.lastTap = null;
      s.phase = "two";
      s.tMulti = ev.t;
      s.multiMoved = false;
      s.scrolling = false;
      const c = centroid(s.fingers);
      s.cx0 = s.cxLast = c.x;
      s.cy0 = s.cyLast = c.y;
      s.accX = s.accY = 0;
    } else if (n === 3 && s.phase === "two") {
      s.phase = "three";
      s.tMulti = ev.t;
      s.multiMoved = false;
    } else if (n >= 4 || s.phase === "three") {
      s.phase = "many";
    }
    return finish();
  }

  if (ev.type === "move") {
    const f = s.fingers.find(x => x.id === ev.id);
    if (!f) return finish();
    f.x = ev.x;
    f.y = ev.y;

    if (s.phase === "one" && f.id === s.primaryId) {
      if (!s.moved && Math.hypot(f.x - f.sx, f.y - f.sy) > TOUCH.slop) {
        s.moved = true;
        s.longArmed = false;
        s.lastTap = null;
        if (!direct) out.push({ kind: "move", dx: f.x - f.sx, dy: f.y - f.sy });
        else if (ev.t - s.t0 < TOUCH.graceMs) s.graceAt = s.t0 + TOUCH.graceMs;
        else startDrag(f);
        s.lastX = f.x;
        s.lastY = f.y;
      } else if (s.moved && !direct) {
        out.push({ kind: "move", dx: f.x - s.lastX, dy: f.y - s.lastY });
        s.lastX = f.x;
        s.lastY = f.y;
      }
    } else if (s.phase === "tap2" && f.id === s.primaryId) {
      if (Math.hypot(f.x - f.sx, f.y - f.sy) > TOUCH.slop) {
        // Tap, then touch and move: drag. No click went out first, so a title bar drag does
        // not also double-click.
        s.phase = "drag";
        press();
        out.push({ kind: "move", dx: f.x - f.sx, dy: f.y - f.sy });
        s.lastX = f.x;
        s.lastY = f.y;
      }
    } else if (s.phase === "drag" && f.id === s.primaryId) {
      if (direct) {
        out.push({ kind: "moveTo", x: f.x, y: f.y });
      } else {
        out.push({ kind: "move", dx: f.x - s.lastX, dy: f.y - s.lastY });
      }
      s.lastX = f.x;
      s.lastY = f.y;
    } else if (s.phase === "two") {
      const c = centroid(s.fingers.slice(0, 2));
      if (!s.scrolling && Math.hypot(c.x - s.cx0, c.y - s.cy0) > TOUCH.slop) {
        s.scrolling = true;
        s.multiMoved = true;
        s.cxLast = s.cx0;
        s.cyLast = s.cy0;
      }
      if (s.scrolling) {
        s.accX += c.x - s.cxLast;
        s.accY += c.y - s.cyLast;
        s.cxLast = c.x;
        s.cyLast = c.y;
        const sx = Math.trunc(s.accX / TOUCH.scrollStep);
        const sy = Math.trunc(s.accY / TOUCH.scrollStep);
        if (sx || sy) {
          s.accX -= sx * TOUCH.scrollStep;
          s.accY -= sy * TOUCH.scrollStep;
          // Fingers moving up scroll the page down.
          out.push({ kind: "scroll", x: -sx || 0, y: -sy || 0 });
        }
      }
    } else if (s.phase === "three") {
      if (Math.hypot(f.x - f.sx, f.y - f.sy) > TOUCH.slop) s.multiMoved = true;
    }
    return finish();
  }

  // up
  const lifted = s.fingers.find(f => f.id === ev.id);
  if (!lifted) return finish(); // a finger we never saw land
  const wasPrimary = ev.id === s.primaryId;
  s.fingers = s.fingers.filter(f => f.id !== ev.id);
  const quick = ev.t - s.tMulti <= TOUCH.multiTapMax;

  switch (s.phase) {
    case "one":
      if (s.graceAt !== null) {
        // Lifted before the drag pressed: still a short drag, not a click.
        startDrag(lifted);
        release();
      } else if (!s.moved) {
        // A late timer must not turn a long press into a tap.
        if (s.longArmed || ev.t - s.t0 >= TOUCH.holdMs) {
          out.push({ kind: "click", button: "right" });
        } else if (direct) {
          out.push({ kind: "click", button: "left" });
          s.lastTap = { x: s.ax, y: s.ay, t: ev.t };
        } else {
          s.pendingClickAt = ev.t + TOUCH.tapDelay;
        }
      }
      s.phase = "idle";
      break;
    case "tap2":
      // Quick second tap: double-click.
      out.push({ kind: "click", button: "left" }, { kind: "click", button: "left" });
      s.phase = "idle";
      break;
    case "drag":
      if (wasPrimary) {
        release();
        s.phase = s.fingers.length ? "done" : "idle";
      }
      break;
    case "two":
      if (!s.scrolling && !s.multiMoved && quick) out.push({ kind: "click", button: "right" });
      s.phase = "done";
      break;
    case "three":
      if (!s.multiMoved && quick) out.push({ kind: "click", button: "middle" });
      s.phase = "done";
      break;
    default:
      break;
  }
  if (s.fingers.length === 0) {
    s.phase = "idle";
    s.moved = false;
    s.longArmed = false;
    s.scrolling = false;
    s.graceAt = null;
  }
  return finish();
}

// --- pointer maths ------------------------------------------------------------------

/** CSS px on screen to remote screen pixels (the relative mouse unit). */
export function toStreamDelta(
  dx: number,
  dy: number,
  gain: number,
  stream: { width: number; height: number },
  displayed: { width: number; height: number },
): { dx: number; dy: number } {
  if (!(displayed.width > 0 && displayed.height > 0)) return { dx: 0, dy: 0 };
  return {
    dx: (dx * gain * stream.width) / displayed.width,
    dy: (dy * gain * stream.height) / displayed.height,
  };
}

/** Keeps the fractional part of scaled deltas so slow movement is not rounded away. */
export function createCarry() {
  let rx = 0;
  let ry = 0;
  return {
    take(dx: number, dy: number): { dx: number; dy: number } {
      rx += dx;
      ry += dy;
      const ix = Math.trunc(rx);
      const iy = Math.trunc(ry);
      rx -= ix;
      ry -= iy;
      return { dx: ix, dy: iy };
    },
    reset() {
      rx = 0;
      ry = 0;
    },
  };
}
