import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
// Glob patterns handed to the Sentry plugin must be posix-style (it globs paths as-is).
const dirPosix = dir.split(path.sep).join(path.posix.sep);

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
  sourcemaps: {
    // Keep source map generation + upload intact: when SENTRY_AUTH_TOKEN is
    // set, maps are uploaded to Sentry and then removed from the build output.
    // Without the token, uploads are skipped but the maps are still deleted,
    // so .vercel/output stays small and Vercel deploys are not bloated.
    deleteSourcemapsAfterUpload: true,
    // Explicit globs covering client (static) and server maps. With webpack
    // builds the SDK's default deletion pattern only covers .next/static
    // (server maps are never auto-deleted), and setting filesToDeleteAfterUpload
    // overrides the default — so list both trees to guarantee nothing ships.
    filesToDeleteAfterUpload: [
      path.posix.join(dirPosix, ".next", "static", "**", "*.js.map"),
      path.posix.join(dirPosix, ".next", "static", "**", "*.css.map"),
      path.posix.join(dirPosix, ".next", "server", "**", "*.js.map"),
      path.posix.join(dirPosix, ".next", "server", "**", "*.css.map"),
    ],
  },
});
