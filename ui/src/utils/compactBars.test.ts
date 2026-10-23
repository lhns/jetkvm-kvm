import { describe, expect, it } from "vitest";

import { SHORT_VIEWPORT_HEIGHT, shouldCompactBars } from "./compactBars";

describe("shouldCompactBars", () => {
  it("compacts when the keyboard is open on a short viewport", () => {
    expect(shouldCompactBars({ keyboardOpen: true, viewportHeight: 460 })).toBe(true);
    expect(
      shouldCompactBars({ keyboardOpen: true, viewportHeight: SHORT_VIEWPORT_HEIGHT - 1 }),
    ).toBe(true);
  });

  it("restores the bars when the keyboard closes", () => {
    expect(shouldCompactBars({ keyboardOpen: false, viewportHeight: 460 })).toBe(false);
  });

  it("leaves tall viewports alone", () => {
    expect(shouldCompactBars({ keyboardOpen: true, viewportHeight: SHORT_VIEWPORT_HEIGHT })).toBe(
      false,
    );
    expect(shouldCompactBars({ keyboardOpen: true, viewportHeight: 900 })).toBe(false);
  });
});
