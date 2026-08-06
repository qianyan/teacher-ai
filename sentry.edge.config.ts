import * as Sentry from "@sentry/nextjs";

// Without SENTRY_DSN, Sentry is fully disabled: no network calls, no-op.
const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  debug: false,
});
