import { screenshotHtmlToPngBuffer } from "@/lib/report/screenshot-html-playwright";

/** Photo-heavy reports use data URLs; ~30+ images can exceed 100MB. */
const MAX_HTML_BYTES = 200 * 1024 * 1024;

/**
 * Full-page PNG via Playwright (Node), aligned with `scripts/generate-long-screenshot.py`.
 * Local: run `npx playwright install chromium` if browsers are missing.
 * Vercel: uses `@sparticuz/chromium` + `playwright-core` (see screenshot-html-playwright.ts).
 */
export async function runGenerateLongScreenshot(html: string): Promise<Buffer> {
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_HTML_BYTES) {
    throw new Error(
      `HTML is too large for screenshot (${bytes} bytes; max ${MAX_HTML_BYTES})`,
    );
  }

  try {
    return await screenshotHtmlToPngBuffer(html);
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err);
    const extra =
      hint.includes("Executable doesn't exist") || hint.includes("BrowserType.launch")
        ? " Run: npx playwright install chromium"
        : "";
    throw new Error(`${hint}${extra}`);
  }
}
