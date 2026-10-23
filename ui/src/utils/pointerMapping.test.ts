import { describe, expect, it } from "vitest";

import { hidFromNormalized, streamFromClient, videoDisplayArea } from "./pointerMapping";

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
});

describe("videoDisplayArea", () => {
  it("fills the element when the ratios match", () => {
    expect(videoDisplayArea({ width: 960, height: 540 }, 1920, 1080)).toEqual({
      width: 960,
      height: 540,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("pillarboxes a wide element", () => {
    const a = videoDisplayArea({ width: 1000, height: 500 }, 1000, 1000);
    expect(a).toEqual({ width: 500, height: 500, offsetX: 250, offsetY: 0 });
  });

  it("letterboxes a tall element", () => {
    const a = videoDisplayArea({ width: 500, height: 1000 }, 1000, 500);
    expect(a).toEqual({ width: 500, height: 250, offsetX: 0, offsetY: 375 });
  });

  it("falls back to the whole element for zero sizes", () => {
    expect(videoDisplayArea({ width: 0, height: 0 }, 1920, 1080).width).toBe(0);
    expect(videoDisplayArea({ width: 100, height: 50 }, 0, 0)).toEqual({
      width: 100,
      height: 50,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

describe("streamFromClient", () => {
  it("maps an exact ratio with a non-zero element origin", () => {
    const p = streamFromClient(150, 130, rect(100, 100, 200, 100), 1920, 960);
    expect(p).toEqual({ nx: 0.25, ny: 0.3 });
  });

  it("maps inside a pillarboxed video", () => {
    // 1000x500 element, square stream: video spans x 250..750.
    const p = streamFromClient(500, 125, rect(0, 0, 1000, 500), 1000, 1000);
    expect(p).toEqual({ nx: 0.5, ny: 0.25 });
  });

  it("maps inside a letterboxed video", () => {
    // 500x1000 element, 2:1 stream: video spans y 375..625.
    const p = streamFromClient(125, 500, rect(0, 0, 500, 1000), 1000, 500);
    expect(p).toEqual({ nx: 0.25, ny: 0.5 });
  });

  it("clamps points in the black bars and outside the element", () => {
    const r = rect(0, 0, 1000, 500);
    expect(streamFromClient(10, 250, r, 1000, 1000)).toEqual({ nx: 0, ny: 0.5 });
    expect(streamFromClient(990, 700, r, 1000, 1000)).toEqual({ nx: 1, ny: 1 });
    expect(streamFromClient(-50, -50, r, 1000, 1000)).toEqual({ nx: 0, ny: 0 });
  });

  it("returns null while sizes are unknown", () => {
    expect(streamFromClient(1, 1, rect(0, 0, 0, 0), 1920, 1080)).toBeNull();
    expect(streamFromClient(1, 1, rect(0, 0, 100, 100), 0, 0)).toBeNull();
  });
});

describe("hidFromNormalized", () => {
  it("covers 0..32767 and clamps", () => {
    expect(hidFromNormalized(0)).toBe(0);
    expect(hidFromNormalized(1)).toBe(32767);
    expect(hidFromNormalized(0.5)).toBe(16384);
    expect(hidFromNormalized(2)).toBe(32767);
    expect(hidFromNormalized(-1)).toBe(0);
  });
});
