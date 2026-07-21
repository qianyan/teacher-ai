"use client";

import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { photoPersistSignature } from "@/lib/photos/inject-blobs";
import type { ReportTemplateId } from "@/lib/report/templates";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const TEXT_DEBOUNCE_MS = 1000;
const PHOTO_DEBOUNCE_MS = 2500;

export type UseReportPersistenceParams = {
  templateId: ReportTemplateId;
  setTemplateId: (v: ReportTemplateId) => void;
  biweeklyDateRange: string;
  englishClassName: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  photos: PhotoEntry[];
  fullHtml: string | null;
  setBiweeklyDateRange: (v: string) => void;
  setEnglishClassName: (v: string) => void;
  setSubTitle: (v: string) => void;
  setIntroHtml: (v: string) => void;
  setBodyHtml: (v: string) => void;
  setPhotos: (v: PhotoEntry[] | ((prev: PhotoEntry[]) => PhotoEntry[])) => void;
  setFullHtml: (v: string | null) => void;
  defaultState: HydratedEditorState;
};

export function useReportPersistence(params: UseReportPersistenceParams) {
  const {
    templateId,
    setTemplateId,
    biweeklyDateRange,
    englishClassName,
    subTitle,
    introHtml,
    bodyHtml,
    photos,
    fullHtml,
    setBiweeklyDateRange,
    setEnglishClassName,
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
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  const stateRef = useRef({
    templateId,
    biweeklyDateRange,
    englishClassName,
    subTitle,
    introHtml,
    bodyHtml,
    photos,
    fullHtml,
  });
  stateRef.current = {
    templateId,
    biweeklyDateRange,
    englishClassName,
    subTitle,
    introHtml,
    bodyHtml,
    photos,
    fullHtml,
  };

  const settersRef = useRef({
    setTemplateId,
    setBiweeklyDateRange,
    setEnglishClassName,
    setSubTitle,
    setIntroHtml,
    setBodyHtml,
    setPhotos,
    setFullHtml,
  });
  settersRef.current = {
    setTemplateId,
    setBiweeklyDateRange,
    setEnglishClassName,
    setSubTitle,
    setIntroHtml,
    setBodyHtml,
    setPhotos,
    setFullHtml,
  };

  const photoSig = useMemo(() => photoPersistSignature(photos), [photos]);

  const inFlightSavesRef = useRef(0);

  const applyHydratedState = useCallback((h: HydratedEditorState) => {
    const s = settersRef.current;
    s.setTemplateId(h.templateId);
    s.setBiweeklyDateRange(h.biweeklyDateRange);
    s.setEnglishClassName(h.englishClassName);
    s.setSubTitle(h.subTitle);
    s.setIntroHtml(h.introHtml);
    s.setBodyHtml(h.bodyHtml);
    s.setFullHtml(h.fullHtml);
    s.setPhotos(h.photos);
  }, []);

  const persistDraft = useCallback(async () => {
    inFlightSavesRef.current += 1;
    setIsSaving(inFlightSavesRef.current > 0);
    try {
      const snap = snapshotFromState(stateRef.current);
      await putDraft(snap);
      setDraftSavedAt(Date.now());
      setDraftError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "草稿保存失败";
      const quota =
        e instanceof DOMException && e.name === "QuotaExceededError"
          ? "浏览器存储空间不足，请删除部分历史记录或缩小图片。"
          : msg;
      setDraftError(quota);
    } finally {
      inFlightSavesRef.current = Math.max(0, inFlightSavesRef.current - 1);
      setIsSaving(inFlightSavesRef.current > 0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [draft, historyRows] = await Promise.all([
          getDraft(),
          listHistoryRemote(),
        ]);
        if (cancelled) return;
        if (draft?.snapshot) {
          const h = hydrateStateFromSnapshot(draft.snapshot);
          applyHydratedState(h);
          setDraftSavedAt(draft.updatedAt);
        }
        setHistory(historyRows);
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
      void persistDraft();
    }, TEXT_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [
    isHydrating,
    templateId,
    biweeklyDateRange,
    englishClassName,
    subTitle,
    introHtml,
    bodyHtml,
    persistDraft,
  ]);

  useEffect(() => {
    if (isHydrating) return;
    const t = window.setTimeout(() => {
      void persistDraft();
    }, PHOTO_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [isHydrating, photoSig, persistDraft]);

  useEffect(() => {
    if (isHydrating || fullHtml === null) return;
    void persistDraft();
  }, [isHydrating, fullHtml, persistDraft]);

  const flushDraft = useCallback(() => {
    if (isHydrating) return;
    void persistDraft();
  }, [isHydrating, persistDraft]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flushDraft);

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // If a save is currently in flight, prompt the user to wait before leaving.
      // Modern browsers show a generic confirmation; the message itself is ignored.
      if (inFlightSavesRef.current === 0) return;
      flushDraft();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flushDraft);
      window.removeEventListener("beforeunload", onBeforeUnload);
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
          templateId: h.templateId,
          biweeklyDateRange: h.biweeklyDateRange,
          englishClassName: h.englishClassName,
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
    isSaving,
    history,
    recordHistoryAfterGenerate,
    loadHistoryEntry,
    deleteHistoryEntry,
    clearDraftAndReset,
  };
}
