import { describe, expect, it } from "vitest";
import {
  groupPhotoKeysByPrefix,
  parseBodyHtml,
  resolveSectionPhotoIndices,
  type ParsedSection,
} from "@/lib/report/parse-body-html";

describe("parseBodyHtml", () => {
  it("returns an empty result for blank input", () => {
    expect(parseBodyHtml("   ")).toEqual({ sections: [], tips: null });
  });

  it("splits h2/h3 headings into sections", () => {
    const body = [
      "<h2>探究</h2><p>内容A</p>",
      "<h3>户外活动</h3><p>内容B</p>",
    ].join("");
    const result = parseBodyHtml(body);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].title).toBe("探究");
    expect(result.sections[0].contentHtml).toBe("<p>内容A</p>");
    expect(result.sections[1].title).toBe("户外活动");
    expect(result.tips).toBeNull();
  });

  it("separates a tips block from regular sections", () => {
    const body =
      "<h2>探究</h2><p>A</p><h2>家园提示</h2><p>请家长配合</p>";
    const result = parseBodyHtml(body);
    expect(result.sections.map((s) => s.title)).toEqual(["探究"]);
    expect(result.tips?.title).toBe("家园提示");
    expect(result.tips?.isTips).toBe(true);
  });

  it("falls back to strong-block splitting when no headings", () => {
    const body =
      '<p><strong>生活自理</strong></p><p>学会自己穿鞋</p><p><strong>艺术表达</strong></p><p>手指画</p>';
    const result = parseBodyHtml(body);
    expect(result.sections.map((s) => s.title)).toEqual([
      "生活自理",
      "艺术表达",
    ]);
  });

  it("detects a photo prefix from a 照片前缀 marker", () => {
    const body = "<h2>探究</h2><p>照片前缀：tanjiu</p>";
    const result = parseBodyHtml(body);
    expect(result.sections[0].photoPrefix).toBe("tanjiu");
  });

  it("keeps a lone tips block", () => {
    const result = parseBodyHtml("<h2>家长提示</h2><p>x</p>");
    expect(result.sections).toEqual([]);
    expect(result.tips?.title).toBe("家长提示");
  });
});

describe("groupPhotoKeysByPrefix", () => {
  it("groups numeric suffixes and sorts them", () => {
    const map = groupPhotoKeysByPrefix([
      "tanjiu3.jpg",
      "huwai1.jpg",
      "tanjiu1.jpg",
      "tanjiu2.jpg",
    ]);
    expect(map.get("tanjiu")).toEqual([1, 2, 3]);
    expect(map.get("huwai")).toEqual([1]);
  });

  it("ignores names without a trailing index", () => {
    const map = groupPhotoKeysByPrefix(["cover.jpg", "tanjiu1.jpg"]);
    expect(map.has("cover")).toBe(false);
    expect(map.get("tanjiu")).toEqual([1]);
  });
});

describe("resolveSectionPhotoIndices", () => {
  const sections: ParsedSection[] = [
    { title: "探究", contentHtml: "<p>x</p>", photoPrefix: "tanjiu", isTips: false },
    { title: "户外", contentHtml: "<p>y</p>", isTips: false },
  ];

  it("prefers the section photoPrefix", () => {
    const photoByPrefix = new Map<string, number[]>([
      ["tanjiu", [1, 2]],
      ["huwai", [1]],
    ]);
    const used = new Set<string>();
    const res = resolveSectionPhotoIndices(
      sections[0],
      sections,
      photoByPrefix,
      used,
    );
    expect(res).toEqual({ prefix: "tanjiu", indices: [1, 2] });
    expect(used.has("tanjiu")).toBe(true);
  });

  it("falls back to the first unused prefix for unmatched sections", () => {
    const photoByPrefix = new Map<string, number[]>([["huwai", [1]]]);
    const used = new Set<string>();
    const res = resolveSectionPhotoIndices(
      sections[1],
      sections,
      photoByPrefix,
      used,
    );
    expect(res).toEqual({ prefix: "huwai", indices: [1] });
  });

  it("returns null when no photos remain", () => {
    const res = resolveSectionPhotoIndices(
      sections[1],
      sections,
      new Map(),
      new Set(),
    );
    expect(res).toBeNull();
  });
});
