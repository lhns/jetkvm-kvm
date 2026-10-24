import { describe, expect, it } from "vitest";

import { clampToViewport } from "./clampToViewport";

const viewport = { width: 740, height: 460 };
const card = { width: 700, height: 280 };

describe("clampToViewport", () => {
  it("leaves a position that fits alone", () => {
    expect(clampToViewport({ x: 20, y: 100 }, card, viewport)).toEqual({ x: 20, y: 100 });
  });

  it("stops a drag past the left or top edge", () => {
    expect(clampToViewport({ x: -900, y: -50 }, card, viewport)).toEqual({ x: 0, y: 0 });
  });

  it("stops a drag past the right or bottom edge", () => {
    expect(clampToViewport({ x: 2000, y: 2000 }, card, viewport)).toEqual({ x: 40, y: 180 });
  });

  it("pulls a position left over from a larger viewport back in", () => {
    expect(clampToViewport({ x: 900, y: 600 }, card, { width: 615, height: 380 })).toEqual({
      x: 0,
      y: 100,
    });
  });

  it("pins a card larger than the viewport to the origin so the header stays visible", () => {
    expect(clampToViewport({ x: 300, y: 300 }, { width: 900, height: 600 }, viewport)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("ignores a non-finite position", () => {
    expect(clampToViewport({ x: NaN, y: Infinity }, card, viewport)).toEqual({ x: 0, y: 0 });
  });
});
