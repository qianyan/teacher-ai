import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    environment: "node",
    // Unit + integration tests live next to the code they cover.
    // scripts/*.test.ts are standalone tsx guards (run via test:env / test:ci-db-safety)
    // and e2e specs are owned by Playwright, so both are excluded here.
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
