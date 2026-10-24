import { expect, it } from "vitest";

import { keys } from "./keyboardMappings";

it("Menu sends the Application usage, like ContextMenu", () => {
  expect(keys.Menu).toBe(keys.ContextMenu);
});
