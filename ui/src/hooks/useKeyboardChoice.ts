import { useCallback } from "react";

import { useHidStore, useSettingsStore, useUiStore, type KeyboardKind } from "@/hooks/stores";

/** Opens, closes and remembers the two on-screen keyboards. Only touch devices get the System one. */
export default function useKeyboardChoice() {
  const touch = navigator.maxTouchPoints > 0;
  const storedKind = useSettingsStore(s => s.lastKeyboard);
  const setLastKeyboard = useSettingsStore(s => s.setLastKeyboard);
  const isPcOpen = useHidStore(s => s.isVirtualKeyboardEnabled);
  const setPcOpen = useHidStore(s => s.setVirtualKeyboardEnabled);
  const isSystemOpen = useUiStore(s => s.isSystemKeyboardOpen);

  const lastKeyboard: KeyboardKind = touch ? storedKind : "pc";

  const openPc = useCallback(() => {
    useUiStore.getState().systemKeyboardInput?.blur();
    setLastKeyboard("pc");
    setPcOpen(true);
  }, [setLastKeyboard, setPcOpen]);

  // Must run synchronously in the tap: iOS only opens the keyboard from a user gesture.
  const openSystem = useCallback(() => {
    const el = useUiStore.getState().systemKeyboardInput;
    if (!el) return;
    setPcOpen(false);
    setLastKeyboard("system");
    // On Android the field can keep focus with the keyboard hidden; refocusing reopens it.
    if (document.activeElement === el) el.blur();
    el.focus({ preventScroll: true });
  }, [setLastKeyboard, setPcOpen]);

  const toggle = useCallback(() => {
    if (isPcOpen) setPcOpen(false);
    else if (isSystemOpen) useUiStore.getState().systemKeyboardInput?.blur();
    else if (lastKeyboard === "system") openSystem();
    else openPc();
  }, [isPcOpen, isSystemOpen, lastKeyboard, openPc, openSystem, setPcOpen]);

  return {
    touch,
    lastKeyboard,
    openPc,
    openSystem,
    toggle,
  };
}
