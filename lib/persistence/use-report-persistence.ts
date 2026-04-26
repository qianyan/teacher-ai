"use client";

import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  hydrateStateFromSnapshot,
  revokePhotoEntryBlobUrls,
} from "./deserialize";
import {
  clearDraftStore,
  getDraft,
  putDraft,
} from "./idb";
import {
  addHistoryRemote,
  deleteHistoryRemote,
  getHistoryEntryRemote,
  listHistoryRemote,
} from "./history-api";
import { snapshotFromState } from "./serialize";
import type { HistoryRecord, HydratedEditorState } from "./types";

const DEBOUNCE_MS = 1000;

export type UseReportPersistenceParams = {
  biweeklyDateRange: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  photos: PhotoEntry[];
  fullHtml: string | null;
  setBiweeklyDateRange: (v: string) => void;
  setSubTitle: (v: string) => void;
  setIntroHtml: (v: string) => void;
  setBodyHtml: (v: string) => void;
  setPhotos: (v: PhotoEntry[] | ((prev: PhotoEntry[]) => PhotoEntry[])) => void;
  setFullHtml: (v: string | null) => void;
  defaultState: HydratedEditorState;
};

export function useReportPersistence(params: UseReportPersistenceParams) {
  const {
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
    defaultState,
  } = params;

  const [isHydrating, setIsHydrating] = useState(true);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  const stateRef = useRef({
    biweeklyDateRange,
    subTitle,
    introHtml,
    bodyHtml,
    photos,
    fullHtml,
  });
  stateRef.current = {
    biweeklyDateRange,
    subTitle,
    introHtml,
    bodyHtml,
    photos,
    fullHtml,
  };

  const settersRef = useRef({
    setBiweeklyDateRange,
    setSubTitle,
    setIntroHtml,
    setBodyHtml,
    setPhotos,
    setFullHtml,
  });
  settersRef.current = {
    setBiweeklyDateRange,
    setSubTitle,
    setIntroHtml,
    setBodyHtml,
    setPhotos,
    setFullHtml,
  };

  const applyHydratedState = useCallback((h: HydratedEditorState) => {
    const s = settersRef.current;
    s.setBiweeklyDateRange(h.biweeklyDateRange);
    s.setSubTitle(h.subTitle);
    s.setIntroHtml(h.introHtml);
    s.setBodyHtml(h.bodyHtml);
    s.setFullHtml(h.fullHtml);
    s.setPhotos(h.photos);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const draft = await getDraft();
        if (cancelled) return;
        if (draft?.snapshot) {
          const h = hydrateStateFromSnapshot(draft.snapshot);
          applyHydratedState(h);
          setDraftSavedAt(draft.updatedAt);
        }
        setHistory(await listHistoryRemote());
      } catch (e) {
        console.error(e);
        setDraftError(e instanceof Error ? e.message : "加载草稿失败");
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyHydratedState]);

  useEffect(() => {
    if (isHydrating) return;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const snap = snapshotFromState(stateRef.current);
          await putDraft(snap);
          setDraftSavedAt(Date.now());
          setDraftError(null);
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "草稿保存失败";
          const quota =
            e instanceof DOMException && e.name === "QuotaExceededError"
              ? "浏览器存储空间不足，请删除部分历史记录或缩小图片。"
              : msg;
          setDraftError(quota);
        }
      })();
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [
    isHydrating,
    biweeklyDateRange,
    subTitle,
    introHtml,
    bodyHtml,
    photos,
    fullHtml,
  ]);

  const flushDraft = useCallback(() => {
    if (isHydrating) return;
    void (async () => {
      try {
        const snap = snapshotFromState(stateRef.current);
        await putDraft(snap);
        setDraftSavedAt(Date.now());
        setDraftError(null);
      } catch {
        /* best-effort */
      }
    })();
  }, [isHydrating]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flushDraft);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flushDraft);
    };
  }, [flushDraft]);

  const recordHistoryAfterGenerate = useCallback(
    async (newFullHtml: string) => {
      const snap = snapshotFromState({
        ...stateRef.current,
        fullHtml: newFullHtml,
      });
      await addHistoryRemote(snap);
      setHistory(await listHistoryRemote());
    },
    [],
  );

  const loadHistoryEntry = useCallback(
    async (id: string) => {
      const row = await getHistoryEntryRemote(id);
      if (!row) return;
      revokePhotoEntryBlobUrls(stateRef.current.photos);
      const h = hydrateStateFromSnapshot(row.snapshot);
      applyHydratedState(h);
      try {
        const snap = snapshotFromState({
          biweeklyDateRange: h.biweeklyDateRange,
          subTitle: h.subTitle,
          introHtml: h.introHtml,
          bodyHtml: h.bodyHtml,
          fullHtml: h.fullHtml,
          photos: h.photos,
        });
        await putDraft(snap);
        setDraftSavedAt(Date.now());
        setDraftError(null);
      } catch (e) {
        setDraftError(
          e instanceof Error ? e.message : "恢复后保存草稿失败",
        );
      }
    },
    [applyHydratedState],
  );

  const deleteHistoryEntry = useCallback(async (id: string) => {
    await deleteHistoryRemote(id);
    setHistory(await listHistoryRemote());
  }, []);

  const clearDraftAndReset = useCallback(async () => {
    revokePhotoEntryBlobUrls(stateRef.current.photos);
    await clearDraftStore();
    applyHydratedState(defaultState);
    setDraftSavedAt(null);
    setDraftError(null);
  }, [applyHydratedState, defaultState]);

  return {
    isHydrating,
    draftSavedAt,
    draftError,
    history,
    recordHistoryAfterGenerate,
    loadHistoryEntry,
    deleteHistoryEntry,
    clearDraftAndReset,
  };
}
