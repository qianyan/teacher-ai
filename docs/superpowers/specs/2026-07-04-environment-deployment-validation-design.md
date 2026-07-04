# Environment Deployment Validation Design

## Goal

Support reliable deployment and verification across `local`, `preview`, and `production` environments by centralizing environment variable rules and adding explicit validation commands.

## Current State

The app is a Next.js application with environment access spread across LLM, Supabase, WebAuthn, E2B screenshot, and lock-screen modules. `.env.example` documents variables, but there is no executable validation step. Missing values are mostly discovered at route runtime.

## Chosen Approach

Create a small internal environment module that describes each variable, its visibility, whether it is required for each deployment target, and any value constraints. Add a CLI validation script that loads `.env.local` for local checks and validates `process.env` for preview/production checks.

Alternatives considered:

- Documentation-only: simplest, but does not prevent broken deploys.
- Inline route checks only: preserves current style, but keeps validation scattered.
- Third-party schema library: useful, but unnecessary for this small set of rules.

## Environment Targets

- `local`: required for core generation only; Supabase, WebAuthn, passkey storage, and E2B may be absent while developing.
- `preview`: strict enough to catch deploy misconfiguration, with LLM and Supabase required. E2B is optional but validated when partially configured.
- `production`: strict validation for LLM, Supabase, WebAuthn origin/rpID, and service secrets. E2B remains optional but must be complete when enabled.

## Components

- `lib/env/schema.ts`: pure TypeScript environment schema and validator, safe to run in Node scripts and app code.
- `scripts/validate-env.ts`: CLI entrypoint for `npm run env:validate -- --target production`.
- `package.json`: scripts for `env:validate`, `env:validate:local`, `env:validate:preview`, and `env:validate:production`.
- `.env.example`: grouped examples that match the executable schema.

## Validation Rules

- `LLM_PROVIDER` must be `openai_compatible` or `anthropic`.
- OpenAI-compatible mode requires one usable API key from the accepted key list.
- Anthropic mode requires `ANTHROPIC_API_KEY` or `LLM_API_KEY`.
- `REPORT_GENERATE_MAX_TOKENS` must be a positive integer when set.
- Supabase URL, anon key, and service role key are required for preview/production.
- WebAuthn production values must use HTTPS origins and a non-localhost rpID.
- E2B requires both `E2B_API_KEY` and `E2B_LONG_SCREENSHOT_TEMPLATE` when either is set.
- Public variables are identified in validation output so accidental server-only exposure is easier to review.

## Error Handling

The validator returns structured errors and warnings without printing secret values. The CLI prints a concise report and exits non-zero on errors.

## Testing

Add focused tests for the pure validator before implementation. The tests cover a valid local environment, missing production Supabase values, partial E2B configuration, invalid WebAuthn production origin, and provider-specific LLM requirements.
