# Deployment Guide

This project supports three deployment targets: `local`, `preview`, and `production`.

## Targets

| Target | Purpose | Required validation |
| --- | --- | --- |
| `local` | Developer machine using `.env.local` | LLM credentials and env schema tests |
| `preview` | Vercel preview deployment | Vercel preview env pull, env schema validation, Next build |
| `production` | Vercel production deployment | Vercel production env pull, strict env schema validation, Next build |

## Local

Local development uses an **isolated Supabase stack in Docker**, separate from preview/production. See [local-development.md](./local-development.md) for the full guide.

First-time setup:

```bash
cp .env.local.secrets.example .env.local.secrets   # add LLM_API_KEY
npm run provision:local
```

Prepare local development (validate existing `.env.local`):

```bash
npm run prepare:local
```

Verify local build readiness:

```bash
npm run verify:local
```

Run the app locally:

```bash
npm run dev
```

## Preview

Preview uses the Vercel preview environment. Link the project once if `.vercel/` is absent:

```bash
npx vercel link --yes --project teacher-ai
```

Prepare preview:

```bash
npm run prepare:preview
```

Verify preview:

```bash
npm run verify:preview
```

Deploy preview:

```bash
npm run deploy:preview
```

The deploy command prints the preview URL. Use that URL for browser smoke tests.

## Production

Production uses the Vercel production environment. Confirm these production-only values before deploying:

- `WEBAUTHN_RP_ID` is the production hostname, not `localhost`.
- `WEBAUTHN_ORIGIN` uses `https://` and matches the production URL.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel production.
- `E2B_API_KEY` and `E2B_LONG_SCREENSHOT_TEMPLATE` are either both set or both absent.

Prepare production:

```bash
npm run prepare:production
```

Verify production:

```bash
npm run verify:production
```

Deploy production:

```bash
npm run deploy:production
```

## Validation Details

Environment validation is implemented in `lib/env/schema.ts` and exposed through:

```bash
npm run env:validate:local
npm run env:validate:preview
npm run env:validate:production
```

For Vercel environments, prefer the prepare scripts because they first pull remote environment variables into ignored `.vercel/.env.*.local` files.

The validator does not print secret values. It reports only variable names and the rule that failed.

## Database migrations

| Command | Scope | Data impact |
| --- | --- | --- |
| `npm run db:migrate:local` | Local Docker Supabase | **Additive only** — applies pending migrations |
| `npm run db:migrate:remote` | Linked remote Supabase | **Additive only** — `supabase db push --linked` |
| `npm run db:reset:local` | Local Docker only | **Wipes all local data** — never used in CI |
| `npm run provision:local` | Local dev setup | Includes local reset for a clean stack |

**CI safety:** The validate job runs `npm run test:ci-db-safety`, which fails if any workflow uses `db reset --linked`, `db reset` without `--local`, or local-only commands like `provision:local`. Remote/preview/production databases are never reset by this pipeline.

To apply migrations to a linked remote project manually:

```bash
npx supabase link --project-ref <your-ref>
npm run db:migrate:remote
```

## GitHub Actions

Workflow file: `.github/workflows/deploy.yml`

Pipeline:

```text
validate (test:env, lint, build)
  -> deploy-preview (vercel pull + env validate + vercel build + deploy)
  -> verify-preview (smoke tests)
  -> deploy-production (main push only)
```

| Event | Result |
| --- | --- |
| Pull request to `main` | Preview deploy + smoke tests + PR comment |
| Push to `main` | Preview deploy + smoke tests + production deploy + production smoke test |

### Where secrets live (never commit them)

| Location | What to store |
| --- | --- |
| **Vercel → Project → Settings → Environment Variables** | App secrets: `LLM_API_KEY`, Supabase keys, `E2B_API_KEY`, WebAuthn, etc. Scope each variable to Preview and/or Production. |
| **GitHub → Settings → Secrets and variables → Actions** | CI-only: `VERCEL_TOKEN`, optional `VERCEL_AUTOMATION_BYPASS_SECRET`. |
| **Local only** | `.env.local`, `.vercel/.env.*.local` — already gitignored. |

CI runs `vercel pull` at deploy time to download Vercel env vars into `.vercel/.env.preview.local`. That file is temporary and must not be committed.

**Note:** Variables marked **Sensitive** in Vercel (default for Preview/Production) are redacted by `vercel pull` as empty strings, e.g. `E2B_API_KEY=""`. The validator treats "key present but empty" as configured. Runtime on Vercel still receives the real value.

### Required GitHub secrets

| Secret | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | Vercel CLI auth for pull/build/deploy |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Optional. Required when Vercel Deployment Protection blocks preview/production smoke tests |

Repository variables are set in the workflow:

- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### GitHub environments (recommended)

Create two environments in GitHub repository settings:

- `preview`: no approval required
- `production`: add required reviewers for manual approval before production deploy

If Vercel Git integration also auto-deploys on push, disable it or accept duplicate preview deployments. This workflow is the source of truth for validated deploys.

### Local smoke test

After a preview deploy:

```bash
PREVIEW_URL=https://your-preview.vercel.app npm run smoke:preview
```

### Troubleshooting preview validation

If CI prints `Environment validation failed for preview`, fix variables in the **Vercel dashboard**, not in git.

Common cases:

| Error | Fix in Vercel Preview env |
| --- | --- |
| Missing Supabase keys | Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Missing LLM key | Add `LLM_API_KEY` (or provider-specific key) |
| E2B pair mismatch | Set **both** `E2B_API_KEY` and `E2B_LONG_SCREENSHOT_TEMPLATE`, or **delete both** if preview does not need long screenshots |

Reproduce locally:

```bash
npm run prepare:preview
```
