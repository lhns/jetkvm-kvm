import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests skip the paraglide/tailwind plugins.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
