import { useMouseStore, useVideoStore } from "@hooks/stores";
import { clientFromStream, normalizedFromHid } from "@/utils/pointerMapping";

/**
 * Ring at the touchpad cursor, so you see where the next tap lands. Lives inside the
 * fullscreen container, whose box is the video element's.
 */
export default function TouchCursorMarker({ visible }: { visible: boolean }) {
  const { mouseX, mouseY } = useMouseStore();
  const { width, height, clientWidth, clientHeight } = useVideoStore();
  if (!visible || !clientWidth || !clientHeight) return null;

  const { clientX, clientY } = clientFromStream(
    normalizedFromHid(mouseX),
    normalizedFromHid(mouseY),
    { left: 0, top: 0, width: clientWidth, height: clientHeight },
    width,
    height,
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-blue-500/30 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
      style={{ left: clientX, top: clientY }}
    />
  );
}
