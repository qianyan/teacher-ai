/** @vitest-environment jsdom */
/**
 * #26 — 报告全屏预览 scroll path: prepare the in-iframe document so Android
 * compositor / image-decode blanks are less likely while scrolling.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { prepareFitViewportDocument } from "./prepare-fit-viewport-document";

function seedImages(count: number): HTMLImageElement[] {
  document.body.innerHTML = "";
  const imgs: HTMLImageElement[] = [];
  for (let i = 0; i < count; i++) {
    const img = document.createElement("img");
    img.id = `i${i}`;
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    document.body.appendChild(img);
    imgs.push(img);
  }
  return imgs;
}

beforeEach(() => {
  document.documentElement.style.backgroundColor = "";
  document.body.style.backgroundColor = "";
  document.body.innerHTML = "";
});

describe("prepareFitViewportDocument", () => {
  test("marks every image eager/sync and awaits decode", async () => {
    const imgs = seedImages(3);
    const decodeCalls: string[] = [];
    for (const img of imgs) {
      Object.defineProperty(img, "decode", {
        value: vi.fn(async () => {
          decodeCalls.push(img.id);
        }),
      });
    }

    await prepareFitViewportDocument(document);

    for (const img of imgs) {
      expect(img.getAttribute("loading")).toBe("eager");
      expect(img.getAttribute("decoding")).toBe("sync");
    }
    expect(decodeCalls.sort()).toEqual(["i0", "i1", "i2"]);
  });

  test("paints an opaque document background so scroll tiles do not flash host chrome", async () => {
    seedImages(0);
    await prepareFitViewportDocument(document);
    expect(document.documentElement.style.backgroundColor).toBe(
      "rgb(255, 255, 255)",
    );
    expect(document.body.style.backgroundColor).toBe("rgb(255, 255, 255)");
  });

  test("decode rejection does not reject the prepare call", async () => {
    const [img] = seedImages(1);
    Object.defineProperty(img, "decode", {
      value: vi.fn(async () => {
        throw new Error("decode failed");
      }),
    });
    await expect(prepareFitViewportDocument(document)).resolves.toBeUndefined();
  });
});
