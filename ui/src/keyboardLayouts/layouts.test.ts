import { describe, expect, it } from "vitest";

import { keyboards } from "@/keyboardLayouts";
import { keys } from "@/keyboardMappings";

// Every virtual key must be a real key: a fake name sends HID code undefined.
describe("virtual keyboard layouts", () => {
  for (const keyboard of keyboards) {
    it(`${keyboard.isoCode} only uses known keys`, () => {
      const unknown: string[] = [];
      // The number pad block is not rendered yet, so it is not checked.
      const { main, control, arrows } = keyboard.virtualKeyboard;
      for (const [block, layers] of Object.entries({ main, control, arrows })) {
        for (const [layer, rows] of Object.entries(layers ?? {})) {
          for (const row of rows) {
            for (const token of row.split(" ").filter(Boolean)) {
              const name = token.replace(/[()]/g, "");
              if (!(name in keys)) unknown.push(`${block}.${layer}: ${name}`);
            }
          }
        }
      }
      expect(unknown).toEqual([]);
    });
  }
});
