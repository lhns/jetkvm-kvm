import { describe, expect, it } from "vitest";

import {
  createCarry,
  type GestureAction,
  type GestureConfig,
  type GestureEvent,
  initialGestureState,
  reduceGesture,
  toStreamDelta,
} from "./touchGestures";

/** Feeds events through the reducer and, like the hook, fires ticks at each deadline. */
class Sim {
  state = initialGestureState();
  deadline: number | null = null;
  log: Array<{ t: number; a: GestureAction }> = [];

  cfg: GestureConfig;

  constructor(cfg: GestureConfig) {
    this.cfg = cfg;
  }

  private apply(ev: GestureEvent) {
    const r = reduceGesture(this.state, ev, this.cfg);
    this.state = r.state;
    this.deadline = r.deadline;
    for (const a of r.actions) this.log.push({ t: ev.t, a });
  }

  /** Advance the clock to t, firing due ticks first. */
  at(t: number) {
    while (this.deadline !== null && this.deadline <= t) {
      this.apply({ type: "tick", t: this.deadline });
    }
    return this;
  }
  down(t: number, id: number, x = 100, y = 100) {
    this.at(t).apply({ type: "down", id, x, y, t });
    return this;
  }
  move(t: number, id: number, x: number, y: number) {
    this.at(t).apply({ type: "move", id, x, y, t });
    return this;
  }
  up(t: number, id: number) {
    this.at(t).apply({ type: "up", id, t });
    return this;
  }
  cancel(t: number) {
    this.at(t).apply({ type: "cancel", t });
    return this;
  }
  actions(kind?: GestureAction["kind"]) {
    return this.log.filter(l => !kind || l.a.kind === kind);
  }
  clicks() {
    return this.log
      .filter(l => l.a.kind === "click")
      .map(l => ({ t: l.t, button: (l.a as { button: string }).button }));
  }
  buttonDowns() {
    return this.actions("button").map(l => (l.a as { down: boolean }).down);
  }
}

const trackpad: GestureConfig = { mode: "trackpad" };
const direct: GestureConfig = { mode: "direct" };

describe("trackpad: one finger", () => {
  it("sends a tap's left click 180 ms after the lift", () => {
    const s = new Sim(trackpad).down(0, 1).up(80, 1);
    expect(s.clicks()).toEqual([]);
    s.at(259);
    expect(s.clicks()).toEqual([]);
    s.at(260);
    expect(s.clicks()).toEqual([{ t: 260, button: "left" }]);
  });

  it("moves with the finger once past the slop", () => {
    const s = new Sim(trackpad).down(0, 1).move(16, 1, 105, 100);
    expect(s.actions("move")).toHaveLength(0);
    s.move(32, 1, 130, 100).move(48, 1, 140, 100);
    const moves = s.actions("move").map(l => l.a);
    expect(moves[0]).toMatchObject({ dx: 30, dy: 0 });
    expect(moves[1]).toMatchObject({ dx: 10, dy: 0 });
    s.up(60, 1).at(1000);
    expect(s.clicks()).toEqual([]);
  });

  it("right-clicks on release after a still long press, with a haptic pulse", () => {
    const s = new Sim(trackpad).down(0, 1).at(549);
    expect(s.actions("haptic")).toHaveLength(0);
    s.at(550);
    expect(s.actions("haptic")).toHaveLength(1);
    expect(s.clicks()).toEqual([]);
    s.up(700, 1).at(2000);
    expect(s.clicks()).toEqual([{ t: 700, button: "right" }]);
  });

  it("cancels the right click when moving after the pulse and keeps moving", () => {
    const s = new Sim(trackpad).down(0, 1).at(560);
    s.move(600, 1, 150, 100).move(620, 1, 160, 100);
    expect(s.actions("move").length).toBeGreaterThan(0);
    s.up(700, 1).at(2000);
    expect(s.clicks()).toEqual([]);
  });
});

describe("trackpad: tap and drag", () => {
  it("double-tap and drag presses without sending a click first", () => {
    const s = new Sim(trackpad).down(0, 1).up(60, 1).down(150, 2).move(170, 2, 140, 100);
    expect(s.actions("click")).toHaveLength(0);
    expect(s.actions("button")[0].a).toEqual({ kind: "button", button: "left", down: true });
    s.move(190, 2, 160, 100);
    expect(s.actions("move").length).toBeGreaterThan(0);
    s.up(250, 2);
    expect(s.buttonDowns()).toEqual([true, false]);
    s.at(3000);
    expect(s.clicks()).toEqual([]);
  });

  it("a quickly lifted second tap is a double-click", () => {
    const s = new Sim(trackpad).down(0, 1).up(60, 1).down(150, 2).up(200, 2).at(3000);
    expect(s.clicks().map(c => c.button)).toEqual(["left", "left"]);
    expect(s.clicks().every(c => c.t === 200)).toBe(true);
  });

  it("a second touch held still for 300 ms presses and holds", () => {
    const s = new Sim(trackpad).down(0, 1).up(60, 1).down(150, 2).at(449);
    expect(s.actions("button")).toHaveLength(0);
    s.at(450);
    expect(s.buttonDowns()).toEqual([true]);
    s.move(500, 2, 180, 100).up(600, 2);
    expect(s.buttonDowns()).toEqual([true, false]);
    expect(s.clicks()).toEqual([]);
  });

  it("a touch after the tap delay is a new tap", () => {
    const s = new Sim(trackpad).down(0, 1).up(60, 1).down(400, 2).up(450, 2).at(3000);
    expect(s.clicks().map(c => c.t)).toEqual([240, 630]);
  });

  it("a second finger landing while a tap is pending flushes that click", () => {
    const s = new Sim(trackpad).down(0, 1).up(60, 1).down(100, 2, 200, 200).down(110, 3, 260, 200);
    expect(s.clicks()).toEqual([{ t: 110, button: "left" }]);
    s.move(130, 2, 200, 240).move(150, 3, 260, 240);
    s.up(300, 2).up(310, 3).at(3000);
    expect(s.clicks()).toHaveLength(1);
  });
});

describe("trackpad: several fingers", () => {
  it("two fingers swipe to scroll, 24 px a step, fingers up scroll down", () => {
    const s = new Sim(trackpad).down(0, 1, 100, 300).down(10, 2, 160, 300);
    s.move(20, 1, 100, 280).move(30, 2, 160, 280);
    expect(s.actions("scroll")).toHaveLength(0);
    s.move(40, 1, 100, 240).move(50, 2, 160, 240);
    const total = s.actions("scroll").reduce((n, l) => n + (l.a as { y: number }).y, 0);
    expect(total).toBe(2);
    s.up(100, 1).up(110, 2).at(2000);
    expect(s.clicks()).toEqual([]);
  });

  it("two fingers scroll sideways", () => {
    const s = new Sim(trackpad).down(0, 1, 100, 300).down(5, 2, 160, 300);
    s.move(20, 1, 40, 300).move(30, 2, 100, 300);
    const x = s.actions("scroll").reduce((n, l) => n + (l.a as { x: number }).x, 0);
    expect(x).toBe(2);
  });

  it("a two-finger tap right-clicks", () => {
    const s = new Sim(trackpad).down(0, 1).down(10, 2, 160, 100).up(120, 1).up(130, 2).at(2000);
    expect(s.clicks()).toEqual([{ t: 120, button: "right" }]);
  });

  it("a slow two-finger touch is no tap", () => {
    const s = new Sim(trackpad).down(0, 1).down(10, 2, 160, 100).up(900, 1).up(910, 2).at(2000);
    expect(s.clicks()).toEqual([]);
  });

  it("a three-finger tap middle-clicks", () => {
    const s = new Sim(trackpad)
      .down(0, 1)
      .down(5, 2, 160, 100)
      .down(10, 3, 220, 100)
      .up(100, 1)
      .up(110, 2)
      .up(120, 3)
      .at(2000);
    expect(s.clicks()).toEqual([{ t: 100, button: "middle" }]);
  });

  it("a three-finger swipe does nothing here", () => {
    const s = new Sim(trackpad).down(0, 1).down(5, 2, 160, 100).down(10, 3, 220, 100);
    s.move(30, 1, 220, 100).move(40, 2, 280, 100).move(50, 3, 340, 100);
    s.up(100, 1).up(110, 2).up(120, 3).at(2000);
    expect(s.log).toEqual([]);
  });

  it("four fingers do nothing", () => {
    const s = new Sim(trackpad);
    [1, 2, 3, 4].forEach((id, i) => s.down(i * 5, id, 100 + id * 50, 100));
    [1, 2, 3, 4].forEach((id, i) => s.up(100 + i * 5, id));
    s.at(2000);
    expect(s.log).toEqual([]);
  });
});

describe("direct touch", () => {
  it("puts the cursor under the finger on touch, with no button", () => {
    const s = new Sim(direct).down(0, 1, 50, 60);
    expect(s.log.map(l => l.a)).toEqual([{ kind: "moveTo", x: 50, y: 60 }]);
  });

  it("clicks when lifted before the long-press time", () => {
    const s = new Sim(direct).down(0, 1, 50, 60).up(200, 1).at(2000);
    expect(s.clicks()).toEqual([{ t: 200, button: "left" }]);
  });

  it("presses at the start point when moving past the slop, then drags and releases", () => {
    const s = new Sim(direct).down(0, 1, 50, 60).move(150, 1, 90, 60).move(170, 1, 120, 80);
    const acts = s.log.map(l => l.a);
    expect(acts[1]).toEqual({ kind: "moveTo", x: 50, y: 60 });
    expect(acts[2]).toEqual({ kind: "button", button: "left", down: true });
    expect(acts[3]).toEqual({ kind: "moveTo", x: 90, y: 60 });
    expect(acts[acts.length - 1]).toEqual({ kind: "moveTo", x: 120, y: 80 });
    s.up(200, 1);
    expect(s.buttonDowns()).toEqual([true, false]);
    expect(s.clicks()).toEqual([]);
  });

  it("right-clicks on release after a long press", () => {
    const s = new Sim(direct).down(0, 1, 50, 60).at(560);
    expect(s.actions("haptic")).toHaveLength(1);
    s.up(800, 1);
    expect(s.clicks()).toEqual([{ t: 800, button: "right" }]);
  });

  it("drags when moving after the long-press pulse", () => {
    const s = new Sim(direct).down(0, 1, 50, 60).at(560).move(600, 1, 120, 60).up(700, 1);
    expect(s.buttonDowns()).toEqual([true, false]);
    expect(s.clicks()).toEqual([]);
  });

  it("two fingers scroll and never press the left button", () => {
    const s = new Sim(direct).down(0, 1, 100, 300).down(10, 2, 160, 300);
    s.move(20, 1, 100, 250).move(30, 2, 160, 250);
    expect(s.actions("scroll").length).toBeGreaterThan(0);
    expect(s.actions("button")).toHaveLength(0);
  });

  it("a two-finger tap right-clicks", () => {
    const s = new Sim(direct).down(0, 1).down(10, 2, 160, 100).up(150, 1).up(160, 2).at(2000);
    expect(s.clicks()).toEqual([{ t: 150, button: "right" }]);
    expect(s.actions("button")).toHaveLength(0);
  });
});

describe("direct touch: double-tap snap", () => {
  const moveTos = (s: Sim) => s.actions("moveTo").map(l => l.a);

  it("a second tap within 500 ms and 16 px lands on the first tap's point", () => {
    const s = new Sim(direct).down(0, 1, 100, 100).up(60, 1).down(300, 2, 110, 108).up(360, 2);
    expect(moveTos(s)).toEqual([
      { kind: "moveTo", x: 100, y: 100 },
      { kind: "moveTo", x: 100, y: 100 },
    ]);
    expect(s.clicks().map(c => c.button)).toEqual(["left", "left"]);
  });

  it("does not snap after 500 ms from the lift", () => {
    const s = new Sim(direct).down(0, 1, 100, 100).up(60, 1).down(561, 2, 105, 100);
    expect(moveTos(s)[1]).toEqual({ kind: "moveTo", x: 105, y: 100 });
    const edge = new Sim(direct).down(0, 1, 100, 100).up(60, 1).down(560, 2, 105, 100);
    expect(moveTos(edge)[1]).toEqual({ kind: "moveTo", x: 100, y: 100 });
  });

  it("does not snap 20 px away", () => {
    const s = new Sim(direct).down(0, 1, 100, 100).up(60, 1).down(200, 2, 120, 100);
    expect(moveTos(s)[1]).toEqual({ kind: "moveTo", x: 120, y: 100 });
  });

  it("a triple tap snaps twice", () => {
    const s = new Sim(direct)
      .down(0, 1, 100, 100)
      .up(50, 1)
      .down(200, 2, 108, 100)
      .up(250, 2)
      .down(400, 3, 94, 104)
      .up(450, 3);
    expect(moveTos(s).every(a => a.kind === "moveTo" && a.x === 100 && a.y === 100)).toBe(true);
    expect(s.clicks()).toHaveLength(3);
  });

  it("double tap then drag presses at the first tap's point", () => {
    const s = new Sim(direct).down(0, 1, 100, 100).up(50, 1).down(200, 2, 108, 100);
    s.move(400, 2, 160, 100).move(420, 2, 200, 100).up(500, 2);
    const acts = s.log.map(l => l.a);
    const press = acts.findIndex(a => a.kind === "button");
    expect(acts[press - 1]).toEqual({ kind: "moveTo", x: 100, y: 100 });
    expect(s.buttonDowns()).toEqual([true, false]);
    expect(s.clicks()).toHaveLength(1);
  });

  it("a right click or a drag clears the snap", () => {
    const s = new Sim(direct).down(0, 1, 100, 100).at(560).up(600, 1).down(700, 2, 105, 100);
    expect(moveTos(s)[1]).toEqual({ kind: "moveTo", x: 105, y: 100 });
  });
});

describe("direct touch: multi-finger grace", () => {
  it("defers the press to 100 ms when the slop is crossed at 50 ms", () => {
    const s = new Sim(direct).down(0, 1, 50, 60).move(50, 1, 90, 60);
    expect(s.actions("button")).toHaveLength(0);
    expect(s.deadline).toBe(100);
    s.move(80, 1, 100, 60).at(100);
    const acts = s.log.map(l => l.a).slice(1);
    expect(acts).toEqual([
      { kind: "moveTo", x: 50, y: 60 },
      { kind: "button", button: "left", down: true },
      { kind: "moveTo", x: 100, y: 60 },
    ]);
    s.up(200, 1);
    expect(s.buttonDowns()).toEqual([true, false]);
  });

  it("presses at once when the slop is crossed at 150 ms", () => {
    const s = new Sim(direct).down(0, 1, 50, 60).move(150, 1, 90, 60);
    expect(s.buttonDowns()).toEqual([true]);
    expect(s.deadline).toBeNull();
  });

  it("a second finger at 60 ms scrolls and never presses", () => {
    const s = new Sim(direct).down(0, 1, 100, 300).move(50, 1, 100, 270);
    s.down(60, 2, 160, 300).move(70, 1, 100, 230).move(80, 2, 160, 230).at(500);
    expect(s.actions("button")).toHaveLength(0);
    expect(s.actions("scroll").length).toBeGreaterThan(0);
    s.up(600, 1).up(610, 2).at(2000);
    expect(s.actions("button")).toHaveLength(0);
  });

  it("a second finger during an established drag is ignored", () => {
    const s = new Sim(direct).down(0, 1, 100, 300).move(150, 1, 100, 250);
    s.down(200, 2, 160, 300).move(220, 2, 160, 200).up(230, 2);
    expect(s.buttonDowns()).toEqual([true]);
    expect(s.actions("scroll")).toHaveLength(0);
    s.up(300, 1);
    expect(s.buttonDowns()).toEqual([true, false]);
  });

  it("cancel during the grace emits no button action", () => {
    const s = new Sim(direct).down(0, 1, 50, 60).move(50, 1, 90, 60).cancel(70);
    expect(s.actions("button")).toHaveLength(0);
    expect(s.deadline).toBeNull();
    s.at(1000);
    expect(s.actions("button")).toHaveLength(0);
  });

  it("a lift during the grace is a short drag, not a click", () => {
    const s = new Sim(direct).down(0, 1, 50, 60).move(50, 1, 90, 60).up(80, 1);
    expect(s.log.map(l => l.a).slice(1)).toEqual([
      { kind: "moveTo", x: 50, y: 60 },
      { kind: "button", button: "left", down: true },
      { kind: "moveTo", x: 90, y: 60 },
      { kind: "button", button: "left", down: false },
    ]);
    expect(s.clicks()).toEqual([]);
    expect(s.deadline).toBeNull();
  });
});

describe("cancel", () => {
  it("releases a held button", () => {
    const s = new Sim(direct).down(0, 1, 50, 60).move(150, 1, 90, 60).cancel(160);
    expect(s.buttonDowns()).toEqual([true, false]);
    expect(s.deadline).toBeNull();
  });

  it("releases a trackpad drag and drops a pending click", () => {
    const s = new Sim(trackpad)
      .down(0, 1)
      .up(60, 1)
      .down(150, 2)
      .move(170, 2, 140, 100)
      .cancel(200);
    expect(s.buttonDowns()).toEqual([true, false]);
    s.up(250, 2).at(3000);
    expect(s.clicks()).toEqual([]);
  });

  it("is harmless when idle", () => {
    const s = new Sim(trackpad).cancel(10);
    expect(s.log).toEqual([]);
  });

  it("ignores the lift of a finger it never saw land", () => {
    const s = new Sim(trackpad).up(10, 7);
    expect(s.log).toEqual([]);
  });
});

describe("pointer maths", () => {
  it("scales screen px to stream px by stream width over displayed width", () => {
    const stream = { width: 1920, height: 1080 };
    const shown = { width: 960, height: 540 };
    expect(toStreamDelta(10, 5, stream, shown)).toEqual({ dx: 20, dy: 10 });
  });

  it("carries sub-pixel remainders", () => {
    const c = createCarry();
    const out = [0.4, 0.4, 0.4, 0.4, 0.4].map(v => c.take(v, -v).dx);
    expect(out.reduce((a, b) => a + b, 0)).toBe(2);
    expect(c.take(0.4, 0).dx).toBe(0);
  });
});
