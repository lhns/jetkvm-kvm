import { describe, expect, it } from "vitest";

import {
  clampPosition,
  fitKeyHeight,
  isStacked,
  keyboardBudget,
  MAX_KEY_HEIGHT,
  MIN_KEY_HEIGHT,
} from "./keyboardFit";

// A keyboard of `rows` rows with a fixed 64 px of header, padding and gaps.
const heightAt = (keyHeight: number, rows: number) => 64 + rows * keyHeight;

describe("fitKeyHeight", () => {
  it("shrinks to the budget in one step", () => {
    const rows = 6;
    const keyHeight = fitKeyHeight({
      budget: 249,
      measuredHeight: heightAt(40, rows),
      keyHeight: 40,
      rows,
    });
    expect(keyHeight).toBe(30);
    expect(heightAt(keyHeight, rows)).toBeLessThanOrEqual(249);
    expect(heightAt(keyHeight + 1, rows)).toBeGreaterThan(249);
  });

  it("caps at the maximum when there is room", () => {
    expect(
      fitKeyHeight({ budget: 900, measuredHeight: heightAt(30, 6), keyHeight: 30, rows: 6 }),
    ).toBe(MAX_KEY_HEIGHT);
  });

  it("floors at the minimum when the budget is tiny", () => {
    expect(
      fitKeyHeight({ budget: 100, measuredHeight: heightAt(40, 9), keyHeight: 40, rows: 9 }),
    ).toBe(MIN_KEY_HEIGHT);
  });

  it("is stable once fitted", () => {
    const rows = 9;
    const first = fitKeyHeight({
      budget: 300,
      measuredHeight: heightAt(40, rows),
      keyHeight: 40,
      rows,
    });
    const second = fitKeyHeight({
      budget: 300,
      measuredHeight: heightAt(first, rows),
      keyHeight: first,
      rows,
    });
    expect(second).toBe(first);
  });

  it("ignores a budget change under one key pixel", () => {
    expect(
      fitKeyHeight({
        budget: heightAt(30, 6) + 3,
        measuredHeight: heightAt(30, 6),
        keyHeight: 30,
        rows: 6,
      }),
    ).toBe(30);
  });
});

describe("keyboardBudget", () => {
  it("page: keeps the minimum video, capped at 60% of the viewport", () => {
    expect(keyboardBudget({ mode: "page", boxHeight: 297, viewportHeight: 460 })).toBe(249);
    expect(keyboardBudget({ mode: "page", boxHeight: 700, viewportHeight: 900 })).toBe(540);
  });

  it("fullscreen: half of the viewport", () => {
    expect(keyboardBudget({ mode: "fullscreen", boxHeight: 0, viewportHeight: 500 })).toBe(250);
  });

  it("detached: 60% of the viewport", () => {
    expect(keyboardBudget({ mode: "detached", boxHeight: 0, viewportHeight: 500 })).toBe(300);
  });

  it("never goes below a usable minimum", () => {
    expect(keyboardBudget({ mode: "page", boxHeight: 20, viewportHeight: 300 })).toBe(96);
  });
});

describe("clampPosition", () => {
  const viewport = { width: 740, height: 460 };

  it("keeps a box that fits where it is", () => {
    expect(clampPosition({ x: 100, y: 50 }, { width: 500, height: 300 }, viewport)).toEqual({
      x: 100,
      y: 50,
    });
  });

  it("pulls a box back inside after the viewport shrank", () => {
    expect(clampPosition({ x: 400, y: 400 }, { width: 500, height: 300 }, viewport)).toEqual({
      x: 240,
      y: 160,
    });
  });

  it("sticks to the origin when the box is larger than the viewport", () => {
    expect(clampPosition({ x: 30, y: 30 }, { width: 900, height: 600 }, viewport)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("never goes negative", () => {
    expect(clampPosition({ x: -5, y: -5 }, { width: 100, height: 100 }, viewport)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("isStacked", () => {
  it("stacks below 560 px of width", () => {
    expect(isStacked(559)).toBe(true);
    expect(isStacked(560)).toBe(false);
    expect(isStacked(740)).toBe(false);
  });
});
