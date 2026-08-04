import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: dir,
  webpack: (config, { isServer, webpack }) => {
    // SENTRY_DSN is not NEXT_PUBLIC_ prefixed, so inline it explicitly into the
    // client bundle (build-time value; unset → Sentry stays a no-op in browser).
    if (!isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          "process.env.SENTRY_DSN": JSON.stringify(process.env.SENTRY_DSN ?? ""),
          "process.env.SENTRY_ENVIRONMENT": JSON.stringify(process.env.SENTRY_ENVIRONMENT ?? ""),
        }),
      );
    }
    return config;
  },
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium"],
  experimental: {
    // Large JSON bodies for POST /api/long-screenshot (base64 images in HTML)
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  // Org/project slugs are non-secret; allow env overrides with sane defaults.
  org: process.env.SENTRY_ORG ?? "nil-voz",
  project: process.env.SENTRY_PROJECT ?? "teacher-ai",
  // Build-time secret (GitHub Actions / Vercel). When absent, the Sentry build
  // plugin skips release creation and source map upload entirely (warning only,
  // never a build failure) — this keeps CI builds green without the token.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
});
