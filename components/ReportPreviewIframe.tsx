"use client";

import {
  applyReportPreviewIframeHeight,
  measureReportPreviewHeight,
} from "@/lib/report/measure-preview-document";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";

const PREVIEW_WIDTH = 1080;

async function waitForPreviewImages(doc: Document): Promise<void> {
  const pending = Array.from(doc.images).filter((img) => !img.complete);
  if (pending.length === 0) return;
  await Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

type Props = {
  srcDoc: string;
  title?: string;
  /** Fit newsletter width inside parent; scales height proportionally. */
  scaled?: boolean;
  className?: string;
  style?: CSSProperties;
};

const ReportPreviewIframeInner = forwardRef<HTMLIFrameElement, Props>(
  function ReportPreviewIframeInner(
    { srcDoc, title = "简报预览", scaled = false, className, style },
    forwardedRef,
  ) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useImperativeHandle(forwardedRef, () => iframeRef.current as HTMLIFrameElement);
  const measureGenRef = useRef(0);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const [scaledLayout, setScaledLayout] = useState<{
    scale: number;
    height: number;
  } | null>(null);

  const syncHeight = useCallback(async () => {
    const gen = ++measureGenRef.current;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    await waitForPreviewImages(doc);
    if (gen !== measureGenRef.current) return;

    const run = () => {
      if (gen !== measureGenRef.current || !iframeRef.current) return false;
      const iframeEl = iframeRef.current;
      const contentDoc = iframeEl.contentDocument;
      if (!contentDoc) return false;

      const contentHeight = applyReportPreviewIframeHeight(iframeEl, contentDoc);
      if (contentHeight == null) return false;
      setFrameHeight(contentHeight);

      if (scaled) {
        const wrap = wrapRef.current;
        const wrapWidth = wrap?.clientWidth ?? PREVIEW_WIDTH;
        if (wrapWidth <= 0) return false;
        const scaleFactor = wrapWidth / PREVIEW_WIDTH;
        setScaledLayout({
          scale: scaleFactor,
          height: Math.ceil(contentHeight * scaleFactor),
        });
      } else {
        setScaledLayout(null);
      }
      return true;
    };

    if (run()) return;
    requestAnimationFrame(() => {
      if (gen !== measureGenRef.current) return;
      if (run()) return;
      requestAnimationFrame(() => {
        if (gen !== measureGenRef.current) return;
        if (run()) return;
        window.setTimeout(() => {
          if (gen !== measureGenRef.current) return;
          run();
        }, 50);
      });
    });
  }, [scaled]);

  useEffect(() => {
    setFrameHeight(null);
    setScaledLayout(null);
  }, [srcDoc]);

  useEffect(() => {
    if (!scaled) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      void syncHeight();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [scaled, syncHeight, srcDoc]);

  const iframeStyle: CSSProperties = scaled
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        width: PREVIEW_WIDTH,
        height: frameHeight ?? 1,
        border: "none",
        display: "block",
        transformOrigin: "top left",
        transform: scaledLayout
          ? `scale(${scaledLayout.scale})`
          : undefined,
        opacity: scaledLayout ? 1 : 0,
        pointerEvents: "none",
      }
    : {
        width: PREVIEW_WIDTH,
        height: frameHeight ?? 400,
        border: "none",
        display: "block",
        margin: "0 auto",
        background: "#fff",
        opacity: frameHeight ? 1 : 0.85,
      };

  const wrapperStyle: CSSProperties = scaled
    ? {
        width: "100%",
        height: scaledLayout?.height ?? (frameHeight ? Math.ceil(frameHeight * 0.28) : 200),
        overflow: "hidden",
        position: "relative",
        background: "#fff",
        ...style,
      }
    : (style ?? {});

  const content = (
    <>
      {!frameHeight && (
        <span className="template-preview-frame__status">渲染预览…</span>
      )}
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={srcDoc}
        scrolling="no"
        onLoad={() => {
          void syncHeight();
        }}
        style={iframeStyle}
      />
    </>
  );

  if (scaled) {
    return (
      <div ref={wrapRef} className={className} style={wrapperStyle}>
        {content}
      </div>
    );
  }

  return (
    <div className={className} style={wrapperStyle}>
      {content}
    </div>
  );
  },
);

export const ReportPreviewIframe = memo(ReportPreviewIframeInner);

export { measureReportPreviewHeight, PREVIEW_WIDTH };
