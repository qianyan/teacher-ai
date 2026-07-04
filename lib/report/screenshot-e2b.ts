import {
  E2bCommandError,
  e2bCreateSandbox,
  e2bDeleteSandbox,
  e2bDownloadFile,
  e2bRunCommand,
  e2bUploadFile,
} from "@/lib/report/e2b-http-client";

const LOG = "[long-screenshot]";

/** Must match e2b/template.ts (baked into the E2B template image). */
const PLAYWRIGHT_BROWSERS_PATH = "/app/ms-playwright";

/** Slightly under app/api/long-screenshot maxDuration (120s). */
const SANDBOX_TIMEOUT_MS = 115_000;
const COMMAND_TIMEOUT_MS = 110_000;

/**
 * Full-page PNG via Playwright inside an E2B sandbox (stock Chromium).
 * Orchestrates the sandbox through E2B HTTP APIs (no e2b npm SDK in this route).
 * Requires E2B_API_KEY and E2B_LONG_SCREENSHOT_TEMPLATE (template name from Template.build).
 */
export async function screenshotHtmlToPngBufferE2b(html: string): Promise<Buffer> {
  const apiKey = process.env.E2B_API_KEY?.trim();
  const template = process.env.E2B_LONG_SCREENSHOT_TEMPLATE?.trim();
  if (!apiKey || !template) {
    throw new Error(
      "E2B long screenshot requires E2B_API_KEY and E2B_LONG_SCREENSHOT_TEMPLATE",
    );
  }

  console.info(`${LOG} e2b: creating sandbox`, {
    template,
    sandboxTimeoutMs: SANDBOX_TIMEOUT_MS,
    transport: "e2b-http-api",
  });

  const session = await e2bCreateSandbox(
    template,
    Math.ceil(SANDBOX_TIMEOUT_MS / 1000),
    apiKey,
  );

  try {
    await e2bUploadFile(session, "/tmp/input.html", html);
    console.info(`${LOG} e2b: wrote HTML`, {
      htmlBytes: Buffer.byteLength(html, "utf8"),
    });

    try {
      console.info(`${LOG} e2b: running Playwright in sandbox`, {
        commandTimeoutMs: COMMAND_TIMEOUT_MS,
      });
      await e2bRunCommand(
        session,
        "node /app/run-screenshot.mjs /tmp/input.html /tmp/out.png",
        COMMAND_TIMEOUT_MS,
        undefined,
        { PLAYWRIGHT_BROWSERS_PATH },
      );
      console.info(`${LOG} e2b: sandbox command exited OK`);
    } catch (err) {
      if (err instanceof E2bCommandError) {
        const tail = (err.stderr || err.stdout || err.message || "").slice(0, 4000);
        throw new Error(`E2B screenshot failed (exit ${err.exitCode}): ${tail}`);
      }
      throw err;
    }

    const buf = await e2bDownloadFile(session, "/tmp/out.png");
    console.info(`${LOG} e2b: read PNG`, { pngBytes: buf.length });
    return buf;
  } finally {
    await e2bDeleteSandbox(session, apiKey).catch(() => {
      /* ignore */
    });
  }
}
