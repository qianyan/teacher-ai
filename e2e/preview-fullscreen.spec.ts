import { expect, test, type Page } from "@playwright/test";

// 800px viewport: the fullscreen frame (max-width 1080, host padding 16)
// gives the iframe a 768px width, so fit zoom = 768/1080 ~= 0.711.
const VIEWPORT = { width: 800, height: 700 };

test.use({ viewport: VIEWPORT });

function iframeZoom(page: Page, selector: string) {
  return page
    .locator(selector)
    .evaluate(
      (el) =>
        (el as HTMLIFrameElement).contentDocument?.documentElement.style
          .zoom ?? "",
    );
}

test.describe("报告全屏预览 (/dev-preview)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev-preview");
    // srcDoc is debounced; wait until the inline preview iframe has loaded.
    await expect(page.locator(".preview-scroll-well iframe")).toBeVisible();
    await page.getByRole("button", { name: "全屏预览" }).click();
    await expect(page.locator(".preview-fullscreen-host")).toBeVisible();
  });

  test("全屏宿主铺满整个视口，不被 .app-panel 困住", async ({ page }) => {
    const host = page.locator(".preview-fullscreen-host");
    await expect(host).toHaveRole("dialog");

    const box = await host.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.x)).toBe(0);
    expect(Math.round(box!.y)).toBe(0);
    expect(Math.round(box!.width)).toBe(VIEWPORT.width);
    expect(Math.round(box!.height)).toBe(VIEWPORT.height);

    await page.screenshot({ path: "e2e/artifacts/fullscreen-open.png" });
  });

  test("全屏时 iframe 文档应用适配 zoom", async ({ page }) => {
    const selector = ".preview-fullscreen-host__frame iframe";
    await expect
      .poll(() => iframeZoom(page, selector))
      .not.toBe("");
    const zoom = parseFloat(await iframeZoom(page, selector));
    // 768 / 1080
    expect(zoom).toBeGreaterThan(0.6);
    expect(zoom).toBeLessThan(0.8);
  });

  test("退出全屏后行内预览不残留 zoom", async ({ page }) => {
    const fsSelector = ".preview-fullscreen-host__frame iframe";
    await expect.poll(() => iframeZoom(page, fsSelector)).not.toBe("");

    await page.getByRole("button", { name: "关闭" }).click();
    await expect(page.locator(".preview-fullscreen-host")).toHaveCount(0);

    const inlineSelector = ".preview-scroll-well iframe";
    await expect(page.locator(inlineSelector)).toBeVisible();
    await expect.poll(() => iframeZoom(page, inlineSelector)).toBe("");

    // The same iframe element must survive the round trip (no remount).
    await page.screenshot({ path: "e2e/artifacts/fullscreen-closed.png" });
  });
});
