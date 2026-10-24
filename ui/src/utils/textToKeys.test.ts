import { describe, expect, it } from "vitest";

import type { MacroStep } from "@/hooks/useKeyboard";
import { keyboards, type KeyboardLayout } from "@/keyboardLayouts";
import { modifiers } from "@/keyboardMappings";

import { charKeys, diffInput, inputToMacroSteps, textToMacroSteps } from "./textToKeys";

const layout = (iso: string) => keyboards.find(k => k.isoCode === iso) as KeyboardLayout;
const en = layout("en-US");
const fr = layout("fr-FR");
const de = layout("de-DE");
const hu = layout("hu-HU");

const step = (key: string, mods: string[] | null = null): MacroStep => ({
  keys: [key],
  modifiers: mods,
  delay: 20,
});
const bs = step("Backspace");

// The loop PasteModal had before the extraction.
function legacyPaste(text: string, kb: KeyboardLayout, delay: number): MacroStep[] {
  const out: MacroStep[] = [];
  for (const char of text) {
    const keyprops = kb.chars[char.normalize("NFC")];
    if (!keyprops) continue;
    const { key, shift, altRight, deadKey, accentKey } = keyprops;
    if (!key) continue;
    if (accentKey) {
      const accentModifiers: string[] = [];
      if (accentKey.shift) accentModifiers.push("ShiftLeft");
      if (accentKey.altRight) accentModifiers.push("AltRight");
      out.push({
        keys: [String(accentKey.key)],
        modifiers: accentModifiers.length > 0 ? accentModifiers : null,
        delay,
      });
    }
    const mods: string[] = [];
    if (shift) mods.push("ShiftLeft");
    if (altRight) mods.push("AltRight");
    out.push({
      keys: [String(key)],
      modifiers: mods.length > 0 ? mods : null,
      delay,
    });
    if (deadKey) out.push({ keys: ["Space"], modifiers: null, delay });
  }
  return out;
}

describe("textToMacroSteps", () => {
  // Shifted, AltRight (@ on de), dead key (^ on de), accent first (â on fr), untypeable emoji.
  it.each([en, de, fr])("matches the pre-extraction paste loop on $isoCode", kb => {
    const text = "Hello, World! 123 @^ äöüß âêîô 😀 é\nz";
    expect(textToMacroSteps(text, kb, 50)).toEqual(legacyPaste(text, kb, 50));
  });
});

describe("charKeys fallbacks", () => {
  it("types Tab, which no layout has", () => expect(charKeys("\t", en)).toEqual([{ key: "Tab" }]));

  it.each([
    ["“x”", '"x"'],
    ["’", "'"],
    ["–—", "--"],
    ["…", "..."],
    ["a b", "a b"],
  ])("folds %s", (text, folded) =>
    expect(textToMacroSteps(text, en)).toEqual(textToMacroSteps(folded, en)),
  );

  it("folds only when the layout lacks the character", () => {
    expect(charKeys("„", hu)).toEqual([hu.chars["„"]]);
    expect(charKeys("„", de)).toEqual(charKeys('"', de));
  });

  it("returns nothing for characters it can't type", () => expect(charKeys("😀", en)).toEqual([]));
});

describe("diffInput", () => {
  it.each([
    ["appends", " ab", " abc", "", "c"],
    ["deletes", " abc", " ab", "c", ""],
    ["replaces a word", " teh ", " the ", "eh ", "he "],
    ["is empty when unchanged", " ab", " ab", "", ""],
    ["normalizes to NFC", " é", " é", "", ""],
    ["keeps surrogate pairs whole", " 😀", " 😁", "😀", "😁"],
  ])("%s", (_, prev, next, removed, inserted) =>
    expect(diffInput(prev, next)).toEqual({ removed, inserted }),
  );
});

describe("inputToMacroSteps", () => {
  it.each([
    ["inserts", " ", " t", [step("KeyT")]],
    ["turns the sentinel's deletion into one Backspace", " ", "", [bs]],
    ["replays autocorrect", " teh", " the ", [bs, bs, step("KeyH"), step("KeyE"), step("Space")]],
    ["types a swiped word", " the ", " the hi", [step("KeyH"), step("KeyI")]],
    ["swaps a suggestion", " the hello", " the hell", [bs]],
    ["counts no Backspace for a skipped character", " a😀", " a", []],
    ["counts a folded character by what it typed", " …", " ", [bs, bs, bs]],
    ["sends Enter for a line break", " a", " a\n", [step("Enter")]],
  ])("%s", (_, prev, next, steps) => expect(inputToMacroSteps(prev, next, en, 0)).toEqual(steps));

  it("applies a held modifier to the first step only", () =>
    expect(inputToMacroSteps(" ", " cd", en, modifiers.ControlLeft)).toEqual([
      step("KeyC", ["ControlLeft"]),
      step("KeyD"),
    ]));

  it("sends nothing when unchanged, even with a held modifier", () =>
    expect(inputToMacroSteps(" a", " a", en, modifiers.ControlLeft)).toEqual([]));

  it.each([
    ["does not double Shift for a shifted char", "A", en, "ShiftLeft", ["ShiftLeft"]],
    ["does not double AltRight for an AltGr char", "@", de, "AltRight", ["AltRight"]],
    ["combines held and own modifiers", "A", en, "ControlLeft", ["ControlLeft", "ShiftLeft"]],
  ])("%s", (_, char, kb, held, expected) =>
    expect(inputToMacroSteps(" ", ` ${char}`, kb, modifiers[held])[0].modifiers).toEqual(expected),
  );
});
