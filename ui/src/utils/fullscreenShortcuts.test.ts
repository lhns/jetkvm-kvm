import { describe, expect, it } from "vitest";

import {
  blackBarSpot,
  classifyMultiTouch,
  macroSwipeValue,
  resolveSwipeAction,
  SWIPE_DEFAULT,
  SWIPE_OFF,
} from "./fullscreenShortcuts";

const t = (maxFingers: number, dx: number, dy: number, durationMs = 200) => ({
  maxFingers,
  dx,
  dy,
  durationMs,
});

describe("classifyMultiTouch", () => {
  it("detects three-finger swipes in both directions", () => {
    expect(classifyMultiTouch(t(3, -120, 10))).toEqual({ type: "swipe", direction: "left" });
    expect(classifyMultiTouch(t(3, 90, -20))).toEqual({ type: "swipe", direction: "right" });
  });

  it("needs distance and a mostly horizontal path", () => {
    expect(classifyMultiTouch(t(3, 40, 0))).toBeNull();
    expect(classifyMultiTouch(t(3, 100, 80))).toBeNull();
    expect(classifyMultiTouch(t(3, 0, 150))).toBeNull();
  });

  it("opens the menu on a four-finger tap", () => {
    expect(classifyMultiTouch(t(4, 3, 4))).toEqual({ type: "menu" });
  });

  it("ignores four fingers that move or linger", () => {
    expect(classifyMultiTouch(t(4, 80, 0))).toBeNull();
    expect(classifyMultiTouch(t(4, 0, 0, 900))).toBeNull();
  });

  it("ignores one and two fingers", () => {
    expect(classifyMultiTouch(t(1, -200, 0))).toBeNull();
    expect(classifyMultiTouch(t(2, -200, 0))).toBeNull();
  });
});

describe("resolveSwipeAction", () => {
  const macros = [
    { id: "a1", name: "Snap", steps: [{ keys: ["KeyL"], modifiers: [], delay: 50 }] },
  ];

  it("sends Win+Shift+Arrow by default", () => {
    expect(resolveSwipeAction(SWIPE_DEFAULT, "left", macros)).toEqual([
      { keys: ["ArrowLeft"], modifiers: ["MetaLeft", "ShiftLeft"], delay: 100 },
    ]);
    expect(resolveSwipeAction(SWIPE_DEFAULT, "right", macros)?.[0].keys).toEqual(["ArrowRight"]);
  });

  it("runs the chosen macro", () => {
    expect(resolveSwipeAction(macroSwipeValue("a1"), "left", macros)).toBe(macros[0].steps);
  });

  it("does nothing when off or the macro is gone", () => {
    expect(resolveSwipeAction(SWIPE_OFF, "left", macros)).toBeNull();
    expect(resolveSwipeAction(macroSwipeValue("gone"), "left", macros)).toBeNull();
  });
});

describe("blackBarSpot", () => {
  it("finds the pillarbox bar, never the video", () => {
    const s = blackBarSpot(1000, 500, 250, 0);
    expect(s).toEqual({ x: 125, y: 36 });
  });

  it("finds the letterbox bar", () => {
    expect(blackBarSpot(500, 1000, 0, 375)).toEqual({ x: 36, y: 187.5 });
  });

  it("returns null without a wide enough bar", () => {
    expect(blackBarSpot(1000, 500, 10, 10)).toBeNull();
    expect(blackBarSpot(1000, 500, 0, 0)).toBeNull();
  });
});
