"use client";

import {
  buildPhotoBlobUrlMap,
  buildPhotoDataUrlMap,
  injectPhotoBlobUrls,
  type PhotoEntry,
} from "@/lib/photos/inject-blobs";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type Props = {
  fullHtml: string | null;
  photos: PhotoEntry[];
};

export function PreviewPanel({ fullHtml, photos }: Props) {
  const [srcDoc, setSrcDoc] = useState<string>("");
  const [exporting, setExporting] = useState(false);
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
    setExportError(null);
    setExporting(true);
    try {
      const map = await buildPhotoDataUrlMap(photos);
      const html = injectPhotoBlobUrls(fullHtml, map);
      const res = await fetch("/api/long-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
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
      setExporting(false);
    }
  }

  function handleDownloadHtml() {
    if (!srcDoc) return;
    const blob = new Blob([srcDoc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toddler-biweekly-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15 }}>预览（1080px 宽）</span>
        <button
          type="button"
          style={btn}
          disabled={!srcDoc || exporting}
          onClick={handleExportPng}
        >
          {exporting ? "导出中…" : "导出长图 PNG"}
        </button>
        <button
          type="button"
          style={btn}
          disabled={!srcDoc}
          onClick={handleDownloadHtml}
        >
          下载 HTML
        </button>
        {exportError && (
          <span style={{ color: "#e53e3e", fontSize: 13 }}>{exportError}</span>
        )}
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#718096" }}>
        PNG 由{" "}
        <code style={{ fontSize: 11 }}>scripts/generate-long-screenshot.py</code>{" "}
       （Playwright）生成；本机需 Python 3 与 Playwright 浏览器。
      </p>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "auto",
          maxHeight: "70vh",
          background: "#e2e8f0",
        }}
      >
        {srcDoc ? (
          <iframe
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
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: "#a0aec0",
              fontSize: 14,
            }}
          >
            生成成功后将在此预览
          </div>
        )}
      </div>
    </div>
  );
}

const btn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
};
