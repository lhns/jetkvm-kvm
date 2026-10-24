// Text to HID key steps, shared by Paste text and the System keyboard. DOM-free and importing
// only `@/` paths so it runs under vitest's node environment.
import type { MacroStep } from "@/hooks/useKeyboard";
import type { KeyboardLayout, KeyCombo } from "@/keyboardLayouts";
import { modifiers } from "@/keyboardMappings";

export const DEFAULT_KEY_DELAY = 20;

// Typed instead when the layout has no key for the character, e.g. iOS smart punctuation.
const FALLBACKS: Record<string, string> = {
  "“": '"',
  "”": '"',
  "„": '"',
  "‘": "'",
  "’": "'",
  "–": "-",
  "—": "-",
  "…": "...",
  " ": " ",
};

const MODIFIER_NAMES = [
  "ControlLeft",
  "ShiftLeft",
  "AltLeft",
  "MetaLeft",
  "ControlRight",
  "ShiftRight",
  "AltRight",
  "MetaRight",
];

/** Key combos that type `c`; empty when the layout can't. More than one for folded characters. */
export function charKeys(c: string, layout: KeyboardLayout): KeyCombo[] {
  const char = c.normalize("NFC");
  const combo = layout.chars[char];
  if (combo?.key) return [combo];
  if (char === "\n") return [{ key: "Enter" }];
  if (char === "\t") return [{ key: "Tab" }];
  const folded = FALLBACKS[char];
  if (!folded) return [];
  return Array.from(folded).flatMap(f => (layout.chars[f]?.key ? [layout.chars[f]] : []));
}

function comboSteps(combo: KeyCombo, delay: number): MacroStep[] {
  const steps: MacroStep[] = [];
  const step = (info: { key: string | number; shift?: boolean; altRight?: boolean }) => {
    const mods: string[] = [];
    if (info.shift) mods.push("ShiftLeft");
    if (info.altRight) mods.push("AltRight");
    steps.push({
      keys: [String(info.key)],
      modifiers: mods.length > 0 ? mods : null,
      delay,
    });
  };

  // An accented character needs its accent key first.
  if (combo.accentKey) step(combo.accentKey);
  step(combo);
  // A dead key needs an unmodified space to emit just the accent character.
  if (combo.deadKey) steps.push({ keys: ["Space"], modifiers: null, delay });
  return steps;
}

export function textToMacroSteps(
  text: string,
  layout: KeyboardLayout,
  delay = DEFAULT_KEY_DELAY,
): MacroStep[] {
  return Array.from(text).flatMap(char => {
    const combos = charKeys(char, layout);
    if (combos.length === 0) console.debug("No key for character, skipped:", char);
    return combos.flatMap(combo => comboSteps(combo, delay));
  });
}

/** Common-prefix diff by code point. The System keyboard keeps its caret at the end. */
export function diffInput(prev: string, next: string): { removed: string; inserted: string } {
  const a = Array.from(prev.normalize("NFC"));
  const b = Array.from(next.normalize("NFC"));
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  return { removed: a.slice(p).join(""), inserted: b.slice(p).join("") };
}

/**
 * Backspaces for the removed text, then the inserted text. `heldModifier` (sticky modifiers, as
 * a mask) rides on the first step; names are deduplicated through the mask because
 * `executeMacro` adds the masks, so AltRight + AltGr would otherwise become AltLeft.
 */
export function inputToMacroSteps(
  prev: string,
  next: string,
  layout: KeyboardLayout,
  heldModifier: number,
  delay = DEFAULT_KEY_DELAY,
): MacroStep[] {
  const { removed, inserted } = diffInput(prev, next);
  // Count what the remote actually received: nothing for skipped characters, 3 for "…".
  const backspaces = Array.from(removed).reduce((n, c) => n + charKeys(c, layout).length, 0);
  const steps: MacroStep[] = [
    ...Array.from({ length: backspaces }, () => ({
      keys: ["Backspace"],
      modifiers: null,
      delay,
    })),
    ...textToMacroSteps(inserted, layout, delay),
  ];

  if (heldModifier && steps.length > 0) {
    const mask = (steps[0].modifiers ?? []).reduce((m, name) => m | modifiers[name], heldModifier);
    steps[0] = {
      ...steps[0],
      modifiers: MODIFIER_NAMES.filter(name => mask & modifiers[name]),
    };
  }
  return steps;
}
