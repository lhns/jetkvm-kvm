// Blank tokens in a layout row (e.g. de_DE's "Escape  F1") render as spacer buttons named "".
export const isGapKey = (key: string) => key.trim() === "";
