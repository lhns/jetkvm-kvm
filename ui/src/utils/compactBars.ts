/** Below this visible height the open keyboard leaves too little room for the page's bars. */
export const SHORT_VIEWPORT_HEIGHT = 520;

/**
 * Whether the status bar and macro bar should give up their height to the page's keyboard.
 * Only the attached keyboard in the page needs it; the fullscreen keyboard overlays the video.
 */
export function shouldCompactBars({
  keyboardOpen,
  viewportHeight,
}: {
  keyboardOpen: boolean;
  viewportHeight: number;
}): boolean {
  return keyboardOpen && viewportHeight < SHORT_VIEWPORT_HEIGHT;
}
