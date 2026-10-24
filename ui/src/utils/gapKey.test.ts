import { describe, expect, it } from "vitest";

import { keyboards } from "@/keyboardLayouts";
import { keys } from "@/keyboardMappings";

import { isGapKey } from "./gapKey";

describe("gap keys", () => {
  it("are blank names, never real keys", () => {
    expect(isGapKey("")).toBe(true);
    expect(isGapKey(" ")).toBe(true);
    expect(isGapKey("Escape")).toBe(false);
    expect(keys[""]).toBeUndefined();
  });

  it("cover every blank token of every layout and no real key", () => {
    for (const { virtualKeyboard } of keyboards) {
      const { main, control, arrows } = virtualKeyboard;
      for (const layers of [main, control, arrows]) {
        for (const rows of Object.values(layers ?? {})) {
          for (const row of rows) {
            for (const token of row.split(" ")) {
              const name = token.replace(/[()]/g, "");
              expect(isGapKey(token)).toBe(!(name in keys));
            }
          }
        }
      }
    }
  });
});
