import { screenshotHtmlToPngBuffer } from "@/lib/report/screenshot-html-playwright";

const LOG = "[long-screenshot]";

/** Photo-heavy reports use data URLs; ~30+ images can exceed 100MB. */
const MAX_HTML_BYTES = 200 * 1024 * 1024;

function isE2bLongScreenshotConfigured(): boolean {
  return Boolean(
    process.env.E2B_API_KEY?.trim() &&
      process.env.E2B_LONG_SCREENSHOT_TEMPLATE?.trim(),
  );
}

/**
 * Full-page PNG via Playwright (Node), aligned with `scripts/generate-long-screenshot.py`.
 * When `E2B_API_KEY` and `E2B_LONG_SCREENSHOT_TEMPLATE` are set: runs Playwright in an E2B sandbox.
 * Otherwise: local `npx playwright install chromium`, or on Vercel `@sparticuz/chromium` + `playwright-core`.
 */
export async function runGenerateLongScreenshot(html: string): Promise<Buffer> {
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_HTML_BYTES) {
    throw new Error(
      `HTML is too large for screenshot (${bytes} bytes; max ${MAX_HTML_BYTES})`,
    );
  }

  const e2bReady = isE2bLongScreenshotConfigured();
  console.info(`${LOG} pipeline: start`, {
    htmlBytes: bytes,
    execution: e2bReady ? "e2b-sandbox" : "local-in-process-playwright",
    e2bConfigured: e2bReady,
  });

  const t0 = Date.now();
  try {
    if (e2bReady) {
      const template = process.env.E2B_LONG_SCREENSHOT_TEMPLATE?.trim() ?? "";
      console.info(`${LOG} pipeline: branch → E2B sandbox`, {
        template,
        hint: "Playwright runs inside E2B; this Node process only orchestrates.",
      });
      const { screenshotHtmlToPngBufferE2b } = await import(
        "@/lib/report/screenshot-e2b"
      );
      const buf = await screenshotHtmlToPngBufferE2b(html);
      console.info(`${LOG} pipeline: E2B finished`, {
        ms: Date.now() - t0,
        pngBytes: buf.length,
      });
      return buf;
    }

    console.info(`${LOG} pipeline: branch → local Playwright`, {
      hint: "Set E2B_API_KEY and E2B_LONG_SCREENSHOT_TEMPLATE to use E2B instead.",
    });
    const buf = await screenshotHtmlToPngBuffer(html);
    console.info(`${LOG} pipeline: local Playwright finished`, {
      ms: Date.now() - t0,
      pngBytes: buf.length,
    });
    return buf;
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err);
    const extra =
      hint.includes("Executable doesn't exist") || hint.includes("BrowserType.launch")
        ? " Run: npx playwright install chromium"
        : "";
    throw new Error(`${hint}${extra}`);
  }
}
