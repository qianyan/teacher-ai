/**
 * Build and publish the long-screenshot template to E2B.
 *
 * Prerequisites: E2B_API_KEY in env (or .env via dotenv).
 *
 *   npx tsx e2b/build-template.ts
 *
 * Then set E2B_LONG_SCREENSHOT_TEMPLATE in Vercel to the template name you built (see E2B_TEMPLATE_NAME).
 */
import "dotenv/config";
import { Template, defaultBuildLogger } from "e2b";
import { longScreenshotTemplate } from "./template";

const name =
  process.env.E2B_TEMPLATE_NAME?.trim() || "teacher-ai-long-screenshot";

async function main() {
  await Template.build(longScreenshotTemplate, name, {
    cpuCount: 2,
    memoryMB: 2048,
    onBuildLogs: defaultBuildLogger(),
  });
  console.log(`E2B template built: ${name}`);
  console.log(
    "Set E2B_LONG_SCREENSHOT_TEMPLATE to this name (or id) in Vercel env.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
