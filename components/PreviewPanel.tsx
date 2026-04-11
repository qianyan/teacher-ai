"use client";

import { captureIframeDocumentAsPngBlob } from "@/lib/photos/capture-iframe-png";
import {
  buildPhotoBlobUrlMap,
  buildPhotoUrlMapForPersist,
  injectPhotoBlobUrls,
  type PhotoEntry,
} from "@/lib/photos/inject-blobs";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

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
      const html = injectPhotoBlobUrls(fullHtml, buildPhotoBlobUrlMap(photos));
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
            {htmlBusy ? "准备中…" : "下载 HTML"}
          </button>
        </div>
      </div>
      {exportError && (
        <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 12px" }}>
          {exportError}
        </p>
      )}
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
        导出长图优先由服务端 Playwright 整页截图（与{" "}
        <code style={{ fontSize: 12 }}>scripts/generate-long-screenshot.py</code>{" "}
        一致）；请保持照片「Blob：已同步」以控制 HTML 体积。失败或超限时回退为浏览器截图。
        本机需 <code style={{ fontSize: 12 }}>npx playwright install chromium</code>。
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
