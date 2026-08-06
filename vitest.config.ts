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
  esbuild: {
    // Use React 19's automatic JSX runtime so .tsx files using the new
    // transform (no explicit React import) work in vitest without crashing.
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "node",
    // Unit + integration tests live next to the code they cover.
    // scripts/*.test.ts are standalone tsx guards (run via test:env / test:ci-db-safety)
    // and e2e specs are owned by Playwright, so both are excluded here.
    include: [
      "lib/**/*.test.ts",
      "app/**/*.test.ts",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
    ],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "e2e/**",
        "node_modules/**",
        ".next/**",
        "scripts/**",
        "**/*.d.ts",
        "next-env.d.ts",
        "vitest.config.ts",
        "playwright.config.ts",
        "next.config.ts",
        "eslint.config.mjs",
      ],
      // Coverage ratchet: thresholds are set to the coverage measured on
      // 2026-02-04, floored to whole integers. Coverage must never drop below
      // these values; raise the ratchet whenever coverage genuinely improves.
      thresholds: {
        statements: 17,
        branches: 74,
        functions: 44,
        lines: 17,
      },
    },
  },
});
