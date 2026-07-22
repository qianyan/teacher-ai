/**
 * Prepare an already-loaded report preview document for fitToViewport scrolling.
 *
 * Android Chrome commonly shows 报告全屏局部空白 while scrolling when:
 * - offscreen images were discarded and must re-decode mid-scroll
 * - scroll tiles reveal an unpainted / transparent document background
 *
 * Call this when entering fitToViewport (and again after load) so decode work
 * finishes before the user scrolls.
 */
export async function prepareFitViewportDocument(doc: Document): Promise<void> {
  const root = doc.documentElement;
  if (root) {
    root.style.backgroundColor = "rgb(255, 255, 255)";
  }
  if (doc.body) {
    doc.body.style.backgroundColor = "rgb(255, 255, 255)";
  }

  const images = Array.from(doc.images);
  await Promise.all(
    images.map(async (img) => {
      img.setAttribute("loading", "eager");
      img.setAttribute("decoding", "sync");
      if (typeof img.decode === "function") {
        try {
          await img.decode();
        } catch {
          // Broken / already-gone sources must not block fullscreen open.
        }
      }
    }),
  );
}
