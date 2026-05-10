import path from "node:path";
import { fileURLToPath } from "node:url";
import { Template, waitForTimeout } from "e2b";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * E2B template: Node 22 + Playwright Chromium for full-page PNG (see build-template.ts).
 * `.copy()` sources must be relative to `fileContextPath` (absolute src paths are rejected).
 */
export const longScreenshotTemplate = Template({
  fileContextPath: path.join(__dirname, "template-app"),
})
  .fromNodeImage("22")
  .setWorkdir("/app")
  .copy(".", "/app")
  .setUser("root")
  .runCmd("cd /app && npm install")
  .runCmd("cd /app && npx playwright install --with-deps chromium")
  .runCmd(
    'DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends fonts-noto-cjk fonts-noto-color-emoji && rm -rf /var/lib/apt/lists/*',
  )
  .setStartCmd("echo teacher-ai-long-screenshot", waitForTimeout(3_000));
