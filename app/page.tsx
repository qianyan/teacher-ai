"use client";

import { useMe } from "@/lib/auth/use-me";
import { AppHeader } from "@/components/AppHeader";
import { ReportWorkbench } from "@/components/ReportWorkbench";
import {
  DEFAULT_BODY_HTML,
  DEFAULT_BIWEEKLY_DATE_RANGE,
  DEFAULT_INTRO_HTML,
  DEFAULT_SUB_TITLE,
} from "@/lib/persistence/defaults";
import { useReportPersistence } from "@/lib/persistence/use-report-persistence";
import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { allReportPhotosSynced } from "@/lib/photos/sync-guard";
import {
  readHistorySidebarOpen,
  writeHistorySidebarOpen,
} from "@/lib/history-sidebar-storage";
import {
  toastDraftClearFailed,
  toastDraftCleared,
  toastHistoryDeleteFailed,
  toastHistoryDeleted,
} from "@/lib/user-toast";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

const HistorySidebar = dynamic(
  () =>
    import("@/components/HistorySidebar").then((m) => ({
      default: m.HistorySidebar,
    })),
  { ssr: false },
);

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
  const [advanceToPreview, setAdvanceToPreview] = useState(false);

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

  const photosSynced = useMemo(() => allReportPhotosSynced(photos), [photos]);

  const { usage, refresh: refreshUsage } = useMe();

  const generate = useCallback(async () => {
    setError(null);
    if (!allReportPhotosSynced(photos)) {
      setError("请等待全部照片同步到 Blob 后再生成。");
      return;
    }
    setLoading(true);
    setFullHtml(null);
    try {
      const photoLogicalNames = photos.map((p) => p.logicalName.trim());
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      setAdvanceToPreview(true);
      try {
        await recordHistoryAfterGenerate(data.fullHtml);
      } catch (e) {
        console.error("History save failed:", e);
      }
      void refreshUsage();
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
    refreshUsage,
  ]);

  const quotaBlockedReason =
    usage?.plan === "free" && usage.remaining !== null && usage.remaining <= 0
      ? "本月免费生成次数已用完"
      : undefined;

  const generateBlockedReason =
    quotaBlockedReason ??
    (!photosSynced && photos.length > 0 ? "请等待全部照片同步到 Blob" : undefined);

  const usageHint =
    usage?.plan === "free" && usage.remaining !== null
      ? `本月剩余 ${usage.remaining} / ${usage.limit} 次 AI 生成`
      : usage?.plan === "pro"
        ? "Pro：无限生成"
        : undefined;

  const shellClass =
    `app-shell${historySidebarOpen ? " app-shell--history-open" : ""}`;

  const handleRestoreHistory = useCallback(
    async (id: string) => {
      await loadHistoryEntry(id);
      setHistorySidebarOpen(false);
    },
    [loadHistoryEntry],
  );

  const handleClearDraft = useCallback(async () => {
    try {
      await clearDraftAndReset();
      toastDraftCleared();
    } catch (e) {
      toastDraftClearFailed(e);
    }
  }, [clearDraftAndReset]);

  const handleDeleteHistory = useCallback(
    async (id: string) => {
      try {
        await deleteHistoryEntry(id);
        toastHistoryDeleted();
      } catch (e) {
        toastHistoryDeleteFailed(e);
      }
    },
    [deleteHistoryEntry],
  );

  const handleToggleHistorySidebar = useCallback(() => {
    setHistorySidebarOpen((o) => !o);
  }, []);

  const handleCloseHistorySidebar = useCallback(() => {
    setHistorySidebarOpen(false);
  }, []);

  const handleAdvanceToPreviewConsumed = useCallback(() => {
    setAdvanceToPreview(false);
  }, []);

  if (isHydrating) {
    return (
      <main className="app-shell">
        <div className="app-hydrate-loader" role="status" aria-live="polite">
          <span className="app-hydrate-loader__face" aria-hidden>
            📒
          </span>
          <p className="app-hydrate-loader__text">正在唤醒你的简报草稿…</p>
        </div>
      </main>
    );
  }

  return (
    <main className={shellClass}>
        <AppHeader
          draftSavedAt={draftSavedAt}
          draftError={draftError}
          onClearDraft={handleClearDraft}
          historyCount={history.length}
          historySidebarOpen={historySidebarOpen}
          onToggleHistorySidebar={handleToggleHistorySidebar}
        />

        {historySidebarOpen && (
          <HistorySidebar
            open={historySidebarOpen}
            onClose={handleCloseHistorySidebar}
            history={history}
            onRestore={handleRestoreHistory}
            onDelete={handleDeleteHistory}
          />
        )}

        <ReportWorkbench
          biweeklyDateRange={biweeklyDateRange}
          setBiweeklyDateRange={setBiweeklyDateRange}
          subTitle={subTitle}
          setSubTitle={setSubTitle}
          introHtml={introHtml}
          setIntroHtml={setIntroHtml}
          bodyHtml={bodyHtml}
          setBodyHtml={setBodyHtml}
          photos={photos}
          setPhotos={setPhotos}
          fullHtml={fullHtml}
          loading={loading}
          error={error}
          generateBlockedReason={generateBlockedReason}
          usageHint={usageHint}
          onGenerate={generate}
          advanceToPreview={advanceToPreview}
          onAdvanceToPreviewConsumed={handleAdvanceToPreviewConsumed}
        />
    </main>
  );
}
