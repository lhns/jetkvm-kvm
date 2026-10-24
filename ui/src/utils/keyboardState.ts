import type { KeysDownState } from "@hooks/stores";
import { keys, modifiers } from "@/keyboardMappings";

/** Names of the modifiers and keys the remote currently has held down. */
export function heldKeyNames(state: KeysDownState): string[] {
  const mask = state.modifier || 0;
  const down = state.keys || [];
  const modifierNames = Object.entries(modifiers)
    .filter(([, bit]) => (mask & bit) !== 0)
    .map(([name]) => name);
  const keyNames = Object.entries(keys)
    .filter(([, code]) => down.includes(code))
    .map(([name]) => name);
  return [...modifierNames, ...keyNames];
}

export function anyKeyHeld(state: KeysDownState): boolean {
  return (state.modifier || 0) !== 0 || (state.keys || []).some(k => k !== 0);
}
