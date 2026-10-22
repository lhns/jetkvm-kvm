import { describe, expect, it } from "vitest";

import { remapWinKey, WIN_KEY_SETTINGS } from "./keyRemap";

describe("remapWinKey", () => {
  it("maps each configured key to MetaLeft", () => {
    for (const key of WIN_KEY_SETTINGS.filter(k => k !== "off")) {
      expect(remapWinKey(key, key)).toBe("MetaLeft");
    }
  });

  it("leaves other keys alone", () => {
    expect(remapWinKey("KeyA", "ScrollLock")).toBe("KeyA");
    expect(remapWinKey("CapsLock", "ScrollLock")).toBe("CapsLock");
    expect(remapWinKey("MetaLeft", "ScrollLock")).toBe("MetaLeft");
  });

  it("does nothing when off", () => {
    expect(remapWinKey("ScrollLock", "off")).toBe("ScrollLock");
  });
});
