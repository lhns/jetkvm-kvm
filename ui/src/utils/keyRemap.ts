export const WIN_KEY_SETTINGS = ["off", "ScrollLock", "CapsLock", "ContextMenu"] as const;
export type WinKeySetting = (typeof WIN_KEY_SETTINGS)[number];

/**
 * Maps the key the owner picked as "Win" to MetaLeft. Held while the key is held, so
 * chords like ScrollLock+Shift+Right reach the remote as Win+Shift+Right. Browsers and
 * some OSes (Android) never deliver the real Win key to a page.
 */
export function remapWinKey(code: string, setting: string): string {
  return setting !== "off" && code === setting ? "MetaLeft" : code;
}
