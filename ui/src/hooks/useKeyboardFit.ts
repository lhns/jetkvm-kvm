import { RefObject, useLayoutEffect, useRef } from "react";

import {
  fitKeyHeight,
  isStacked,
  keyboardBudget,
  KeyboardMode,
  MAX_KEY_HEIGHT,
} from "@/utils/keyboardFit";

interface Options {
  /** Element that receives the CSS variables and the `data-kb-stacked` attribute. */
  rootRef: RefObject<HTMLElement | null>;
  /** The scrollable part of the keyboard, below the header. */
  bodyRef: RefObject<HTMLElement | null>;
  /** Marks the attached keyboard's place in the page; its parent is the box it must fit in. */
  anchorRef: RefObject<HTMLElement | null>;
  mode: KeyboardMode;
  /** Rows of keys in the main block. */
  rows: number;
  enabled: boolean;
}

/**
 * Sizes the keyboard to the space it has: writes `--kb-key-h` and `--kb-max-h` on the root and
 * sets `data-kb-stacked` when the available width is too small for side-by-side blocks.
 * Fitting is idempotent (see fitKeyHeight), so observing the keyboard content does not loop.
 */
export default function useKeyboardFit({
  rootRef,
  bodyRef,
  anchorRef,
  mode,
  rows,
  enabled,
}: Options) {
  const keyHeight = useRef(MAX_KEY_HEIGHT);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const body = bodyRef.current;
    if (!enabled || !root || !body) return;

    const update = () => {
      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const box =
        mode === "page" ? anchorRef.current?.parentElement?.getBoundingClientRect() : undefined;
      const width = box?.width ?? viewportWidth;
      const stacked = isStacked(width);

      const budget = keyboardBudget({ mode, boxHeight: box?.height ?? 0, viewportHeight });

      root.toggleAttribute("data-kb-stacked", stacked);
      root.style.setProperty("--kb-max-h", `${budget}px`);
      root.style.setProperty("--kb-key-h", `${keyHeight.current}px`);

      // Natural height: the root's height plus whatever the body scrolls.
      const measuredHeight = root.offsetHeight + body.scrollHeight - body.clientHeight;
      const next = fitKeyHeight({
        budget,
        measuredHeight,
        keyHeight: keyHeight.current,
        rows: rows + (stacked ? 3 : 0),
      });
      if (next !== keyHeight.current) {
        keyHeight.current = next;
        root.style.setProperty("--kb-key-h", `${next}px`);
      }
    };

    update();

    // The surrounding box drives the budget. The keys are drawn after this effect runs and fonts
    // can change their size, so the content is observed too; update() is a no-op once fitted.
    const observer = new ResizeObserver(update);
    const box = mode === "page" ? anchorRef.current?.parentElement : null;
    if (box) observer.observe(box);
    if (body.firstElementChild) observer.observe(body.firstElementChild);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [rootRef, bodyRef, anchorRef, mode, rows, enabled]);
}
