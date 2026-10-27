import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";

import { useHidStore, useSettingsStore, useUiStore } from "@hooks/stores";
import useKeyboard from "@hooks/useKeyboard";
import useKeyboardLayout from "@hooks/useKeyboardLayout";
import { m } from "@localizations/messages.js";
import { inputToMacroSteps } from "@/utils/textToKeys";

// The field is never empty, so a Backspace always changes its value (IMEs disagree on what an
// empty-field Backspace sends). One character: a word-delete gesture must not become many.
const SENTINEL = " ";
// Reset at a word boundary past the soft length so autocorrect keeps the current word as context.
const SOFT_RESET_LENGTH = 32;
const HARD_RESET_LENGTH = 64;
// Android hides the IME without blurring; the visual viewport growing back is the only sign.
const KEYBOARD_SHOWN_PX = 120;
const KEYBOARD_GONE_PX = 60;

// Must run synchronously in the tap: iOS only opens the keyboard from a user gesture.
export function openSystemKeyboard() {
  const { systemKeyboardInput: el, setSystemKeyboardFocused } = useUiStore.getState();
  if (!el) return;
  // On Android the field can keep focus with the keyboard hidden; refocusing reopens it.
  if (document.activeElement === el) el.blur();
  // The FocusTrap only pauses on re-render; unflushed, it would refocus its button on focusin.
  flushSync(() => setSystemKeyboardFocused(true));
  el.focus({ preventScroll: true });
}

/**
 * Hidden field that opens the OS keyboard. Every input event is diffed against the previous value
 * and sent as Backspaces plus the inserted text, so autocorrect, suggestions, swipe and dictation
 * work without looking at `inputType`.
 */
export default function SystemKeyboardInput() {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { executeMacro } = useKeyboard();
  const { selectedKeyboard } = useKeyboardLayout();
  const isPcKeyboardOpen = useHidStore(s => s.isVirtualKeyboardEnabled);
  const latest = useRef({ executeMacro, selectedKeyboard });
  latest.current = { executeMacro, selectedKeyboard };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { setSystemKeyboardInput } = useUiStore.getState();
    setSystemKeyboardInput(el);

    // This effect owns the value and `prev`: a programmatic set fires no `input` event.
    let prev = SENTINEL;
    let composing = false;
    let queue = Promise.resolve();

    const reset = () => {
      el.value = SENTINEL;
      el.setSelectionRange(SENTINEL.length, SENTINEL.length);
      prev = SENTINEL;
    };

    const maybeReset = () => {
      if (composing) return; // rewriting the value mid-composition breaks IMEs
      const v = el.value;
      if (
        v === "" ||
        v.length > HARD_RESET_LENGTH ||
        (v.length > SOFT_RESET_LENGTH && /[ \n]$/.test(v))
      )
        reset();
    };

    const onInput = () => {
      const next = el.value;
      const { executeMacro, selectedKeyboard } = latest.current;
      const held = useHidStore.getState().keysDownState.modifier;
      const steps = inputToMacroSteps(prev, next, selectedKeyboard, held);
      prev = next;
      if (steps.length > 0) {
        // Serialized so the legacy client-side path doesn't interleave macros.
        queue = queue.then(() => executeMacro(steps)).catch(e => console.error(e));
      }
      maybeReset();
    };

    // Gboard space-bar cursor moves would put the caret where the diff doesn't expect it.
    const pinCaret = () => {
      if (document.activeElement !== el || composing) return;
      const end = el.value.length;
      if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end);
    };

    // Running maximum of the visual viewport height ~ the height without the keyboard.
    const vv = window.visualViewport;
    let maxHeight = vv?.height ?? 0;
    let width = window.innerWidth;
    let keyboardShown = false;
    const resetBaseline = () => {
      if (!vv) return;
      maxHeight = vv.height;
      keyboardShown = false;
    };
    const checkViewport = () => {
      if (!vv) return;
      if (window.innerWidth !== width) {
        width = window.innerWidth; // rotation
        resetBaseline();
      }
      maxHeight = Math.max(maxHeight, vv.height);
      if (document.activeElement !== el) return;
      if (vv.height < maxHeight - KEYBOARD_SHOWN_PX) keyboardShown = true;
      else if (keyboardShown && vv.height > maxHeight - KEYBOARD_GONE_PX) el.blur();
    };

    const onFocus = () => {
      useUiStore.getState().setSystemKeyboardFocused(true);
      reset();
      useHidStore.getState().setVirtualKeyboardEnabled(false);
      useSettingsStore.getState().setLastKeyboard("system");
      // The viewport may still be shrunk from the keyboard that was just refocused.
      checkViewport();
    };
    const onBlur = () => {
      useUiStore.getState().setSystemKeyboardFocused(false);
      composing = false;
      keyboardShown = false;
      reset();
    };
    const onCompositionEnd = () => {
      composing = false;
      maybeReset();
    };

    const abort = new AbortController();
    const { signal } = abort;
    el.addEventListener("input", onInput, { signal });
    el.addEventListener("focus", onFocus, { signal });
    el.addEventListener("blur", onBlur, { signal });
    el.addEventListener("compositionstart", () => (composing = true), { signal });
    el.addEventListener("compositionend", onCompositionEnd, { signal });
    document.addEventListener("selectionchange", pinCaret, { signal });
    vv?.addEventListener("resize", checkViewport, { signal });
    // The system bars hiding or showing jumps the height without a keyboard change: a stale
    // baseline would blur the field (or break Back detection) afterwards.
    document.addEventListener("fullscreenchange", resetBaseline, { signal });
    document.addEventListener("webkitfullscreenchange", resetBaseline, { signal });

    return () => {
      abort.abort();
      setSystemKeyboardInput(null);
      useUiStore.getState().setSystemKeyboardFocused(false);
    };
  }, []);

  // The PC keyboard replaces this one; its own close button needs no knowledge of the field.
  useEffect(() => {
    if (!isPcKeyboardOpen) return;
    useSettingsStore.getState().setLastKeyboard("pc");
    ref.current?.blur();
  }, [isPcKeyboardOpen]);

  // Keys typed here must not reach the document handler, which forwards by `e.code` and
  // prevents default on every keydown (that would also suppress text on iOS).
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div onKeyDown={stop} onKeyUp={stop} onKeyDownCapture={stop} onKeyUpCapture={stop}>
      {/* Not tabIndex=-1 or disabled: Headless UI's menu would then refocus its own button and
          close the keyboard. opacity-0 rather than hidden, which iOS refuses to focus. text-base
          stops the iOS focus zoom. Top-left, so iOS has nothing to scroll into view. */}
      <textarea
        ref={ref}
        aria-label={m.keyboard_system()}
        inputMode="text"
        enterKeyHint="enter"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        rows={1}
        className="pointer-events-none absolute top-0 left-0 size-px resize-none overflow-hidden border-0 p-0 text-base caret-transparent opacity-0"
      />
    </div>
  );
}
