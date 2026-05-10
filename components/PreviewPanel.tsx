"use client";

import { captureIframeDocumentAsPngBlob } from "@/lib/photos/capture-iframe-png";
import {
  allPhotosPreviewReady,
  buildPhotoBlobUrlMap,
  buildPhotoInjectionMapForLongScreenshot,
  buildPhotoUrlMapForPersist,
  injectPhotoBlobUrls,
  type PhotoEntry,
} from "@/lib/photos/inject-blobs";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  fullHtml: string | null;
  photos: PhotoEntry[];
};

export function PreviewPanel({ fullHtml, photos }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [srcDoc, setSrcDoc] = useState<string>("");
  const [pngExporting, setPngExporting] = useState(false);
  const [htmlBusy, setHtmlBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);

  const closeFullscreen = useCallback(() => setFullscreenOpen(false), []);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    if (!fullscreenOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenOpen, closeFullscreen]);

  useEffect(() => {
    if (!fullHtml) {
      setSrcDoc("");
      return;
    }
    const map = buildPhotoBlobUrlMap(photos);
    const injected = injectPhotoBlobUrls(fullHtml, map);
    setSrcDoc(injected);
  }, [fullHtml, photos]);

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

  return (
    <div>
      <div style={toolbarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
            预览
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              background: "var(--bg)",
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid var(--border)",
            }}
          >
            1080px 宽
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
      {exportError && (
        <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 12px" }}>
          {exportError}
        </p>
      )}
      <div style={frameOuter}>
        <div style={frameChrome} aria-hidden />
        <div className="preview-scroll-well">
          {srcDoc ? (
            <iframe
              ref={iframeRef}
              title="preview"
              srcDoc={srcDoc}
              style={{
                width: 1080,
                minHeight: 400,
                border: "none",
                display: "block",
                margin: "0 auto",
                background: "#fff",
              }}
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
          )}
        </div>
      </div>
      {portalMounted &&
        fullscreenOpen &&
        srcDoc &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal
            aria-label="HTML 全屏预览"
            onClick={closeFullscreen}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 25000,
              boxSizing: "border-box",
              width: "100vw",
              height: "100dvh",
              maxHeight: "100dvh",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              background: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <button
              type="button"
              className="btn btn--secondary"
              onClick={(e) => {
                e.stopPropagation();
                closeFullscreen();
              }}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 1,
              }}
            >
              关闭
            </button>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: "1 1 0",
                minHeight: 0,
                width: "100%",
                maxWidth: "100%",
                margin: "0 auto",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  flex: "1 1 0",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  background: "var(--bg-gradient)",
                  borderRadius: "var(--radius)",
                  padding: "12px 16px 16px",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <iframe
                  title="preview-fullscreen"
                  srcDoc={srcDoc}
                  style={{
                    flex: "1 1 0",
                    minHeight: 0,
                    width: 1080,
                    maxWidth: "100%",
                    height: "100%",
                    alignSelf: "center",
                    border: "none",
                    display: "block",
                    background: "#fff",
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 12,
  flexWrap: "wrap",
};

const frameOuter: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  overflow: "hidden",
  background: "var(--panel-elevated)",
  boxShadow: "var(--shadow-md)",
};

const frameChrome: CSSProperties = {
  height: 8,
  background: "linear-gradient(180deg, var(--border-subtle) 0%, var(--bg) 100%)",
  borderBottom: "1px solid var(--border)",
};

const emptyState: CSSProperties = {
  padding: "48px 24px 56px",
  textAlign: "center",
  maxWidth: 480,
  margin: "0 auto",
};

