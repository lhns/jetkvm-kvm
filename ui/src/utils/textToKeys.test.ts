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
function legacyPaste(text: string, kb: KeyboardLayout, delay = 20): MacroStep[] {
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
  it("types plain, shifted and AltRight characters", () => {
    expect(textToMacroSteps("aB", en)).toEqual([step("KeyA"), step("KeyB", ["ShiftLeft"])]);
    expect(textToMacroSteps("@", de)).toEqual([step("KeyQ", ["AltRight"])]);
  });

  it("sends a dead key followed by Space", () => {
    expect(textToMacroSteps("^", de)).toEqual([step("Backquote"), step("Space")]);
  });

  it("sends the accent first for an accented character", () => {
    expect(textToMacroSteps("ä", de)).toEqual(legacyPaste("ä", de));
    expect(textToMacroSteps("â", fr)).toEqual([step("BracketLeft"), step("KeyQ")]);
  });

  it("matches the pre-extraction paste loop", () => {
    const text = "Hello, World! 123 @^ äöüß âêîô 😀 é\nz";
    for (const kb of [en, de, fr])
      expect(textToMacroSteps(text, kb)).toEqual(legacyPaste(text, kb));
  });

  it("uses the delay it is given", () => {
    expect(textToMacroSteps("a", en, 50)[0].delay).toBe(50);
  });
});

describe("charKeys fallbacks", () => {
  it("types Tab and Enter even if the layout has no entry", () => {
    expect(charKeys("\t", en)).toEqual([{ key: "Tab" }]);
    const noNewline = { ...en, chars: { ...en.chars } };
    delete noNewline.chars["\n"];
    expect(charKeys("\n", noNewline)).toEqual([{ key: "Enter" }]);
  });

  it("uses the layout's own newline when it has one", () => {
    expect(charKeys("\n", de)).toEqual([de.chars["\n"]]);
  });

  it("folds smart punctuation and ellipsis", () => {
    expect(textToMacroSteps("“x”", en)).toEqual(textToMacroSteps('"x"', en));
    expect(textToMacroSteps("’", en)).toEqual(textToMacroSteps("'", en));
    expect(textToMacroSteps("–—", en)).toEqual(textToMacroSteps("--", en));
    expect(textToMacroSteps("…", en)).toEqual(textToMacroSteps("...", en));
    expect(textToMacroSteps("a b", en)).toEqual(textToMacroSteps("a b", en));
  });

  it("keeps a character the layout has", () => {
    expect(hu.chars["„"]).toBeDefined();
    expect(charKeys("„", hu)).toEqual([hu.chars["„"]]);
    expect(charKeys("„", de)).toEqual(charKeys('"', de));
  });

  it("returns nothing for characters it can't type", () => {
    expect(charKeys("😀", en)).toEqual([]);
    expect(charKeys("日", en)).toEqual([]);
  });
});

describe("diffInput", () => {
  it("appends", () => expect(diffInput(" ab", " abc")).toEqual({ removed: "", inserted: "c" }));
  it("deletes", () => expect(diffInput(" abc", " ab")).toEqual({ removed: "c", inserted: "" }));
  it("replaces a word", () =>
    expect(diffInput(" teh ", " the ")).toEqual({
      removed: "eh ",
      inserted: "he ",
    }));
  it("is empty when unchanged", () =>
    expect(diffInput(" ab", " ab")).toEqual({ removed: "", inserted: "" }));
  it("normalizes to NFC", () =>
    expect(diffInput(" é", " é")).toEqual({ removed: "", inserted: "" }));
  it("keeps surrogate pairs whole", () => {
    expect(diffInput(" 😀", " 😁")).toEqual({ removed: "😀", inserted: "😁" });
    expect(diffInput(" a", " a😀")).toEqual({ removed: "", inserted: "😀" });
  });
});

describe("inputToMacroSteps", () => {
  const run = (prev: string, next: string, held = 0, kb = en) =>
    inputToMacroSteps(prev, next, kb, held);

  it("inserts", () => expect(run(" ", " t")).toEqual([step("KeyT")]));

  it("turns the sentinel's deletion into one Backspace", () => expect(run(" ", "")).toEqual([bs]));

  it("replays autocorrect as backspaces plus the corrected tail", () => {
    expect(run(" teh", " the ")).toEqual([bs, bs, step("KeyH"), step("KeyE"), step("Space")]);
  });

  it("types a swiped word", () =>
    expect(run(" the ", " the hello")).toEqual(textToMacroSteps("hello", en)));

  it("swaps a suggestion", () => expect(run(" the hello", " the hell")).toEqual([bs]));

  it("counts no Backspace for skipped characters", () => {
    expect(run(" a😀", " a")).toEqual([]);
  });

  it("counts a folded character by what it typed", () =>
    expect(run(" …", " ")).toEqual([bs, bs, bs]));

  it("sends Enter for a line break", () => expect(run(" a", " a\n")).toEqual([step("Enter")]));

  it("sends nothing when unchanged", () =>
    expect(run(" a", " a", modifiers.ControlLeft)).toEqual([]));

  it("applies a held modifier to the first step only", () => {
    const steps = run(" ", " cd", modifiers.ControlLeft);
    expect(steps).toEqual([step("KeyC", ["ControlLeft"]), step("KeyD")]);
  });

  it("does not turn Shift + a shifted char into AltLeft", () => {
    const [first] = run(" ", " A", modifiers.ShiftLeft);
    expect(first.modifiers).toEqual(["ShiftLeft"]);
    const mask = first.modifiers!.reduce((m, n) => m + modifiers[n], 0);
    expect(mask).toBe(modifiers.ShiftLeft);
  });

  it("does not duplicate AltRight for an AltGr character", () => {
    const [first] = run(" ", " @", modifiers.AltRight, de);
    expect(first.modifiers).toEqual(["AltRight"]);
  });

  it("combines held and own modifiers", () => {
    const [first] = run(" ", " A", modifiers.ControlLeft);
    expect(first.modifiers).toEqual(["ControlLeft", "ShiftLeft"]);
  });
});
