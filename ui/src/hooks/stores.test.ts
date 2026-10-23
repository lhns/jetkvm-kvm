import { describe, expect, it } from "vitest";

import { migrateSettings } from "./stores";

describe("migrateSettings", () => {
  it("resets touch input to Direct touch, drops the old keys and keeps the rest", () => {
    const old = {
      mouseMode: "relative",
      invertScroll: true,
      touchStyle: "touchpad",
      touchSensitivity: 2,
      touchTapDrag: false,
      touchTapDelay: 300,
      touchLongPress: 700,
    };
    const migrated = migrateSettings(old, 0) as unknown as Record<string, unknown>;
    expect(migrated).toEqual({ mouseMode: "relative", invertScroll: true, touchInput: "direct" });
  });

  it("leaves current state alone", () => {
    const current = { mouseMode: "absolute", touchInput: "trackpad" };
    expect(migrateSettings(current, 1)).toEqual(current);
  });
});
