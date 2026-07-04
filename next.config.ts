import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: dir,
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@sparticuz/chromium",
  ],
  experimental: {
    // Large JSON bodies for POST /api/long-screenshot (base64 images in HTML)
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
};

export default nextConfig;
