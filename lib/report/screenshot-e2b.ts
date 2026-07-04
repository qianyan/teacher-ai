const LOG = "[long-screenshot]";

/** Slightly under app/api/long-screenshot maxDuration (120s). */
const SANDBOX_TIMEOUT_MS = 115_000;
const COMMAND_TIMEOUT_MS = 110_000;

/**
 * Full-page PNG via Playwright inside an E2B sandbox (stock Chromium).
 * Requires E2B_API_KEY and E2B_LONG_SCREENSHOT_TEMPLATE (template name from Template.build).
 */
export async function screenshotHtmlToPngBufferE2b(html: string): Promise<Buffer> {
  const { CommandExitError, Sandbox } = await import("e2b/dist/index.mjs");

  const apiKey = process.env.E2B_API_KEY;
  const template = process.env.E2B_LONG_SCREENSHOT_TEMPLATE;
  if (!apiKey?.trim() || !template?.trim()) {
    throw new Error(
      "E2B long screenshot requires E2B_API_KEY and E2B_LONG_SCREENSHOT_TEMPLATE",
    );
  }

  console.info(`${LOG} e2b: creating sandbox`, {
    template: template.trim(),
    sandboxTimeoutMs: SANDBOX_TIMEOUT_MS,
  });
  const sandbox = await Sandbox.create(template.trim(), {
    apiKey: apiKey.trim(),
    timeoutMs: SANDBOX_TIMEOUT_MS,
  });

  try {
    await sandbox.files.write("/tmp/input.html", html);
    console.info(`${LOG} e2b: wrote HTML`, {
      htmlBytes: Buffer.byteLength(html, "utf8"),
    });

    try {
      console.info(`${LOG} e2b: running Playwright in sandbox`, {
        commandTimeoutMs: COMMAND_TIMEOUT_MS,
      });
      await sandbox.commands.run(
        "node /app/run-screenshot.mjs /tmp/input.html /tmp/out.png",
        { timeoutMs: COMMAND_TIMEOUT_MS },
      );
      console.info(`${LOG} e2b: sandbox command exited OK`);
    } catch (err) {
      if (err instanceof CommandExitError) {
        const tail = (err.stderr || err.stdout || err.message || "").slice(
          0,
          4000,
        );
        throw new Error(
          `E2B screenshot failed (exit ${err.exitCode}): ${tail}`,
        );
      }
      throw err;
    }

    const png = await sandbox.files.read("/tmp/out.png", { format: "bytes" });
    const buf = Buffer.from(png);
    console.info(`${LOG} e2b: read PNG`, { pngBytes: buf.length });
    return buf;
  } finally {
    await sandbox.kill().catch(() => {
      /* ignore */
    });
  }
}
