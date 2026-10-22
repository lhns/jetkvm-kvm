import { describe, expect, it } from "vitest";

import { splitInt8Delta } from "./mouseDelta";

describe("splitInt8Delta", () => {
  it("splits 300 into 127, 127, 46", () => {
    expect(splitInt8Delta(300, 0)).toEqual([
      [127, 0],
      [127, 0],
      [46, 0],
    ]);
  });

  it("splits axes independently and keeps signs", () => {
    expect(splitInt8Delta(-200, 10)).toEqual([
      [-127, 10],
      [-73, 0],
    ]);
  });

  it("passes small deltas through and still reports zero movement", () => {
    expect(splitInt8Delta(5, -6)).toEqual([[5, -6]]);
    expect(splitInt8Delta(0, 0)).toEqual([[0, 0]]);
  });

  it("sums back to the input and stays within int8", () => {
    const chunks = splitInt8Delta(1001, -513);
    expect(chunks.reduce((s, c) => s + c[0], 0)).toBe(1001);
    expect(chunks.reduce((s, c) => s + c[1], 0)).toBe(-513);
    for (const [x, y] of chunks) {
      expect(Math.abs(x)).toBeLessThanOrEqual(127);
      expect(Math.abs(y)).toBeLessThanOrEqual(127);
    }
  });

  it("does not loop on non-finite input", () => {
    expect(splitInt8Delta(NaN, Infinity)).toEqual([[0, 0]]);
  });
});
