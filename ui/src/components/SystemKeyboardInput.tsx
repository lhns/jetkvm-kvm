import { useEffect, useRef } from "react";

import { useHidStore, useUiStore } from "@hooks/stores";
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

/**
 * Hidden field that opens the OS keyboard. Every input event is diffed against the previous value
 * and sent as Backspaces plus the inserted text through the Paste text key mapping, so
 * autocorrect, suggestions, swipe and dictation work without looking at `inputType`.
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
    const { setSystemKeyboardInput, setSystemKeyboardOpen } = useUiStore.getState();
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
      const steps = inputToMacroSteps(
        prev,
        next,
        selectedKeyboard,
        useHidStore.getState().keysDownState.modifier,
      );
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
    const checkViewport = () => {
      if (!vv) return;
      if (window.innerWidth !== width) {
        width = window.innerWidth; // rotation
        maxHeight = vv.height;
        keyboardShown = false;
      }
      maxHeight = Math.max(maxHeight, vv.height);
      if (document.activeElement !== el) return;
      if (vv.height < maxHeight - KEYBOARD_SHOWN_PX) keyboardShown = true;
      else if (keyboardShown && vv.height > maxHeight - KEYBOARD_GONE_PX) el.blur();
    };

    const onFocus = () => {
      reset();
      setSystemKeyboardOpen(true);
      // The viewport may still be shrunk from the keyboard that was just refocused.
      checkViewport();
    };
    const onBlur = () => {
      composing = false;
      keyboardShown = false;
      reset();
      setSystemKeyboardOpen(false);
    };
    const onCompositionStart = () => {
      composing = true;
    };
    const onCompositionEnd = () => {
      composing = false;
      maybeReset();
    };

    el.addEventListener("input", onInput);
    el.addEventListener("focus", onFocus);
    el.addEventListener("blur", onBlur);
    el.addEventListener("compositionstart", onCompositionStart);
    el.addEventListener("compositionend", onCompositionEnd);
    document.addEventListener("selectionchange", pinCaret);
    vv?.addEventListener("resize", checkViewport);
    reset();

    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("focus", onFocus);
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("compositionstart", onCompositionStart);
      el.removeEventListener("compositionend", onCompositionEnd);
      document.removeEventListener("selectionchange", pinCaret);
      vv?.removeEventListener("resize", checkViewport);
      setSystemKeyboardInput(null);
      setSystemKeyboardOpen(false);
    };
  }, []);

  // The PC keyboard replaces this one; its own close button needs no knowledge of the field.
  useEffect(() => {
    if (isPcKeyboardOpen && document.activeElement === ref.current) ref.current?.blur();
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
