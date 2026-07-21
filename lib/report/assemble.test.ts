import { describe, expect, it } from "vitest";
import {
  applyShellReplacements,
  assembleFullDocument,
  escapeText,
  injectViewportForFullscreen,
} from "@/lib/report/assemble";

const SHELL = `<section class="header">
  <span class="name">PLACEHOLDER</span>
  <span class="info-badge">DATE</span>
  <div class="sub-title">SUB</div>
  <div class="intro-text">INTRO</div>
</section>`;

describe("escapeText", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeText(`<a>&"`)).toBe(`&lt;a&gt;&amp;&quot;`);
  });

  it("escapes characters that could break out of an attribute", () => {
    expect(escapeText('a"b')).toBe("a&quot;b");
  });
});

describe("applyShellReplacements", () => {
  it("injects escaped header fields into the shell", () => {
    const out = applyShellReplacements(SHELL, {
      biweeklyDateRange: "2026.4.7 - 2026.4.18",
      englishClassName: "Infant D",
      subTitle: "从家庭走向集体的第一步",
      introHtml: "<p>hello</p>",
    });

    expect(out).toContain('<span class="name">Infant D</span>');
    expect(out).toContain(
      '<span class="info-badge">2026.4.7 - 2026.4.18</span>',
    );
    expect(out).toContain(
      '<div class="sub-title">从家庭走向集体的第一步</div>',
    );
    expect(out).toContain('<div class="intro-text"><p>hello</p></div>');
  });

  it("escapes untrusted header text but keeps introHtml as-is", () => {
    const out = applyShellReplacements(SHELL, {
      biweeklyDateRange: "<b>",
      englishClassName: "x<y",
      subTitle: "z",
      introHtml: "<p>raw</p>",
    });
    // User header fields are escaped; intro is trusted editor HTML.
    expect(out).not.toContain("<b>");
    expect(out).toContain("&lt;b&gt;");
    expect(out).toContain("x&lt;y");
    expect(out).toContain("<p>raw</p>");
  });
});

describe("assembleFullDocument", () => {
  it("concatenates shell, dynamic body, and footer", () => {
    const doc = assembleFullDocument(SHELL, "<footer>FOOT</footer>", {
      biweeklyDateRange: "R",
      englishClassName: "C",
      subTitle: "S",
      introHtml: "<p>i</p>",
      dynamicBodyHtml: "<div class=\"section\">BODY</div>",
    });

    const lines = doc.split("\n");
    expect(lines[0]).toContain("header");
    expect(doc).toContain("BODY");
    expect(doc).toContain("FOOT");
    // Shell before body before footer.
    expect(doc.indexOf("BODY")).toBeGreaterThan(doc.indexOf("header"));
    expect(doc.indexOf("FOOT")).toBeGreaterThan(doc.indexOf("BODY"));
  });
});

describe("injectViewportForFullscreen", () => {
  it("replaces an existing viewport meta with a 1080px layout viewport", () => {
    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>T</title>
</head><body></body></html>`;
    const out = injectViewportForFullscreen(html);
    expect(out).toContain('<meta name="viewport" content="width=1080">');
    expect(out).not.toContain("width=device-width");
  });

  it("injects a viewport meta when none exists", () => {
    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>T</title>
</head><body></body></html>`;
    const out = injectViewportForFullscreen(html);
    expect(out).toContain('<meta name="viewport" content="width=1080">');
  });

  it("handles single-quoted viewport meta tags", () => {
    const html = `<!DOCTYPE html>
<html><head>
  <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head><body></body></html>`;
    const out = injectViewportForFullscreen(html);
    expect(out).toContain('<meta name="viewport" content="width=1080">');
    expect(out).not.toContain("width=device-width");
  });
});
