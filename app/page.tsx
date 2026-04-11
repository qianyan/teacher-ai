"use client";

import { PhotoList } from "@/components/PhotoList";
import { PreviewPanel } from "@/components/PreviewPanel";
import { RichEditor } from "@/components/RichEditor";
import { SessionUnlock } from "@/components/SessionUnlock";
import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { useCallback, useState } from "react";

const defaultIntro =
  "<p>亲爱的家长朋友们：</p><p>请在此编辑开篇问候与双周概述。</p>";

const defaultBody =
  "<p><strong>在此编写各板块正文</strong>（探究、活动、生活自理等）。生成时模型会据此输出带 <code>section</code> / <code>tips-section</code> 结构的 HTML。</p>";

export default function HomePage() {
  const [biweeklyDateRange, setBiweeklyDateRange] = useState(
    "2026.4.7 - 2026.4.18",
  );
  const [subTitle, setSubTitle] = useState("从家庭走向集体的第一步");
  const [introHtml, setIntroHtml] = useState(defaultIntro);
  const [bodyHtml, setBodyHtml] = useState(defaultBody);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [fullHtml, setFullHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setError(null);
    setLoading(true);
    setFullHtml(null);
    try {
      const photoLogicalNames = photos.map((p) => p.logicalName.trim());
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biweeklyDateRange,
          subTitle,
          introHtml,
          bodyHtml,
          photoLogicalNames,
        }),
      });
      const data = (await res.json()) as { error?: string; fullHtml?: string };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (!data.fullHtml) {
        throw new Error("No fullHtml in response");
      }
      setFullHtml(data.fullHtml);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }, [biweeklyDateRange, subTitle, introHtml, bodyHtml, photos]);

  return (
    <SessionUnlock>
      <main className="app-shell">
        <header className="app-hero">
          <h1>托班两周周报 · Teacher AI</h1>
          <p>
            编辑开篇与正文、导入照片并核对文件名，生成 HTML 预览与长图 PNG。需配置服务端
            LLM 环境变量。
          </p>
        </header>

        <div className="app-grid app-grid--main">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <section className="app-panel">
              <h2 className="app-section-title">版面与日期</h2>
              <label className="app-label" htmlFor="biweekly-range">
                双周日期徽章（中国大陆工作日）
              </label>
              <input
                id="biweekly-range"
                type="text"
                value={biweeklyDateRange}
                onChange={(e) => setBiweeklyDateRange(e.target.value)}
                className="app-input app-input--narrow"
                style={{ marginBottom: 16 }}
              />
              <label className="app-label" htmlFor="sub-title">
                副标题（横幅下红字一行）
              </label>
              <input
                id="sub-title"
                type="text"
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                className="app-input"
                style={{ marginBottom: 0 }}
              />
            </section>

            <section className="app-panel">
              <RichEditor
                label="开篇（白底 intro 区域）"
                valueHtml={introHtml}
                onChangeHtml={setIntroHtml}
                placeholder="问候语与双周概述…"
                minHeight={140}
              />
              <RichEditor
                label="结构化正文（各板块要点，供模型扩展为 section）"
                valueHtml={bodyHtml}
                onChangeHtml={setBodyHtml}
                placeholder="按板块写好要点与照片前缀说明…"
                minHeight={280}
              />
            </section>
          </div>

          <aside className="app-panel app-aside">
            <h2 className="app-section-title">照片与生成</h2>
            <PhotoList photos={photos} onChange={setPhotos} />
            <button
              type="button"
              className="btn btn--primary btn--lg"
              style={{ width: "100%" }}
              onClick={generate}
              disabled={loading}
            >
              {loading ? "生成中…" : "生成预览 HTML"}
            </button>
            {error && <p className="text-error">{error}</p>}
          </aside>
        </div>

        <section className="app-panel" style={{ marginTop: 20 }}>
          <PreviewPanel fullHtml={fullHtml} photos={photos} />
        </section>
      </main>
    </SessionUnlock>
  );
}
