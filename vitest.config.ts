import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// The app code imports through the "@/..." alias (see tsconfig paths).
// Route tests import the route handlers, so vitest needs the same alias.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${resolve(__dirname, "./")}/`,
      },
    ],
  },
});
