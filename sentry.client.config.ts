import * as Sentry from "@sentry/nextjs";

// SENTRY_DSN is not prefixed with NEXT_PUBLIC_, so inside the browser bundle it
// resolves to undefined and Sentry stays a no-op unless the host inlines it.
const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Capture full traces for performance monitoring; adjust as needed.
  tracesSampleRate: 1.0,
  debug: false,
});
