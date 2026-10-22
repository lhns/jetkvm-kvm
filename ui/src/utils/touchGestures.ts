// Touch gestures as a pure reducer: events and a clock in, mouse actions and the next
// deadline out. useTouchInput feeds it pointer events and timers and performs the actions.
//
// Touchpad style (always used for the relative mouse): one finger moves, a tap clicks after
// `tapDelay`, double-tap and hold then drag, two fingers scroll or right-click, three
// fingers middle-click, a still long press right-clicks on release.
// Direct style: touching puts the cursor under the finger, moving presses and drags.

export interface GestureConfig {
  mode: "touchpad" | "direct";
  /** Touchpad: a tap's click is held back this long, so a second tap can still become a drag. */
  tapDelay: number;
  /** Still for this long gives a haptic pulse; releasing then right-clicks. */
  longPress: number;
  /** Off: taps click at once and there is no tap-and-drag. */
  tapDrag: boolean;
  /** Touchpad: second touch held still this long presses and holds. */
  holdDelay: number;
  /** Movement below this (CSS px) still counts as a tap or a hold. */
  slop: number;
  /** CSS px of two-finger travel per wheel step. */
  scrollStep: number;
  /** Two or three fingers lifting within this are a tap. */
  multiTapMax: number;
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  mode: "touchpad",
  tapDelay: 180,
  longPress: 550,
  tapDrag: true,
  holdDelay: 300,
  slop: 10,
  scrollStep: 24,
  multiTapMax: 400,
};

export type Button = "left" | "right" | "middle";

export type GestureEvent =
  | { type: "down"; id: number; x: number; y: number; t: number }
  | { type: "move"; id: number; x: number; y: number; t: number }
  | { type: "up"; id: number; t: number }
  | { type: "cancel"; t: number }
  | { type: "tick"; t: number };

export type GestureAction =
  /** Touchpad: relative movement in CSS px; `dt` ms since the previous move, for acceleration. */
  | { kind: "move"; dx: number; dy: number; dt: number }
  /** Direct: put the cursor under this client point. */
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
  /** Touchpad: a tap whose click is still held back until this time. */
  pendingClickAt: number | null;
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
  lastT: number;
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
  t0: 0,
  tMulti: 0,
  moved: false,
  longArmed: false,
  pressed: false,
  primaryId: -1,
  lastX: 0,
  lastY: 0,
  lastT: 0,
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

function deadlineOf(s: GestureState, cfg: GestureConfig): number | null {
  const ds: number[] = [];
  if (s.pendingClickAt !== null) ds.push(s.pendingClickAt);
  if (s.phase === "one" && !s.moved && !s.longArmed) ds.push(s.t0 + cfg.longPress);
  if (s.phase === "tap2") ds.push(s.t0 + cfg.holdDelay);
  return ds.length ? Math.min(...ds) : null;
}

export function reduceGesture(prev: GestureState, ev: GestureEvent, cfg: GestureConfig): Reduced {
  const s: GestureState = { ...prev, fingers: prev.fingers.map(f => ({ ...f })) };
  const out: GestureAction[] = [];
  const direct = cfg.mode === "direct";

  const finish = (): Reduced => ({ state: s, actions: out, deadline: deadlineOf(s, cfg) });

  const press = () => {
    s.pressed = true;
    out.push({ kind: "button", button: "left", down: true });
  };
  const release = () => {
    if (s.pressed) out.push({ kind: "button", button: "left", down: false });
    s.pressed = false;
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
    if (s.phase === "one" && !s.moved && !s.longArmed && ev.t - s.t0 >= cfg.longPress) {
      s.longArmed = true;
      out.push({ kind: "haptic" });
    }
    if (s.phase === "tap2" && ev.t - s.t0 >= cfg.holdDelay) {
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
      s.lastT = ev.t;
      if (direct) {
        out.push({ kind: "moveTo", x: ev.x, y: ev.y });
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
      if (!s.moved && Math.hypot(f.x - f.sx, f.y - f.sy) > cfg.slop) {
        s.moved = true;
        s.longArmed = false;
        if (direct) {
          out.push({ kind: "moveTo", x: f.sx, y: f.sy });
          s.phase = "drag";
          press();
          out.push({ kind: "moveTo", x: f.x, y: f.y });
        } else {
          out.push({ kind: "move", dx: f.x - f.sx, dy: f.y - f.sy, dt: ev.t - s.t0 });
        }
        s.lastX = f.x;
        s.lastY = f.y;
        s.lastT = ev.t;
      } else if (s.moved) {
        out.push({ kind: "move", dx: f.x - s.lastX, dy: f.y - s.lastY, dt: ev.t - s.lastT });
        s.lastX = f.x;
        s.lastY = f.y;
        s.lastT = ev.t;
      }
    } else if (s.phase === "tap2" && f.id === s.primaryId) {
      if (Math.hypot(f.x - f.sx, f.y - f.sy) > cfg.slop) {
        // Tap, then touch and move: drag. No click went out first, so a title bar drag does
        // not also double-click.
        s.phase = "drag";
        press();
        out.push({ kind: "move", dx: f.x - f.sx, dy: f.y - f.sy, dt: ev.t - s.t0 });
        s.lastX = f.x;
        s.lastY = f.y;
        s.lastT = ev.t;
      }
    } else if (s.phase === "drag" && f.id === s.primaryId) {
      if (direct) {
        out.push({ kind: "moveTo", x: f.x, y: f.y });
      } else {
        out.push({ kind: "move", dx: f.x - s.lastX, dy: f.y - s.lastY, dt: ev.t - s.lastT });
      }
      s.lastX = f.x;
      s.lastY = f.y;
      s.lastT = ev.t;
    } else if (s.phase === "two") {
      const c = centroid(s.fingers.slice(0, 2));
      if (!s.scrolling && Math.hypot(c.x - s.cx0, c.y - s.cy0) > cfg.slop) {
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
        const sx = Math.trunc(s.accX / cfg.scrollStep);
        const sy = Math.trunc(s.accY / cfg.scrollStep);
        if (sx || sy) {
          s.accX -= sx * cfg.scrollStep;
          s.accY -= sy * cfg.scrollStep;
          // Fingers moving up scroll the page down.
          out.push({ kind: "scroll", x: -sx || 0, y: -sy || 0 });
        }
      }
    } else if (s.phase === "three") {
      if (Math.hypot(f.x - f.sx, f.y - f.sy) > cfg.slop) s.multiMoved = true;
    }
    return finish();
  }

  // up
  const wasPrimary = ev.id === s.primaryId;
  s.fingers = s.fingers.filter(f => f.id !== ev.id);
  const quick = ev.t - s.tMulti <= cfg.multiTapMax;

  switch (s.phase) {
    case "one":
      if (!s.moved) {
        // A late timer must not turn a long press into a tap.
        if (s.longArmed || ev.t - s.t0 >= cfg.longPress)
          out.push({ kind: "click", button: "right" });
        else if (direct || !cfg.tapDrag) out.push({ kind: "click", button: "left" });
        else s.pendingClickAt = ev.t + cfg.tapDelay;
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
  }
  return finish();
}

// --- cursor and pointer maths -------------------------------------------------------

/**
 * Speed (CSS px per ms) to a gain: slow moves stay precise, fast flicks cover distance.
 * `sensitivity` scales the whole curve.
 */
export function gainFor(speed: number, sensitivity: number): number {
  const v = Math.min(Math.max(speed, 0), 3);
  return sensitivity * (1 + 0.8 * v);
}

export function speedOf(dx: number, dy: number, dtMs: number): number {
  return Math.hypot(dx, dy) / Math.max(dtMs, 4);
}

/** Moves a virtual cursor (fractions 0..1 of the remote screen), clamped to the screen. */
export function moveVirtualCursor(
  cursor: { nx: number; ny: number },
  dx: number,
  dy: number,
  gain: number,
  displayed: { width: number; height: number },
): { nx: number; ny: number } {
  if (!(displayed.width > 0 && displayed.height > 0)) return cursor;
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  return {
    nx: clamp(cursor.nx + (dx * gain) / displayed.width),
    ny: clamp(cursor.ny + (dy * gain) / displayed.height),
  };
}

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
