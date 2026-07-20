import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT || "3000";
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E tests boot the Next.js dev server with dummy Supabase credentials that
 * point at nothing. The Supabase clients swallow the connection errors and
 * return `user: null`, so the public /login page renders without a running
 * Docker stack. Flows that need a real backend (generate, history) are covered
 * by unit/integration tests and the preview smoke test instead.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
      LLM_PROVIDER: "openai_compatible",
      LLM_API_KEY: "e2e",
      LLM_MODEL: "gpt-4o-mini",
    },
  },
});
