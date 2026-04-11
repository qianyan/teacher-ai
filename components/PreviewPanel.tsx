"use client";

import { captureIframeDocumentAsPngBlob } from "@/lib/photos/capture-iframe-png";
import {
  buildPhotoBlobUrlMap,
  buildPhotoDataUrlMap,
  injectPhotoBlobUrls,
  type PhotoEntry,
} from "@/lib/photos/inject-blobs";
import { ensureReportPhotoBlobUrls } from "@/lib/photos/upload-report-blobs";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type Props = {
  fullHtml: string | null;
  photos: PhotoEntry[];
};

export function PreviewPanel({ fullHtml, photos }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  /** Cached Vercel Blob URL per photo id (avoids re-upload on repeat downloads). */
  const blobUrlByPhotoIdRef = useRef<Map<string, string>>(new Map());

  const [srcDoc, setSrcDoc] = useState<string>("");
  const [pngExporting, setPngExporting] = useState(false);
  const [htmlBusy, setHtmlBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
      let map: Map<string, string>;
      try {
        map = await ensureReportPhotoBlobUrls(photos, blobUrlByPhotoIdRef.current);
      } catch (blobErr) {
        console.warn("Vercel Blob upload unavailable, embedding images as data URLs", blobErr);
        map = await buildPhotoDataUrlMap(photos);
      }
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
            className="btn btn--primary"
            disabled={!srcDoc || pngExporting || htmlBusy}
            onClick={handleExportPng}
          >
            {pngExporting ? "导出中…" : "导出长图 PNG"}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={!srcDoc || htmlBusy || pngExporting}
            onClick={handleDownloadHtml}
          >
            {htmlBusy ? "上传照片…" : "下载 HTML"}
          </button>
        </div>
      </div>
      {exportError && (
        <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 12px" }}>
          {exportError}
        </p>
      )}
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
        长图 PNG 在浏览器内从预览直接导出（无大文件上传，适配 Vercel）。下载 HTML
        时照片优先上传到 Vercel Blob 并写入可分享的链接；未配置 Blob 环境变量时回退为内嵌
        base64。命令行仍可用{" "}
        <code style={{ fontSize: 12, color: "var(--text)" }}>scripts/generate-long-screenshot.py</code>
        （本机 Python + Playwright）。
      </p>
      <div style={frameOuter}>
        <div style={frameChrome} aria-hidden />
        <div style={scrollRegion}>
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
            <div style={emptyState}>
              <div style={emptyIcon} aria-hidden>
                ◇
              </div>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--text)", fontSize: 15 }}>
                尚无预览
              </p>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 360 }}>
                填写内容与照片后点击「生成预览 HTML」，成功后将在此显示与导出一致、1080px 宽的版面。
              </p>
            </div>
          )}
        </div>
      </div>
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

const scrollRegion: CSSProperties = {
  maxHeight: "70vh",
  overflow: "auto",
  background: "linear-gradient(180deg, #ebe6df 0%, #e8e3dc 100%)",
  padding: "12px 0 20px",
};

const emptyState: CSSProperties = {
  padding: "48px 24px 56px",
  textAlign: "center",
  maxWidth: 480,
  margin: "0 auto",
};

const emptyIcon: CSSProperties = {
  fontSize: 32,
  color: "var(--border)",
  marginBottom: 12,
  opacity: 0.85,
};
