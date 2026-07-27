"use client";

import { PreviewPanel } from "@/components/PreviewPanel";

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  body { width: 1080px; font-family: sans-serif; }
  .block { height: 600px; display: flex; align-items: center; justify-content: center; font-size: 48px; }
</style>
</head>
<body>
  <div class="block" style="background:#fdd">固定 1080px 版面 - 第 1 屏</div>
  <div class="block" style="background:#dfd">第 2 屏</div>
  <div class="block" style="background:#ddf">第 3 屏</div>
</body>
</html>`;

export function DevPreviewHarness() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px" }}>
      <section className="app-panel workbench-panel workbench-panel--preview">
        <PreviewPanel fullHtml={SAMPLE_HTML} photos={[]} />
      </section>
    </main>
  );
}
