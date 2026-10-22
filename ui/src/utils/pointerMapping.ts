// Maps between client (CSS pixel) coordinates and the remote screen. The <video> uses
// object-fit: contain, so the stream may be letterboxed or pillarboxed inside its element.

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  left: number;
  top: number;
}

export interface DisplayArea extends Size {
  offsetX: number;
  offsetY: number;
}

export const HID_ABS_MAX = 32767;

/** The part of the element that shows video, relative to the element's top-left. */
export function videoDisplayArea(
  element: Size,
  streamWidth: number,
  streamHeight: number,
): DisplayArea {
  const area: DisplayArea = {
    width: element.width,
    height: element.height,
    offsetX: 0,
    offsetY: 0,
  };
  if (!(element.width > 0 && element.height > 0 && streamWidth > 0 && streamHeight > 0)) {
    return area;
  }
  const elementRatio = element.width / element.height;
  const streamRatio = streamWidth / streamHeight;
  if (elementRatio > streamRatio) {
    // Pillarbox: bars left and right.
    area.width = element.height * streamRatio;
    area.offsetX = (element.width - area.width) / 2;
  } else if (elementRatio < streamRatio) {
    // Letterbox: bars top and bottom.
    area.height = element.width / streamRatio;
    area.offsetY = (element.height - area.height) / 2;
  }
  return area;
}

/** True when the point lies in a black bar rather than on the video. */
export function isInBlackBar(
  clientX: number,
  clientY: number,
  rect: Rect,
  streamWidth: number,
  streamHeight: number,
): boolean {
  const a = videoDisplayArea(rect, streamWidth, streamHeight);
  const x = clientX - rect.left - a.offsetX;
  const y = clientY - rect.top - a.offsetY;
  return x < 0 || y < 0 || x > a.width || y > a.height;
}

/**
 * Client point -> position on the remote screen as fractions 0..1, clamped to the video
 * area. Null while the element or stream has no size.
 */
export function streamFromClient(
  clientX: number,
  clientY: number,
  rect: Rect,
  streamWidth: number,
  streamHeight: number,
): { nx: number; ny: number } | null {
  if (!(rect.width > 0 && rect.height > 0 && streamWidth > 0 && streamHeight > 0)) return null;
  const a = videoDisplayArea(rect, streamWidth, streamHeight);
  const x = Math.min(Math.max(clientX - rect.left - a.offsetX, 0), a.width);
  const y = Math.min(Math.max(clientY - rect.top - a.offsetY, 0), a.height);
  return { nx: x / a.width, ny: y / a.height };
}

/** Inverse of streamFromClient: a 0..1 position on the remote screen -> client point. */
export function clientFromStream(
  nx: number,
  ny: number,
  rect: Rect,
  streamWidth: number,
  streamHeight: number,
): { clientX: number; clientY: number } {
  const a = videoDisplayArea(rect, streamWidth, streamHeight);
  return {
    clientX: rect.left + a.offsetX + nx * a.width,
    clientY: rect.top + a.offsetY + ny * a.height,
  };
}

/** Fraction 0..1 -> HID absolute coordinate 0..32767. */
export const hidFromNormalized = (n: number) =>
  Math.round(Math.min(Math.max(n, 0), 1) * HID_ABS_MAX);

export const normalizedFromHid = (v: number) => Math.min(Math.max(v, 0), HID_ABS_MAX) / HID_ABS_MAX;
