# E2B template: long screenshot

Runs Playwright + stock Chromium inside an E2B sandbox so Vercel does not need `@sparticuz/chromium`.

## Build (one-off, from your machine)

1. Create an API key in the [E2B dashboard](https://e2b.dev/docs).
2. `export E2B_API_KEY=e2b_...`
3. Optional: `export E2B_TEMPLATE_NAME=my-team-long-screenshot` (default: `teacher-ai-long-screenshot`).
4. From repo root: `npx tsx e2b/build-template.ts`

After changing `e2b/template.ts` or `e2b/template-app/`, rebuild the template so sandboxes pick up Playwright browsers at `/app/ms-playwright`.

## Deploy

In Vercel project env:

- `E2B_API_KEY` — same key (server-only).
- `E2B_LONG_SCREENSHOT_TEMPLATE` — the template **name** you built (e.g. `teacher-ai-long-screenshot` or your custom `E2B_TEMPLATE_NAME`).

When both are set, `POST /api/long-screenshot` orchestrates an E2B sandbox via the [documented HTTP APIs](https://e2b.dev/docs/api-reference/sandboxes/create-sandbox) (`fetch` to `api.e2b.app` and `sandbox.e2b.app`), not the `e2b` npm SDK inside the Vercel function. Otherwise it uses in-process Playwright (local) or `@sparticuz/chromium` on Vercel when E2B is not configured.
