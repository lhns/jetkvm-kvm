import { describe, expect, it } from "vitest";

import { HID_RPC_MESSAGE_TYPES, MouseReportMessage } from "./hidRpc";

describe("MouseReportMessage", () => {
  it("marshals signed deltas as two's complement bytes", () => {
    const bytes = new MouseReportMessage(-1, 127, 1).marshal();
    expect(Array.from(bytes)).toEqual([HID_RPC_MESSAGE_TYPES.MouseReport, 0xff, 127, 1]);
  });

  it("rejects deltas outside the int8 range", () => {
    expect(() => new MouseReportMessage(128, 0, 0).marshal()).toThrow();
  });
});
