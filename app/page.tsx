"use client";

import { AppHeader } from "@/components/AppHeader";
import { HistorySidebar } from "@/components/HistorySidebar";
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
import { useReportPersistence } from "@/lib/persistence/use-report-persistence";
import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import {
  readHistorySidebarOpen,
  writeHistorySidebarOpen,
} from "@/lib/history-sidebar-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

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

  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);

  useEffect(() => {
    setHistorySidebarOpen(readHistorySidebarOpen());
  }, []);

  useEffect(() => {
    writeHistorySidebarOpen(historySidebarOpen);
  }, [historySidebarOpen]);

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

  const shellClass =
    `app-shell${historySidebarOpen ? " app-shell--history-open" : ""}`;

  const handleRestoreHistory = useCallback(
    (id: string) => {
      void loadHistoryEntry(id);
      setHistorySidebarOpen(false);
    },
    [loadHistoryEntry],
  );

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
      <main className={shellClass}>
        <AppHeader
          draftSavedAt={draftSavedAt}
          draftError={draftError}
          onClearDraft={() => {
            void clearDraftAndReset();
          }}
          historyCount={history.length}
          historySidebarOpen={historySidebarOpen}
          onToggleHistorySidebar={() =>
            setHistorySidebarOpen((o) => !o)
          }
        />

        <HistorySidebar
          open={historySidebarOpen}
          onClose={() => setHistorySidebarOpen(false)}
          history={history}
          onRestore={handleRestoreHistory}
          onDelete={(id) => {
            void deleteHistoryEntry(id);
          }}
        />

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
