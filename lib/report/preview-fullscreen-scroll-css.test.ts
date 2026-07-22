/**
 * #26 — structural CSS contract for 报告全屏预览 scroll blanks.
 * backdrop-filter over a scrolling iframe is a known Android compositor hazard.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const cssPath = path.join(process.cwd(), "app/globals.css");

function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `missing selector ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("preview fullscreen host CSS — scroll blank contract (#26)", () => {
  const css = readFileSync(cssPath, "utf8");

  test("preview-fullscreen-host does not use backdrop-filter", () => {
    const body = ruleBody(css, ".preview-fullscreen-host {");
    expect(body).not.toMatch(/backdrop-filter/);
    expect(body).toMatch(/background:/);
  });

  test("preview-fullscreen-host__frame isolates the scrolling iframe layer", () => {
    const body = ruleBody(css, ".preview-fullscreen-host__frame {");
    expect(body).toMatch(/isolation:\s*isolate/);
    expect(body).toMatch(/transform:\s*translateZ\(0\)/);
  });
});
