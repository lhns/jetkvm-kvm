const INT8_MAX = 127;

/**
 * Splits a relative mouse movement into reports whose deltas fit the int8 the HID report
 * carries. A zero movement still yields one report so button changes get sent.
 * 300 -> 127, 127, 46.
 */
export function splitInt8Delta(dx: number, dy: number): Array<[number, number]> {
  let rx = Number.isFinite(dx) ? Math.round(dx) : 0;
  let ry = Number.isFinite(dy) ? Math.round(dy) : 0;
  const out: Array<[number, number]> = [];
  do {
    const cx = Math.max(-INT8_MAX, Math.min(INT8_MAX, rx));
    const cy = Math.max(-INT8_MAX, Math.min(INT8_MAX, ry));
    out.push([cx, cy]);
    rx -= cx;
    ry -= cy;
  } while (rx !== 0 || ry !== 0);
  return out;
}
