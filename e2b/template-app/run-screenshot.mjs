import fs from "node:fs";
import { chromium } from "playwright";

/** Matches lib/report/screenshot-html-playwright.ts and scripts/generate-long-screenshot.py */
const VIEWPORT_WIDTH = 1080;
const VIEWPORT_HEIGHT = 800;
const NAV_TIMEOUT_MS = 120_000;

async function waitForFontsReady(page) {
  await page.evaluate(() => document.fonts.ready);
}

async function waitForImagesLoaded(page) {
  await page.evaluate(() => {
    const imgs = [...document.images];
    return Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
      ),
    );
  });
}

const htmlPath = process.argv[2];
const outPath = process.argv[3];
if (!htmlPath || !outPath) {
  console.error("usage: node run-screenshot.mjs <input.html> <out.png>");
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, "utf8");

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
  ],
});

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
  await waitForFontsReady(page);
  await waitForImagesLoaded(page);
  await page.screenshot({
    path: outPath,
    fullPage: true,
    type: "png",
    animations: "disabled",
  });
} finally {
  await browser.close();
}
