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
 * Full-page PNG of an iframe’s document (same-origin `srcDoc` preview).
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

  const pr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const blob = await toBlob(doc.documentElement, {
    cacheBust: true,
    pixelRatio: pr,
    backgroundColor: "#ffffff",
  });

  if (!blob) {
    throw new Error("无法生成 PNG（画布可能超出浏览器限制）");
  }

  return blob;
}
