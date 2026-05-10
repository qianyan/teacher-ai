import type { Browser, Page } from "playwright-core";

const LOG = "[long-screenshot]";

/** Matches scripts/generate-long-screenshot.py (Playwright CLI defaults). */
const VIEWPORT_WIDTH = 1080;
const VIEWPORT_HEIGHT = 800;
const NAV_TIMEOUT_MS = 120_000;

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL === "1") {
    console.info(`${LOG} playwright: launch`, {
      where: "this Node process",
      bundle: "@sparticuz/chromium + playwright-core (Vercel serverless)",
    });
    const chromiumBin = (await import("@sparticuz/chromium")).default;
    const { chromium } = await import("playwright-core");
    return chromium.launch({
      args: chromiumBin.args,
      executablePath: await chromiumBin.executablePath(),
      headless: true,
    });
  }

  console.info(`${LOG} playwright: launch`, {
    where: "this Node process",
    bundle: "playwright (local chromium — run npx playwright install chromium if missing)",
  });
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
    ],
  });
}

async function waitForImagesLoaded(page: Page): Promise<void> {
  await page.evaluate(() => {
    const imgs = [...document.images];
    return Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
      ),
    );
  });
}

/**
 * Full-page PNG from self-contained HTML (same idea as `npx playwright screenshot --full-page`).
 * Local: requires `npx playwright install chromium` once. On Vercel: uses @sparticuz/chromium.
 */
export async function screenshotHtmlToPngBuffer(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewportSize({
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
    });
    await page.setContent(html, {
      waitUntil: "load",
      timeout: NAV_TIMEOUT_MS,
    });
    await waitForImagesLoaded(page);
    const buf = await page.screenshot({
      fullPage: true,
      type: "png",
      animations: "disabled",
    });
    return Buffer.from(buf);
  } finally {
    await browser.close();
  }
}
