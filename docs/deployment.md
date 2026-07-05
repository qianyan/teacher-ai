# Deployment Guide

This project supports three deployment targets: `local`, `preview`, and `production`.

## Targets

| Target | Purpose | Required validation |
| --- | --- | --- |
| `local` | Developer machine using `.env.local` | LLM credentials and env schema tests |
| `preview` | Vercel preview deployment | Vercel preview env pull, env schema validation, Next build |
| `production` | Vercel production deployment | Vercel production env pull, strict env schema validation, Next build |

## Local

Prepare local development:

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
