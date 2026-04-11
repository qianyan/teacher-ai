import { toBlob } from "html-to-image";

async function waitForDocumentImages(doc: Document): Promise<void> {
  const imgs = [...doc.images];
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
}

/**
 * In-browser fallback when server Playwright is unavailable.
 * Passes explicit document scroll size so html-to-image captures the full page, not just the visible band.
 */
export async function captureIframeDocumentAsPngBlob(
  iframe: HTMLIFrameElement,
): Promise<Blob> {
  const doc = iframe.contentDocument;
  if (!doc?.documentElement) {
    throw new Error("预览未就绪，请稍后再试");
  }

  await doc.fonts.ready;
  await waitForDocumentImages(doc);

  const root = doc.documentElement;
  const body = doc.body;
  const fullWidth = Math.max(
    root.scrollWidth,
    body?.scrollWidth ?? 0,
    root.clientWidth,
    1080,
  );
  const fullHeight = Math.max(
    root.scrollHeight,
    body?.scrollHeight ?? 0,
    root.clientHeight,
    400,
  );

  const pr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const blob = await toBlob(root, {
    // Must be false: cacheBust breaks blob: image URLs (html-to-image dataurl.ts).
    cacheBust: false,
    pixelRatio: pr,
    backgroundColor: "#ffffff",
    width: fullWidth,
    height: fullHeight,
  });

  if (!blob) {
    throw new Error("无法生成 PNG（画布可能超出浏览器限制）");
  }

  return blob;
}
