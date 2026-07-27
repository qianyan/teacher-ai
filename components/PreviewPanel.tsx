"use client";

import { ReportPreviewIframe } from "@/components/ReportPreviewIframe";
import { captureIframeDocumentAsPngBlob } from "@/lib/photos/capture-iframe-png";
import {
  allPhotosPreviewReady,
  buildPhotoBlobUrlMap,
  buildPhotoInjectionMapForLongScreenshot,
  buildPhotoUrlMapForPersist,
  injectPhotoBlobUrls,
  photoPreviewSignature,
  type PhotoEntry,
} from "@/lib/photos/inject-blobs";
import type { CSSProperties } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const SRCDOC_DEBOUNCE_MS = 80;

type Props = {
  fullHtml: string | null;
  photos: PhotoEntry[];
};

function PreviewPanelInner({ fullHtml, photos }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [srcDoc, setSrcDoc] = useState<string>("");
  const [pngExporting, setPngExporting] = useState(false);
  const [htmlBusy, setHtmlBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const photoSig = useMemo(() => photoPreviewSignature(photos), [photos]);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const closeFullscreen = useCallback(() => setFullscreenOpen(false), []);

  useEffect(() => {
    if (!fullscreenOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenOpen, closeFullscreen]);

  // Prevent body scroll while the fullscreen modal is open so touch gestures are
  // handled by the iframe instead of the background page. Also flag <body> so
  // CSS can nullify .app-panel backdrop-filter/transform/animation that would
  // otherwise pin the fixed host to the panel instead of the viewport
  // (Chrome 116+).
  useEffect(() => {
    if (!fullscreenOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("preview-fullscreen-open");
    return () => {
      document.body.style.overflow = original;
      document.body.classList.remove("preview-fullscreen-open");
    };
  }, [fullscreenOpen]);

  useEffect(() => {
    if (!fullHtml) {
      setSrcDoc("");
      return;
    }
    const t = window.setTimeout(() => {
      const map = buildPhotoBlobUrlMap(photosRef.current);
      const injected = injectPhotoBlobUrls(fullHtml, map);
      setSrcDoc(injected);
    }, SRCDOC_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [fullHtml, photoSig]);

  async function handleExportPng() {
    if (!fullHtml) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.documentElement) {
      setExportError("预览未就绪，请稍后再导出 PNG");
      return;
    }
    setExportError(null);
    setPngExporting(true);
    try {
      const shotMap = await buildPhotoInjectionMapForLongScreenshot(photos);
      const html = injectPhotoBlobUrls(fullHtml, shotMap);
      const htmlBytes = new Blob([html]).size;
      const vercelBodyLimit = 4_450_000;

      if (htmlBytes <= vercelBodyLimit) {
        const res = await fetch("/api/long-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `toddler-biweekly-${new Date().toISOString().slice(0, 10)}.png`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
        const errJson = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        console.warn("Server long screenshot failed:", errJson.error || res.status);
      } else {
        console.warn(
          `HTML ${htmlBytes} bytes exceeds ~${vercelBodyLimit} safe limit; using in-browser fallback`,
        );
      }

      const blob = await captureIframeDocumentAsPngBlob(iframe);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `toddler-biweekly-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setExportError(
        e instanceof Error ? e.message : "导出 PNG 失败，请查看控制台",
      );
    } finally {
      setPngExporting(false);
    }
  }

  async function handleDownloadHtml() {
    if (!fullHtml) return;
    setExportError(null);
    setHtmlBusy(true);
    try {
      const map = await buildPhotoUrlMapForPersist(photos);
      const html = injectPhotoBlobUrls(fullHtml, map);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `toddler-biweekly-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setExportError(
        e instanceof Error ? e.message : "下载 HTML 失败，请查看控制台",
      );
    } finally {
      setHtmlBusy(false);
    }
  }

  const previewFrame = srcDoc ? (
    <ReportPreviewIframe
      ref={iframeRef}
      srcDoc={srcDoc}
      title={fullscreenOpen ? "preview-fullscreen" : "preview"}
      scaled={!fullscreenOpen}
      fitToViewport={fullscreenOpen}
    />
  ) : (
    <div className="preview-empty" style={emptyState}>
      <div className="preview-empty__icon" aria-hidden>
        ✦
      </div>
      <p className="preview-empty__title">尚无预览</p>
      <p className="preview-empty__hint">
        填写内容与照片后点击「生成预览 HTML」，成功后将在此显示与导出一致、1080px 宽的版面。
      </p>
    </div>
  );

  return (
    <div>
      <div className="preview-toolbar">
        <div className="preview-toolbar__meta">
          <span className="preview-toolbar__title">预览</span>
          <span className="preview-toolbar__badge">1080px 宽</span>
        </div>
        <div className="preview-toolbar__actions">
          <button
            type="button"
            className="btn btn--secondary preview-toolbar-btn"
            disabled={
              !srcDoc || pngExporting || htmlBusy || !allPhotosPreviewReady(photos)
            }
            onClick={() => setFullscreenOpen(true)}
          >
            全屏预览
          </button>
          <button
            type="button"
            className="btn btn--primary preview-toolbar-btn"
            disabled={
              !srcDoc || pngExporting || htmlBusy || !allPhotosPreviewReady(photos)
            }
            onClick={handleExportPng}
          >
            {pngExporting ? "导出中…" : "导出长图 PNG"}
          </button>
          <button
            type="button"
            className="btn btn--secondary preview-toolbar-btn"
            disabled={
              !srcDoc || htmlBusy || pngExporting || !allPhotosPreviewReady(photos)
            }
            onClick={handleDownloadHtml}
          >
            {htmlBusy ? "准备中…" : "下载 HTML"}
          </button>
        </div>
      </div>
      {exportError && <p className="preview-export-error">{exportError}</p>}
      <div className="preview-frame-outer">
        <div className="preview-frame-chrome" aria-hidden />
        <div
          className={
            fullscreenOpen && srcDoc
              ? "preview-fullscreen-host"
              : "preview-scroll-well"
          }
          role={fullscreenOpen && srcDoc ? "dialog" : undefined}
          aria-modal={fullscreenOpen && srcDoc ? true : undefined}
          aria-label={fullscreenOpen && srcDoc ? "HTML 全屏预览" : undefined}
          onClick={
            fullscreenOpen && srcDoc ? closeFullscreen : undefined
          }
        >
          {fullscreenOpen && srcDoc && (
            <button
              type="button"
              className="btn btn--secondary template-preview-modal__close"
              onClick={(e) => {
                e.stopPropagation();
                closeFullscreen();
              }}
            >
              关闭
            </button>
          )}
          {/* Stable inner host so ReportPreviewIframe is not remounted on open. */}
          <div
            className={
              fullscreenOpen && srcDoc
                ? "preview-fullscreen-host__frame"
                : "preview-scroll-well__inner"
            }
            onClick={
              fullscreenOpen && srcDoc
                ? (e) => e.stopPropagation()
                : undefined
            }
          >
            {previewFrame}
          </div>
        </div>
      </div>
    </div>
  );
}

export const PreviewPanel = memo(PreviewPanelInner);

const emptyState: CSSProperties = {
  padding: "48px 24px 56px",
  textAlign: "center",
  maxWidth: 480,
  margin: "0 auto",
};
