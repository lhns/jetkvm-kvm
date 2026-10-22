import { describe, expect, it } from "vitest";

import { isLockAllowed } from "./lockPermission";

const answering = (state: string) => ({
  query: async () => ({ state }) as PermissionStatus,
});

describe("isLockAllowed", () => {
  it("allows granted", async () => {
    expect(await isLockAllowed("pointer-lock", answering("granted"))).toBe(true);
  });

  it("tries anyway on prompt", async () => {
    expect(await isLockAllowed("keyboard-lock", answering("prompt"))).toBe(true);
  });

  it("refuses only denied", async () => {
    expect(await isLockAllowed("keyboard-lock", answering("denied"))).toBe(false);
  });

  it("tries anyway when the query throws (Android Blink, Firefox)", async () => {
    const throwing = {
      query: async () => {
        throw new TypeError("unknown permission name");
      },
    };
    expect(await isLockAllowed("pointer-lock", throwing)).toBe(true);
  });

  it("tries anyway without a Permissions API", async () => {
    expect(await isLockAllowed("pointer-lock", undefined)).toBe(true);
  });
});
