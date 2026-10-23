import { useEffect, useState } from "react";

/** Height of the visible viewport in CSS px; follows rotation and browser bars. */
export default function useVisibleViewportHeight(): number {
  const read = () => window.visualViewport?.height ?? window.innerHeight;
  const [height, setHeight] = useState(read);

  useEffect(() => {
    const update = () => setHeight(read());
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return height;
}
