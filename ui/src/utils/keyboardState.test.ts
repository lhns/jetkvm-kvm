import { describe, expect, it } from "vitest";

import { keys, modifiers } from "@/keyboardMappings";

import { anyKeyHeld, heldKeyNames } from "./keyboardState";

const none = [0, 0, 0, 0, 0, 0];

describe("heldKeyNames", () => {
  it.each([
    ["nothing", { modifier: 0, keys: none }, []],
    [
      "modifiers",
      { modifier: modifiers.ControlLeft | modifiers.ShiftLeft, keys: none },
      ["ControlLeft", "ShiftLeft"],
    ],
    // AltGr is a separate key on the virtual keyboard and must light up too.
    ["AltRight as AltGr", { modifier: modifiers.AltRight, keys: none }, ["AltGr", "AltRight"]],
    ["keys", { modifier: 0, keys: [keys.KeyA, 0, 0, 0, 0, 0] }, ["KeyA"]],
  ])("%s", (_, state, expected) => {
    expect(heldKeyNames(state).sort()).toEqual(expected);
  });
});

describe("anyKeyHeld", () => {
  it("is true only while a modifier or key is down", () => {
    expect(anyKeyHeld({ modifier: 0, keys: none })).toBe(false);
    expect(anyKeyHeld({ modifier: modifiers.MetaLeft, keys: none })).toBe(true);
    expect(anyKeyHeld({ modifier: 0, keys: [0, keys.KeyA, 0, 0, 0, 0] })).toBe(true);
  });
});
