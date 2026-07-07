/** Match visible newsletter height inside preview iframes (container through footer). */
export function measureReportPreviewHeight(doc: Document): number | null {
  const container = doc.querySelector(".container");
  if (container instanceof HTMLElement) {
    const height = container.getBoundingClientRect().height;
    if (height > 0) return Math.ceil(height);
  }

  const root = doc.documentElement;
  const footer = doc.querySelector(".footer");
  if (footer instanceof HTMLElement && root) {
    const top = root.getBoundingClientRect().top;
    const height = footer.getBoundingClientRect().bottom - top;
    if (height > 0) return Math.ceil(height);
  }

  const body = doc.body;
  if (!root && !body) return null;

  const fallback = Math.ceil(
    Math.max(
      root?.scrollHeight ?? 0,
      root?.offsetHeight ?? 0,
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0,
    ),
  );
  return fallback > 0 ? fallback : null;
}

export function applyReportPreviewIframeHeight(
  iframe: HTMLIFrameElement,
  doc: Document,
): number | null {
  const height = measureReportPreviewHeight(doc);
  if (height == null) return null;
  iframe.style.height = `${height}px`;
  return height;
}
