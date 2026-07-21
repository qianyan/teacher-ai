import { describe, expect, it } from "vitest";
import {
  composeLogicalFilename,
  logicalKeyFromFilename,
  parseLogicalFilename,
} from "@/lib/photos/inject-blobs";

describe("logicalKeyFromFilename", () => {
  it("returns PREFIX:INDEX for a matching name", () => {
    expect(logicalKeyFromFilename("探究1.jpg")).toBe("探究:1");
    expect(logicalKeyFromFilename("tanjiu12.png")).toBe("tanjiu:12");
  });

  it("strips leading directory paths", () => {
    expect(logicalKeyFromFilename("photos/huwai3.jpg")).toBe("huwai:3");
    expect(logicalKeyFromFilename("C:\\dir\\a1.jpg")).toBe("a:1");
  });

  it("returns null when there is no trailing index", () => {
    expect(logicalKeyFromFilename("cover.jpg")).toBeNull();
    expect(logicalKeyFromFilename("探究")).toBeNull();
  });
});

describe("parseLogicalFilename", () => {
  it("splits into prefix, index, and extension", () => {
    expect(parseLogicalFilename("tanjiu3.jpg")).toEqual({
      prefix: "tanjiu",
      index: 3,
      ext: ".jpg",
    });
  });

  it("normalizes a missing extension to .jpg", () => {
    expect(parseLogicalFilename("huwai1")?.ext).toBe(".jpg");
  });

  it("preserves the original extension", () => {
    expect(parseLogicalFilename("a1.PNG")?.ext).toBe(".PNG");
  });

  it("rejects names without an index", () => {
    expect(parseLogicalFilename("cover.jpg")).toBeNull();
  });
});

describe("composeLogicalFilename", () => {
  it("joins prefix, index, and a dotted extension", () => {
    expect(composeLogicalFilename("tanjiu", 2, ".jpg")).toBe("tanjiu2.jpg");
    expect(composeLogicalFilename("huwai", 10, "png")).toBe("huwai10.png");
  });

  it("round-trips with parseLogicalFilename", () => {
    const name = composeLogicalFilename("探究", 5, ".jpg");
    expect(parseLogicalFilename(name)).toEqual({
      prefix: "探究",
      index: 5,
      ext: ".jpg",
    });
  });
});
