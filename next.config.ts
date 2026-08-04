import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: dir,
  // Keep source maps out of the deployment bundle: nft never traces them into
  // .vercel/output, so serverless packages stay small. (Deleting server maps
  // mid-build instead would make nft lstat missing files → ENOENT.)
  outputFileTracingExcludes: {
    "*": ["**/*.js.map", "**/*.css.map"],
  },
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
    // The default deletion pattern covers .next/static (client maps) only; nft
    // does not trace static assets, so deleting them there is safe. Server maps
    // are left on disk and excluded from the deploy bundle via
    // outputFileTracingExcludes above (deleting them mid-build breaks nft).
    deleteSourcemapsAfterUpload: true,
  },
});
