"use client";

import { PhotoList } from "@/components/PhotoList";
import { PreviewPanel } from "@/components/PreviewPanel";
import { RichEditor } from "@/components/RichEditor";
import { SessionUnlock } from "@/components/SessionUnlock";
import {
  DEFAULT_BODY_HTML,
  DEFAULT_BIWEEKLY_DATE_RANGE,
  DEFAULT_INTRO_HTML,
  DEFAULT_SUB_TITLE,
} from "@/lib/persistence/defaults";
import { MAX_HISTORY } from "@/lib/persistence/idb";
import { useReportPersistence } from "@/lib/persistence/use-report-persistence";
import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { useCallback, useMemo, useState } from "react";

export default function HomePage() {
  const defaultHydratedState = useMemo(
    () => ({
      biweeklyDateRange: DEFAULT_BIWEEKLY_DATE_RANGE,
      subTitle: DEFAULT_SUB_TITLE,
      introHtml: DEFAULT_INTRO_HTML,
      bodyHtml: DEFAULT_BODY_HTML,
      fullHtml: null as string | null,
      photos: [] as PhotoEntry[],
    }),
    [],
  );

  const [biweeklyDateRange, setBiweeklyDateRange] = useState(
    DEFAULT_BIWEEKLY_DATE_RANGE,
  );
  const [subTitle, setSubTitle] = useState(DEFAULT_SUB_TITLE);
  const [introHtml, setIntroHtml] = useState(DEFAULT_INTRO_HTML);
  const [bodyHtml, setBodyHtml] = useState(DEFAULT_BODY_HTML);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [fullHtml, setFullHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    isHydrating,
    draftSavedAt,
    draftError,
    history,
    recordHistoryAfterGenerate,
    loadHistoryEntry,
    deleteHistoryEntry,
    clearDraftAndReset,
  } = useReportPersistence({
    biweeklyDateRange,
    subTitle,
    introHtml,
    bodyHtml,
    photos,
    fullHtml,
    setBiweeklyDateRange,
    setSubTitle,
    setIntroHtml,
    setBodyHtml,
    setPhotos,
    setFullHtml,
    defaultState: defaultHydratedState,
  });

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
      try {
        await recordHistoryAfterGenerate(data.fullHtml);
      } catch (e) {
        console.error("History save failed:", e);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }, [
    biweeklyDateRange,
    subTitle,
    introHtml,
    bodyHtml,
    photos,
    recordHistoryAfterGenerate,
  ]);

  const draftTimeLabel =
    draftSavedAt !== null
      ? new Date(draftSavedAt).toLocaleString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          month: "numeric",
          day: "numeric",
        })
      : null;

  if (isHydrating) {
    return (
      <SessionUnlock>
        <main className="app-shell">
          <p style={{ color: "var(--text-muted)", margin: 0 }}>加载草稿…</p>
        </main>
      </SessionUnlock>
    );
  }

  return (
    <SessionUnlock>
      <main className="app-shell">
        <header className="app-hero">
          <h1>托班两周周报 · Teacher AI</h1>
          <p>
            编辑开篇与正文、导入照片并核对文件名，生成 HTML 预览与长图 PNG。需配置服务端
            LLM 环境变量。
          </p>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            <span>
              {draftError ? (
                <span style={{ color: "var(--danger)" }}>草稿：{draftError}</span>
              ) : draftTimeLabel ? (
                <>草稿已自动保存 · {draftTimeLabel}</>
              ) : (
                <>草稿将自动保存到本机浏览器</>
              )}
            </span>
            <button
              type="button"
              className="btn btn--secondary"
              style={{ fontSize: 13, padding: "6px 12px" }}
              onClick={() => {
                void clearDraftAndReset();
              }}
            >
              清除草稿并重置
            </button>
          </div>
        </header>

        <section className="app-panel" style={{ marginBottom: 20 }}>
          <h2 className="app-section-title">历史记录</h2>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-muted)" }}>
            每次成功「生成预览 HTML」会自动保存一条（含文字、照片与预览 HTML），最多保留{" "}
            {MAX_HISTORY} 条。
          </p>
          {history.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
              尚无历史。生成预览成功后将出现在此。
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {history.map((row) => (
                <li
                  key={row.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: "var(--panel-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <span style={{ flex: "1 1 200px", fontSize: 14 }}>
                    <strong style={{ color: "var(--text)" }}>
                      {row.snapshot.biweeklyDateRange}
                    </strong>
                    <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                      {new Date(row.savedAt).toLocaleString()}
                    </span>
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      style={{ fontSize: 13, padding: "6px 12px" }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "将用该条历史替换当前编辑区与照片，确定恢复？",
                          )
                        ) {
                          return;
                        }
                        void loadHistoryEntry(row.id);
                      }}
                    >
                      恢复
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      style={{
                        fontSize: 13,
                        padding: "6px 12px",
                        color: "var(--danger)",
                      }}
                      onClick={() => {
                        if (!window.confirm("删除这条历史记录？")) return;
                        void deleteHistoryEntry(row.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

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
