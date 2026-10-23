import { describe, expect, it } from "vitest";

import { en_US } from "@/keyboardLayouts/en_US";

import { keys } from "./keyboardMappings";

describe("Menu key", () => {
  it("is the Application usage (0x65) that Windows honours, not Keyboard Menu (0x76)", () => {
    expect(keys.Menu).toBe(0x65);
    expect(keys.Menu).toBe(keys.ContextMenu);
    expect(keys.Menu).toBe(keys.Application);
  });

  it("is on the virtual keyboard's bottom row", () => {
    expect(en_US.virtualKeyboard.main.default.at(-1)!.split(" ")).toContain("Menu");
  });
});
