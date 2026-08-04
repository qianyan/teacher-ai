# Teacher AI

Teacher AI is a Next.js app that helps early-childhood teachers write and export **biweekly toddler class reports** in Chinese. Teachers fill in a structured workbench (intro, body sections, class name, date range), upload activity photos, and generate a polished HTML report with an optional long-screenshot PNG export. Auth is invite-only via email/password plus passkey login; generated reports are saved to Supabase and drafts are autosaved locally in IndexedDB.

## Who is it for?

- Teachers who need to produce regular, photo-rich class reports for parents.
- Administrators who want a managed, invite-only instance with usage quotas.
- Developers who want a reference Next.js + Supabase setup with local Docker, Vercel CI/CD, and LLM generation.

## Features

- **Template-based report workbench** — editable intro/body, date range, class name, subtitle, and template selection.
- **Photo upload** — drag-and-drop report photos synced to Supabase Storage; exported HTML embeds public URLs.
- **AI generation** — calls OpenAI-compatible or Anthropic LLMs to expand the edited outline into a complete HTML report.
- **HTML preview + long screenshot** — renders the generated report in-browser and exports a PNG using Playwright (local) or E2B (Vercel).
- **Draft persistence** — autosaves the current draft in IndexedDB and keeps a server-side history in Supabase.
- **Invite-only registration** — users register with a single-use invite code; free/pro usage quotas are enforced.
- **Passkey login** — supported through Supabase Auth locally and in production.
- **Environment validation** — every target (`local`, `preview`, `production`) is validated before build or deploy.
- **Automated CI/CD** — GitHub Actions runs lint, tests, preview deploy, smoke tests, DB migrations, and production deploy.

## Tech stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Auth & backend:** Supabase (Auth + Postgres + Storage)
- **LLM:** OpenAI-compatible API or Anthropic Claude
- **Screenshots:** Playwright / `@sparticuz/chromium` locally, optional E2B sandbox on Vercel
- **Deployment:** Vercel
- **Local infra:** Supabase CLI + Docker (Colima or Docker Desktop)

## Project structure

```text
app/                 # Next.js App Router pages
  (auth)/login/      # Login / invite-code registration
  account/           # Account page
  api/               # API routes (generate, auth, history, blob, long-screenshot, webhooks)
components/          # React components (ReportWorkbench, HistorySidebar, etc.)
docs/                # Local development and deployment guides
e2b/                 # E2B sandbox template builder
lib/                 # Domain logic
  agent/             # LLM agent / generation helpers
  auth/              # Passkey and use-me hooks
  db/                # Migration command helpers
  env/               # Environment validation schema
  llm/               # LLM adapters
  persistence/       # Draft + history persistence
  photos/            # Photo upload, HEIC preview, sync guard
  report/            # Report assembly, templates, screenshot runners
  server/            # Server-side Supabase admin, entitlements, invite codes
  supabase/          # Supabase SSR clients and middleware
scripts/             # Provisioning, migration, validation, invite-code utilities
supabase/            # Supabase config, migrations, seed
```

## Prerequisites

- Node.js 20+ and npm
- An LLM API key (OpenAI-compatible, or Anthropic)
- For local Supabase: [Docker](https://docs.docker.com/desktop/) or [Colima](https://github.com/abiosoft/colima) (`brew install colima docker`)
- For Vercel deployments: a Vercel account linked to the project

## Quick start (local)

1. **Install dependencies**

   ```bash
   npm install
   npm run playwright:install
   ```

2. **Add LLM credentials**

   ```bash
   cp .env.local.secrets.example .env.local.secrets
   # Edit .env.local.secrets and add LLM_API_KEY
   ```

3. **Provision the local Supabase stack**

   ```bash
   npm run provision:local
   ```

   This starts Supabase in Docker, applies migrations, creates the `report-photos` bucket, and generates `.env.local`.

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The local bootstrap invite code is `LOCAL-DEV-01` (single-use).

## Scripts

### Development

| Command         | Purpose                      |
| --------------- | ---------------------------- |
| `npm run dev`   | Start the Next.js dev server |
| `npm run build` | Production build             |
| `npm run start` | Start the production server  |
| `npm run lint`  | Run ESLint                   |

### Environment validation

| Command                           | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `npm run prepare:local`           | Validate `.env.local` and run env schema tests    |
| `npm run verify:local`            | Validate `.env.local` and run a production build  |
| `npm run prepare:preview`         | Pull Vercel preview env and validate it           |
| `npm run verify:preview`          | Prepare preview env and run a production build    |
| `npm run prepare:production`      | Pull Vercel production env and validate it        |
| `npm run verify:production`       | Prepare production env and run a production build |
| `npm run env:validate:local`      | Validate `.env.local` explicitly                  |
| `npm run env:validate:preview`    | Validate preview env explicitly                   |
| `npm run env:validate:production` | Validate production env explicitly                |
| `npm run test:env`                | Run the environment validation test suite         |
| `npm run test:ci-db-safety`       | Ensure CI cannot run remote database resets       |

### Testing

| Command                 | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `npm run test`          | Run all Vitest unit + integration tests once                |
| `npm run test:coverage` | Run Vitest with coverage and enforce the ratchet thresholds |
| `npm run test:watch`    | Run Vitest in watch mode                                    |
| `npm run test:unit`     | Alias for `npm run test`                                    |
| `npm run test:e2e`      | Run Playwright end-to-end tests (boots dev server)          |
| `npm run e2e:install`   | Install the Chromium browser for Playwright                 |

Vitest covers pure domain logic (`lib/env`, `lib/report`, `lib/photos`, `lib/llm`, `lib/db`), integration paths with a mocked Supabase admin client (`lib/server/invite-codes`, `app/api/auth/register`), and component rendering tests (`components/*.test.tsx`). The two original standalone guards — `npm run test:env` and `npm run test:ci-db-safety` — remain as `tsx` scripts.

Playwright e2e boots the Next.js dev server with dummy Supabase credentials that point at nothing; the public `/login` page renders without a running Docker stack. Flows that need a real backend (generate, history) are covered by the preview smoke test (`npm run smoke:preview`) instead.

### Local infrastructure

| Command                     | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `npm run provision:local`   | Start local Docker Supabase, migrate, and generate `.env.local` |
| `npm run supabase:start`    | Start the local Supabase containers                             |
| `npm run supabase:stop`     | Stop the local Supabase containers                              |
| `npm run supabase:status`   | Show local Supabase URLs and keys                               |
| `npm run db:migrate:local`  | Apply pending migrations to the local database                  |
| `npm run db:reset:local`    | **Wipe** local data and re-run migrations                       |
| `npm run db:migrate:remote` | Push migrations to the linked remote Supabase project           |

### Auth & invites

| Command                                                         | Purpose                         |
| --------------------------------------------------------------- | ------------------------------- |
| `npx tsx scripts/create-invite-code.ts`                         | Create a single-use invite code |
| `npx tsx scripts/create-invite-codes-batch.ts 20 "Cohort name"` | Create a batch of codes         |

### Screenshots & cleanup

| Command                                 | Purpose                                         |
| --------------------------------------- | ----------------------------------------------- |
| `npm run smoke:preview`                 | Run a smoke test against `PREVIEW_URL`          |
| `npm run e2b:build-template`            | Build the E2B long-screenshot template          |
| `npm run photos:cleanup-orphans`        | List orphaned report photos in Supabase Storage |
| `npm run photos:cleanup-orphans:delete` | Delete orphaned report photos                   |

### Deployment

| Command                     | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `npm run deploy:preview`    | Validate and deploy to Vercel preview    |
| `npm run deploy:production` | Validate and deploy to Vercel production |

## Environment variables

Environment variables are validated against `lib/env/schema.ts`. Key files:

- `.env.example` — full reference of all variables.
- `.env.local.secrets.example` — only the LLM credentials used locally.
- `.env.local` — generated by `npm run provision:local`; never commit.
- `.vercel/.env.*.local` — pulled by `vercel pull`; never commit.

### Required for local development

- `LLM_PROVIDER` — `openai_compatible` or `anthropic`
- `LLM_API_KEY` or provider-specific key. For `openai_compatible`: `OPENAI_API_KEY`, `DASHSCOPE_API_KEY`, `ZHIPUAI_API_KEY`, `MOONSHOT_API_KEY`, or `MINIMAX_API_KEY`. For `anthropic`: `ANTHROPIC_API_KEY`.
- `LLM_MODEL` — model ID, e.g. `gpt-4o-mini`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — generated by `provision:local`

### Required for preview / production

All local variables plus the Supabase variables must be set in Vercel. Optional but paired:

- `E2B_API_KEY` and `E2B_LONG_SCREENSHOT_TEMPLATE` — must be set together or omitted together.

See [`docs/local-development.md`](./docs/local-development.md) and [`docs/deployment.md`](./docs/deployment.md) for the full environment setup.

## Health check & error tracking

- `GET /health` returns `200 { "status": "ok", "timestamp": "..." }` with no database or auth checks (whitelisted in the middleware for uptime probes).
- Sentry error tracking activates when `SENTRY_DSN` is configured (local `.env.local`, Vercel env); without it the SDK is a no-op. `SENTRY_AUTH_TOKEN` is only needed at build time for source map upload.

## Common workflows

### Switch from local to remote Supabase

If you previously used the shared remote project locally, restore the backed-up env:

```bash
cp .env.local.remote.bak .env.local
```

Or pull the preview env from Vercel:

```bash
npm run env:pull:preview
# Then point Next at .vercel/.env.preview.local
```

### Create a new invite code

```bash
npx tsx scripts/create-invite-code.ts
# Or with a custom code and note
npx tsx scripts/create-invite-code.ts SPRING-2026-A "Teacher Zhang"
```

### Upgrade a user to Pro

Until payment webhooks are wired, run SQL against the target database:

```sql
update public.profiles set plan = 'pro' where id = '<user-uuid>';
```

## CI/CD

Automated preview and production deploys are driven by [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). See [`docs/deployment.md`](./docs/deployment.md) for the full pipeline, required secrets, and branch protections.

## Documentation

- [`docs/local-development.md`](./docs/local-development.md) — isolated Docker Supabase setup, daily commands, troubleshooting.
- [`docs/deployment.md`](./docs/deployment.md) — preview/production deployment, invite codes, GitHub Actions, secrets.

## License

This project is private and not licensed for redistribution.
