# E2B template: long screenshot

Runs Playwright + stock Chromium inside an E2B sandbox so Vercel does not need `@sparticuz/chromium`.

## Build (one-off, from your machine)

1. Create an API key in the [E2B dashboard](https://e2b.dev/docs).
2. `export E2B_API_KEY=e2b_...`
3. Optional: `export E2B_TEMPLATE_NAME=my-team-long-screenshot` (default: `teacher-ai-long-screenshot`).
4. From repo root: `npx tsx e2b/build-template.ts`

## Deploy

In Vercel project env:

- `E2B_API_KEY` — same key (server-only).
- `E2B_LONG_SCREENSHOT_TEMPLATE` — the template **name** you built (e.g. `teacher-ai-long-screenshot` or your custom `E2B_TEMPLATE_NAME`).

When both are set, `POST /api/long-screenshot` uses E2B. Otherwise it uses in-process Playwright (local) or `@sparticuz/chromium` on Vercel when E2B is not configured.
