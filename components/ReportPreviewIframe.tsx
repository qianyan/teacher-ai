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
  /**
   * Render the iframe at 100% width/height and let the document scroll itself.
   * After load, a CSS `zoom` equal to `iframeWidth / 1080` is applied to the
   * document element so the fixed 1080px layout scales to fit the iframe width
   * while the iframe scrolls natively (smooth, no white-patch artifacts).
   */
  fitToViewport?: boolean;
  className?: string;
  style?: CSSProperties;
};

const ReportPreviewIframeInner = forwardRef<HTMLIFrameElement, Props>(
  function ReportPreviewIframeInner(
    {
      srcDoc,
      title = "简报预览",
      scaled = false,
      fitToViewport = false,
      className,
      style,
    },
    forwardedRef,
  ) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    useImperativeHandle(
      forwardedRef,
      () => iframeRef.current as HTMLIFrameElement,
    );
    const measureGenRef = useRef(0);
    const [frameHeight, setFrameHeight] = useState<number | null>(null);
    const [scaledLayout, setScaledLayout] = useState<{
      scale: number;
      height: number;
    } | null>(null);
    const [ready, setReady] = useState(false);

    const syncHeight = useCallback(async () => {
      if (fitToViewport) return;
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

        const contentHeight = applyReportPreviewIframeHeight(
          iframeEl,
          contentDoc,
        );
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
    }, [scaled, fitToViewport]);

    /** Scale the iframe's document so the fixed 1080px layout fits its width. */
    const applyFitZoom = useCallback(() => {
      if (!fitToViewport) return;
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!iframe || !doc?.documentElement) return;
      const width = iframe.clientWidth;
      if (width <= 0) return;
      doc.documentElement.style.zoom = String(width / PREVIEW_WIDTH);
    }, [fitToViewport]);

    useEffect(() => {
      setFrameHeight(null);
      setScaledLayout(null);
      setReady(false);
    }, [srcDoc]);

    useEffect(() => {
      if (!scaled || fitToViewport) return;
      const wrap = wrapRef.current;
      if (!wrap) return;
      const ro = new ResizeObserver(() => {
        void syncHeight();
      });
      ro.observe(wrap);
      return () => ro.disconnect();
    }, [scaled, fitToViewport, syncHeight, srcDoc]);

    // Re-apply zoom when the iframe (and thus the available width) resizes.
    useEffect(() => {
      if (!fitToViewport) return;
      const iframe = iframeRef.current;
      if (!iframe) return;
      const ro = new ResizeObserver(() => {
        applyFitZoom();
      });
      ro.observe(iframe);
      return () => ro.disconnect();
    }, [fitToViewport, applyFitZoom, srcDoc]);

    const handleLoad = useCallback(async () => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc) return;

      if (fitToViewport) {
        applyFitZoom();
        setReady(true);
        await waitForPreviewImages(doc);
        // Re-apply once images settle in case layout shifted.
        applyFitZoom();
        return;
      }
      void syncHeight();
    }, [syncHeight, fitToViewport, applyFitZoom]);

    const isScaled = scaled && !fitToViewport;

    const iframeStyle: CSSProperties = fitToViewport
      ? {
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          background: "#fff",
        }
      : isScaled
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
            opacity: 1,
            pointerEvents: "none",
            willChange: "transform",
          }
        : {
            width: PREVIEW_WIDTH,
            height: frameHeight ?? 400,
            border: "none",
            display: "block",
            margin: "0 auto",
            background: "#fff",
            opacity: 1,
          };

    const wrapperStyle: CSSProperties = isScaled
      ? {
          width: "100%",
          height:
            scaledLayout?.height ??
            (frameHeight ? Math.ceil(frameHeight * 0.28) : 200),
          overflow: "hidden",
          position: "relative",
          background: "#fff",
          ...style,
        }
      : fitToViewport
        ? {
            width: "100%",
            height: "100%",
            overflow: "hidden",
            position: "relative",
            background: "#fff",
            ...style,
          }
        : (style ?? {});

    const showSkeleton = fitToViewport
      ? !ready
      : scaled
        ? !scaledLayout
        : !frameHeight;

    const content = (
      <>
        {showSkeleton && (
          <div className="report-preview-frame__skeleton" aria-hidden />
        )}
        {showSkeleton && (
          <span className="report-preview-frame__status">渲染预览…</span>
        )}
        <iframe
          ref={iframeRef}
          title={title}
          srcDoc={srcDoc}
          scrolling={fitToViewport ? "yes" : "no"}
          onLoad={handleLoad}
          style={iframeStyle}
        />
      </>
    );

    if (isScaled || fitToViewport) {
      return (
        <div
          ref={wrapRef}
          className={`report-preview-frame ${className ?? ""}`}
          style={wrapperStyle}
        >
          {content}
        </div>
      );
    }

    return (
      <div className={`report-preview-frame ${className ?? ""}`} style={wrapperStyle}>
        {content}
      </div>
    );
  },
);

export const ReportPreviewIframe = memo(ReportPreviewIframeInner);

export { measureReportPreviewHeight, PREVIEW_WIDTH };
