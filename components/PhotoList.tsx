"use client";

import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import {
  composeLogicalFilename,
  logicalKeyFromFilename,
  parseLogicalFilename,
} from "@/lib/photos/inject-blobs";
import { pickFullscreenPreviewUrl } from "@/lib/photos/preview-thumbnail";
import { usePhotoPreviewCache } from "@/lib/photos/use-photo-preview-cache";
import {
  decodeHeicLikeToPngBlobFromEntry,
  isHeicLikeFile,
  normalizePhotoFileForUpload,
} from "@/lib/photos/heic-preview";
import { uploadPhotoEntryToStorage } from "@/lib/photos/upload-report-storage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PhotoPreviewModal } from "@/components/PhotoPreviewModal";
import { toastHeicImportFailed, toastPhotoRemoved } from "@/lib/user-toast";
import type { CSSProperties, ChangeEvent, Dispatch, DragEvent, MouseEvent, ReactNode, SetStateAction } from "react";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

type Props = {
  photos: PhotoEntry[];
  onChange: Dispatch<SetStateAction<PhotoEntry[]>>;
};

type FilmstripItem = {
  id: string;
  index: number;
  logicalName: string;
  thumbUrl: string | null;
  loading: boolean;
  placeholderKind: "heic" | "error" | null;
  uploadStatus: PhotoEntry["uploadStatus"];
};

function newId(): string {
  return crypto.randomUUID();
}

const NAME_COMMIT_DEBOUNCE_MS = 600;

function extensionFromLogicalName(name: string): string {
  const base = name.replace(/^.*[/\\]/, "");
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot) : ".jpg";
}

function draftDefaultsFromLogicalName(name: string): { prefix: string; index: number; ext: string } {
  const parsed = parseLogicalFilename(name);
  if (parsed) return parsed;
  const ext = extensionFromLogicalName(name);
  const base = name.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/i, "");
  return { prefix: base, index: 1, ext };
}

function syncStatusLabel(status: PhotoEntry["uploadStatus"]): string {
  switch (status) {
    case "pending":
      return "等待上传";
    case "uploading":
      return "上传中";
    case "synced":
      return "已就绪";
    case "error":
      return "上传失败";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function syncBadgeClass(status: PhotoEntry["uploadStatus"]): string {
  switch (status) {
    case "pending":
      return "photo-sync-badge photo-sync-badge--pending";
    case "uploading":
      return "photo-sync-badge photo-sync-badge--uploading";
    case "synced":
      return "photo-sync-badge photo-sync-badge--synced";
    case "error":
      return "photo-sync-badge photo-sync-badge--error";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

type UploadStatusBadgeProps = {
  status: PhotoEntry["uploadStatus"];
  error: string | null;
  onRetry?: () => void;
};

function UploadStatusBadge({ status, error, onRetry }: UploadStatusBadgeProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const prevStatusRef = useRef(status);
  const retryHadFocusRef = useRef(false);

  useEffect(() => {
    if (
      prevStatusRef.current === "error" &&
      status !== "error" &&
      retryHadFocusRef.current
    ) {
      containerRef.current?.focus();
      retryHadFocusRef.current = false;
    }
    prevStatusRef.current = status;
  }, [status]);

  const handleRetryClick = useCallback(() => {
    retryHadFocusRef.current = true;
    onRetry?.();
  }, [onRetry]);

  let className = "photo-upload-status";
  let content: ReactNode;

  if (status === "synced") {
    className += " photo-upload-status--synced";
    content = "已同步";
  } else if (status === "uploading") {
    className += " photo-upload-status--uploading";
    content = (
      <>
        <span className="photo-upload-spinner" aria-hidden />
        上传中…
      </>
    );
  } else if (status === "error") {
    className += " photo-upload-status--error";
    content = (
      <>
        {error || "上传失败"}
        {onRetry && (
          <button
            type="button"
            className="photo-upload-retry"
            onClick={handleRetryClick}
            title="重试上传"
          >
            重试
          </button>
        )}
      </>
    );
  } else {
    className += " photo-upload-status--pending";
    content = (
      <>
        <span className="photo-upload-spinner" aria-hidden />
        排队上传…
      </>
    );
  }

  return (
    <span
      ref={containerRef}
      className={className}
      tabIndex={-1}
      aria-live="polite"
      aria-atomic="true"
    >
      {content}
    </span>
  );
}

async function deleteRemoteBlob(url: string | null): Promise<void> {
  if (!url) return;
  try {
    await fetch("/api/blob/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ url }),
    });
  } catch {
    /* ignore */
  }
}

type FilmstripThumbProps = {
  photoId: string;
  index: number;
  logicalName: string;
  thumbUrl: string | null;
  loading: boolean;
  placeholderKind: "heic" | "error" | null;
  uploadStatus: PhotoEntry["uploadStatus"];
  isSelected: boolean;
  isDragging: boolean;
  onThumbClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onDragStart: (e: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLButtonElement>) => void;
  onDrop: (e: DragEvent<HTMLButtonElement>) => void;
};

function PhotoFilmstripThumb({
  photoId,
  index,
  logicalName,
  thumbUrl,
  loading,
  placeholderKind,
  uploadStatus,
  isSelected,
  isDragging,
  onThumbClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: FilmstripThumbProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      draggable
      className="photo-filmstrip-thumb"
      title={logicalName}
      data-photo-id={photoId}
      data-photo-index={index}
      onClick={onThumbClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        opacity: isDragging ? 0.55 : 1,
        outline: "none",
      }}
    >
      {placeholderKind === "heic" ? (
        <HeicThumbPlaceholder />
      ) : placeholderKind === "error" ? (
        <HeicThumbPlaceholder error />
      ) : loading || !thumbUrl ? (
        <span className="photo-thumb-skeleton" aria-hidden />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            pointerEvents: "none",
          }}
        />
      )}
      <span
        className={syncBadgeClass(uploadStatus)}
        title={syncStatusLabel(uploadStatus)}
        aria-hidden
      />
    </button>
  );
}

const PhotoFilmstripThumbMemo = memo(PhotoFilmstripThumb);

type PhotoFilmstripProps = {
  items: FilmstripItem[];
  selectedId: string | null;
  draggingIndex: number | null;
  onSelectId: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onDraggingIndexChange: (index: number | null) => void;
};

const PhotoFilmstrip = memo(function PhotoFilmstrip({
  items,
  selectedId,
  draggingIndex,
  onSelectId,
  onReorder,
  onDraggingIndexChange,
}: PhotoFilmstripProps) {
  const draggingRef = useRef(draggingIndex);
  draggingRef.current = draggingIndex;

  const handleThumbClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.photoId;
      if (id) onSelectId(id);
    },
    [onSelectId],
  );

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>) => {
      const index = Number(e.currentTarget.dataset.photoIndex);
      if (Number.isNaN(index)) return;
      onDraggingIndexChange(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    [onDraggingIndexChange],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const toIndex = Number(e.currentTarget.dataset.photoIndex);
      const fromIndex = draggingRef.current;
      if (fromIndex !== null && !Number.isNaN(toIndex)) {
        onReorder(fromIndex, toIndex);
      }
      onDraggingIndexChange(null);
    },
    [onReorder, onDraggingIndexChange],
  );

  const handleDragEnd = useCallback(() => {
    onDraggingIndexChange(null);
  }, [onDraggingIndexChange]);

  return (
    <div
      className="photo-filmstrip"
      role="listbox"
      aria-label="照片缩略图"
      style={filmstripWrap}
    >
      {items.map((item) => (
        <PhotoFilmstripThumbMemo
          key={item.id}
          photoId={item.id}
          index={item.index}
          logicalName={item.logicalName}
          thumbUrl={item.thumbUrl}
          loading={item.loading}
          placeholderKind={item.placeholderKind}
          uploadStatus={item.uploadStatus}
          isSelected={item.id === selectedId}
          isDragging={draggingIndex === item.index}
          onThumbClick={handleThumbClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
});

type PhotoStagePreviewProps = {
  selected: PhotoEntry;
  stageUrl: string | null;
  loading: boolean;
  onFullscreen: () => void;
};

const PhotoStagePreview = memo(function PhotoStagePreview({
  selected,
  stageUrl,
  loading,
  onFullscreen,
}: PhotoStagePreviewProps) {
  return (
    <div className="photo-preview-stage">
      {isHeicLikeFile(selected.file) ? (
        <HeicPreviewPlaceholder minHeight={160} errorMessage={selected.ingestError} />
      ) : loading || !stageUrl ? (
        <div
          className="photo-stage-skeleton"
          style={{ minHeight: 160, maxHeight: "min(38vh, 320px)" }}
          aria-hidden
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={stageUrl}
          alt={selected.logicalName}
          decoding="async"
          onDoubleClick={() => !selected.ingestError && onFullscreen()}
          style={{
            width: "100%",
            maxHeight: "min(38vh, 320px)",
            minHeight: 160,
            objectFit: "contain",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg)",
            cursor: !selected.ingestError ? "zoom-in" : "default",
          }}
        />
      )}
      {selected.ingestError && !isHeicLikeFile(selected.file) ? (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--danger)" }}>
          {selected.ingestError}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn--secondary"
          style={{ fontSize: 13, padding: "6px 12px" }}
          disabled={isHeicLikeFile(selected.file) || !!selected.ingestError}
          onClick={onFullscreen}
        >
          全屏预览
        </button>
      </div>
    </div>
  );
});

type PhotoDetailPanelProps = {
  photo: PhotoEntry;
  index: number;
  photoCount: number;
  onChange: Dispatch<SetStateAction<PhotoEntry[]>>;
  onMove: (index: number, dir: -1 | 1) => void;
  onDeleteRequest: (photo: PhotoEntry) => void;
  onRetryUpload?: (photo: PhotoEntry) => void;
};

const PhotoDetailPanel = memo(function PhotoDetailPanel({
  photo,
  index,
  photoCount,
  onChange,
  onMove,
  onDeleteRequest,
  onRetryUpload,
}: PhotoDetailPanelProps) {
  const defaults = draftDefaultsFromLogicalName(photo.logicalName);
  const [prefix, setPrefix] = useState(defaults.prefix);
  const [indexStr, setIndexStr] = useState(String(defaults.index));
  const [validationError, setValidationError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ext = defaults.ext;

  useEffect(() => {
    const next = draftDefaultsFromLogicalName(photo.logicalName);
    setPrefix(next.prefix);
    setIndexStr(String(next.index));
    setValidationError(null);
  }, [photo.id, photo.logicalName]);

  const draftIndex = parseInt(indexStr, 10);
  const draftName =
    prefix.trim() && Number.isFinite(draftIndex) && draftIndex >= 1
      ? composeLogicalFilename(prefix, draftIndex, ext)
      : null;
  const draftKey = draftName ? logicalKeyFromFilename(draftName) : null;

  const commitDraft = useCallback(
    (nextPrefix: string, nextIndexStr: string, forceError: boolean) => {
      const nextIndex = parseInt(nextIndexStr, 10);
      if (!nextPrefix.trim() || !Number.isFinite(nextIndex) || nextIndex < 1) {
        if (forceError) {
          setValidationError("请填写前缀和大于 0 的序号");
        }
        return;
      }
      const composed = composeLogicalFilename(nextPrefix, nextIndex, ext);
      if (!logicalKeyFromFilename(composed)) {
        if (forceError) {
          setValidationError("文件名需含前缀+序号，如 特色游戏1.jpg");
        }
        return;
      }
      setValidationError(null);
      onChange((prev) =>
        prev.map((x) => {
          if (x.id !== photo.id) return x;
          if (composed === x.logicalName) return x;
          if (x.remoteUrl) {
            return { ...x, logicalName: composed, uploadError: null };
          }
          return {
            ...x,
            logicalName: composed,
            uploadStatus: "pending",
            uploadError: null,
          };
        }),
      );
    },
    [ext, onChange, photo.id],
  );

  const scheduleCommit = useCallback(
    (nextPrefix: string, nextIndexStr: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const delay = photo.remoteUrl ? 0 : NAME_COMMIT_DEBOUNCE_MS;
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        commitDraft(nextPrefix, nextIndexStr, false);
      }, delay);
    },
    [commitDraft, photo.remoteUrl],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handlePrefixChange = (value: string) => {
    setPrefix(value);
    scheduleCommit(value, indexStr);
  };

  const handleIndexChange = (value: string) => {
    setIndexStr(value);
    scheduleCommit(prefix, value);
  };

  const handleBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    commitDraft(prefix, indexStr, true);
  };

  return (
    <div className="photo-detail-panel">
      <div className="photo-name-editor">
        <label className="photo-name-field">
          <span className="photo-name-field__label">前缀</span>
          <input
            type="text"
            value={prefix}
            onChange={(e) => handlePrefixChange(e.target.value)}
            onBlur={handleBlur}
            className="app-input"
            spellCheck={false}
            placeholder="特色游戏"
          />
        </label>
        <label className="photo-name-field photo-name-field--index">
          <span className="photo-name-field__label">序号</span>
          <input
            type="number"
            min={1}
            step={1}
            value={indexStr}
            onChange={(e) => handleIndexChange(e.target.value)}
            onBlur={handleBlur}
            className="app-input"
            inputMode="numeric"
          />
        </label>
      </div>
      <p className="photo-name-preview">
        文件名预览：
        <span>{draftName ?? `${prefix || "…"}${indexStr || "…"}${ext}`}</span>
      </p>
      <div
        className={
          validationError
            ? "photo-name-mapping photo-name-mapping--error"
            : draftKey
              ? "photo-name-mapping photo-name-mapping--ok"
              : "photo-name-mapping"
        }
      >
        {validationError
          ? validationError
          : draftKey
            ? `映射: data-report-photo="${draftKey}"`
            : "填写前缀和序号后，将自动对应报告中的照片占位符"}
      </div>
      <div style={{ marginBottom: 10 }}>
        <UploadStatusBadge
          status={photo.uploadStatus}
          error={photo.uploadError}
          onRetry={onRetryUpload ? () => onRetryUpload(photo) : undefined}
        />
      </div>
      <div className="photo-detail-actions">
        <button
          type="button"
          className="photo-detail-btn"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          aria-label="上移"
        >
          ↑ 上移
        </button>
        <button
          type="button"
          className="photo-detail-btn"
          disabled={index === photoCount - 1}
          onClick={() => onMove(index, 1)}
          aria-label="下移"
        >
          ↓ 下移
        </button>
        <button
          type="button"
          className="photo-detail-btn photo-detail-btn--danger"
          onClick={() => onDeleteRequest(photo)}
        >
          删除
        </button>
      </div>
    </div>
  );
});

type PhotoGalleryProps = {
  photos: PhotoEntry[];
  onChange: Dispatch<SetStateAction<PhotoEntry[]>>;
  uploadInFlight: MutableRefObject<Set<string>>;
  pendingSelectId: string | null;
  onPendingSelectConsumed: () => void;
};

function PhotoGalleryInner({
  photos,
  onChange,
  uploadInFlight,
  pendingSelectId,
  onPendingSelectConsumed,
}: PhotoGalleryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [fullscreenEntry, setFullscreenEntry] = useState<PhotoEntry | null>(null);
  const [fullscreenStageUrl, setFullscreenStageUrl] = useState<string | null>(null);
  const [photoDeleteTarget, setPhotoDeleteTarget] = useState<PhotoEntry | null>(null);

  const { getPreviewUrls, previewRevision } = usePhotoPreviewCache(photos);

  useEffect(() => {
    if (photos.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && photos.some((p) => p.id === prev) ? prev : photos[0]!.id,
    );
  }, [photos]);

  useEffect(() => {
    if (!pendingSelectId) return;
    if (photos.some((p) => p.id === pendingSelectId)) {
      setSelectedId(pendingSelectId);
    }
    onPendingSelectConsumed();
  }, [pendingSelectId, photos, onPendingSelectConsumed]);

  const handleSelectId = useCallback((id: string) => {
    startTransition(() => setSelectedId(id));
  }, []);

  const selectedIndex = photos.findIndex((p) => p.id === selectedId);
  const selected = selectedIndex >= 0 ? photos[selectedIndex]! : null;
  const selectedPreview = selected ? getPreviewUrls(selected) : null;

  const filmstripItems = useMemo((): FilmstripItem[] => {
    void previewRevision;
    return photos.map((p, index) => {
      const preview = getPreviewUrls(p);
      return {
        id: p.id,
        index,
        logicalName: p.logicalName,
        thumbUrl: preview.thumbUrl,
        loading: preview.loading,
        placeholderKind: p.ingestError
          ? "error"
          : isHeicLikeFile(p.file)
            ? "heic"
            : null,
        uploadStatus: p.uploadStatus,
      };
    });
  }, [photos, previewRevision, getPreviewUrls]);

  const move = useCallback(
    (index: number, dir: -1 | 1) => {
      const j = index + dir;
      if (j < 0 || j >= photos.length) return;
      const next = [...photos];
      [next[index], next[j]] = [next[j]!, next[index]!];
      onChange(next);
    },
    [photos, onChange],
  );

  const reorder = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0) return;
      if (from >= photos.length || to >= photos.length) return;
      const next = [...photos];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      onChange(next);
    },
    [photos, onChange],
  );

  const handleFullscreen = useCallback(() => {
    if (selected && !selected.ingestError && !isHeicLikeFile(selected.file)) {
      // 优先复用已验证可加载的 stage 缩略图 URL（stage 预览能显示即说明该 URL 有效），
      // 避免恢复草稿/历史时 blobUrl 已失效或为 0 字节导致全屏永久卡 loading。
      const stageUrl = selectedPreview?.stageUrl ?? null;
      setFullscreenStageUrl(stageUrl);
      setFullscreenEntry(selected);
    }
  }, [selected, selectedPreview]);

  const retryUpload = useCallback(
    (photo: PhotoEntry) => {
      uploadInFlight.current.delete(photo.id);
      onChange((prev) =>
        prev.map((x) =>
          x.id === photo.id
            ? {
                ...x,
                uploadStatus: "pending",
                uploadError: null,
                uploadGeneration: x.uploadGeneration + 1,
              }
            : x,
        ),
      );
    },
    [onChange, uploadInFlight],
  );

  return (
    <>
      {selected && selectedPreview ? (
        <PhotoStagePreview
          selected={selected}
          stageUrl={selectedPreview.stageUrl}
          loading={selectedPreview.loading}
          onFullscreen={handleFullscreen}
        />
      ) : null}

      <PhotoFilmstrip
        items={filmstripItems}
        selectedId={selectedId}
        draggingIndex={draggingIndex}
        onSelectId={handleSelectId}
        onReorder={reorder}
        onDraggingIndexChange={setDraggingIndex}
      />

      {selected && selectedIndex >= 0 ? (
        <PhotoDetailPanel
          photo={selected}
          index={selectedIndex}
          photoCount={photos.length}
          onChange={onChange}
          onMove={move}
          onDeleteRequest={setPhotoDeleteTarget}
          onRetryUpload={retryUpload}
        />
      ) : null}

      <ConfirmDialog
        open={photoDeleteTarget !== null}
        title="删除这张照片？"
        description={
          photoDeleteTarget
            ? `将从列表移除「${photoDeleteTarget.logicalName}」，若已同步到 Blob 会尝试删除远端文件。`
            : undefined
        }
        confirmLabel="删除"
        tone="danger"
        onCancel={() => setPhotoDeleteTarget(null)}
        onConfirm={() => {
          const p = photoDeleteTarget;
          if (!p) return;
          void deleteRemoteBlob(p.remoteUrl);
          uploadInFlight.current.delete(p.id);
          URL.revokeObjectURL(p.blobUrl);
          onChange((prev) => prev.filter((x) => x.id !== p.id));
          toastPhotoRemoved(p.logicalName);
          setPhotoDeleteTarget(null);
        }}
      />

      {fullscreenEntry &&
        !isHeicLikeFile(fullscreenEntry.file) &&
        !fullscreenEntry.ingestError && (
          <PhotoPreviewModal
            imageUrl={
              fullscreenStageUrl ?? pickFullscreenPreviewUrl(fullscreenEntry)
            }
            fileName={fullscreenEntry.logicalName}
            onClose={() => {
              setFullscreenEntry(null);
              setFullscreenStageUrl(null);
            }}
          />
        )}
    </>
  );
}

const PhotoGallery = memo(PhotoGalleryInner);

function PhotoListInner({ photos, onChange }: Props) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInFlight = useRef(new Set<string>());
  const heicMigrateInFlight = useRef(new Set<string>());
  const [importBusy, setImportBusy] = useState(false);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);

  const clearPendingSelect = useCallback(() => setPendingSelectId(null), []);

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      if (!files.length) return;
      const next: PhotoEntry[] = [...photos];
      let firstNewId: string | null = null;
      for (const raw of files) {
        let file: File;
        try {
          file = await normalizePhotoFileForUpload(raw);
        } catch (err) {
          toastHeicImportFailed(raw.name, err);
          continue;
        }
        const id = newId();
        if (!firstNewId) firstNewId = id;
        next.push({
          id,
          file,
          logicalName: file.name,
          blobUrl: URL.createObjectURL(file),
          remoteUrl: null,
          remotePathname: null,
          uploadStatus: "pending",
          uploadError: null,
          uploadGeneration: 0,
          ingestError: null,
        });
      }
      if (firstNewId) {
        onChange(next);
        setPendingSelectId(firstNewId);
      }
    },
    [photos, onChange],
  );

  const handleFileInputChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      e.target.value = "";
      setImportBusy(true);
      try {
        await addFiles(files);
      } finally {
        setImportBusy(false);
      }
    },
    [addFiles],
  );

  useEffect(() => {
    const pending = photos.filter(
      (p) =>
        p.uploadStatus === "pending" &&
        !p.remoteUrl &&
        logicalKeyFromFilename(p.logicalName.trim()),
    );
    for (const snapshot of pending) {
      if (uploadInFlight.current.has(snapshot.id)) continue;
      uploadInFlight.current.add(snapshot.id);
      const gen = snapshot.uploadGeneration;
      void (async () => {
        try {
          onChange((prev) =>
            prev.map((x) =>
              x.id === snapshot.id ? { ...x, uploadStatus: "uploading", uploadError: null } : x,
            ),
          );
          const result = await uploadPhotoEntryToStorage(snapshot);
          onChange((prev) =>
            prev.map((x) => {
              if (x.id !== snapshot.id) return x;
              if (x.uploadGeneration !== gen) {
                void deleteRemoteBlob(result.url);
                return x;
              }
              return {
                ...x,
                remoteUrl: result.url,
                remotePathname: result.pathname,
                uploadStatus: "synced",
                uploadError: null,
              };
            }),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "上传失败";
          onChange((prev) =>
            prev.map((x) => {
              if (x.id !== snapshot.id) return x;
              if (x.uploadGeneration !== gen) return x;
              return { ...x, uploadStatus: "error", uploadError: msg };
            }),
          );
        } finally {
          uploadInFlight.current.delete(snapshot.id);
        }
      })();
    }
  }, [photos, onChange]);

  useEffect(() => {
    for (const p of photos) {
      if (!isHeicLikeFile(p.file)) continue;
      if (p.ingestError) continue;
      if (heicMigrateInFlight.current.has(p.id)) continue;
      heicMigrateInFlight.current.add(p.id);
      const id = p.id;
      const oldBlobUrl = p.blobUrl;
      const hadRemote = Boolean(p.remoteUrl?.trim());
      void (async () => {
        try {
          const pngBlob = await decodeHeicLikeToPngBlobFromEntry({
            file: p.file,
            logicalName: p.logicalName,
            remoteUrl: p.remoteUrl,
          });
          const base = p.logicalName.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/i, "");
          const newLogical = `${base || "photo"}.png`;
          const pngFile = new File([pngBlob], newLogical, { type: "image/png" });
          if (hadRemote) await deleteRemoteBlob(p.remoteUrl);
          const newBlobUrl = URL.createObjectURL(pngFile);
          onChange((prev) => {
            if (!prev.some((x) => x.id === id)) {
              URL.revokeObjectURL(newBlobUrl);
              return prev;
            }
            return prev.map((x) => {
              if (x.id !== id) return x;
              if (oldBlobUrl.startsWith("blob:")) {
                try {
                  URL.revokeObjectURL(oldBlobUrl);
                } catch {
                  /* ignore */
                }
              }
              return {
                ...x,
                file: pngFile,
                logicalName: newLogical,
                blobUrl: newBlobUrl,
                remoteUrl: null,
                remotePathname: null,
                uploadStatus: "pending",
                uploadError: null,
                uploadGeneration: x.uploadGeneration + 1,
                ingestError: null,
              };
            });
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "HEIC 转 PNG 失败";
          toastHeicImportFailed(p.logicalName, err);
          onChange((prev) => {
            if (!prev.some((x) => x.id === id)) return prev;
            return prev.map((x) => (x.id === id ? { ...x, ingestError: msg } : x));
          });
        } finally {
          heicMigrateInFlight.current.delete(id);
        }
      })();
    }
  }, [photos, onChange]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="photo-upload-toolbar">
        <span className="photo-upload-toolbar__label">照片</span>
        <div className="photo-upload-toolbar__actions">
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="btn btn--secondary photo-upload-btn"
            disabled={importBusy}
          >
            {importBusy ? "处理中…" : "📷 导入照片"}
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="btn btn--primary photo-upload-btn photo-upload-btn--camera"
            disabled={importBusy}
            title="直接拍照"
          >
            📸 拍照
          </button>
        </div>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={handleFileInputChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
          hidden
          onChange={handleFileInputChange}
        />
      </div>

      <p className="photo-upload-hint">
        HEIC/HEIF 会在导入时转为 PNG 再上传；文件名需「前缀+数字」如 探究1.jpg；选中下方缩略图可编辑名称与排序
      </p>

      {photos.length === 0 ? (
        <p className="photo-empty-state">
          尚未添加照片
        </p>
      ) : (
        <PhotoGallery
          photos={photos}
          onChange={onChange}
          uploadInFlight={uploadInFlight}
          pendingSelectId={pendingSelectId}
          onPendingSelectConsumed={clearPendingSelect}
        />
      )}
    </div>
  );
}

export const PhotoList = memo(PhotoListInner);

const filmstripWrap: CSSProperties = {
  display: "flex",
  gap: 10,
  overflowX: "auto",
  overflowY: "hidden",
  padding: "10px 4px 12px",
  marginBottom: 4,
  scrollbarWidth: "thin",
  WebkitOverflowScrolling: "touch",
};

function HeicThumbPlaceholder({ error = false }: { error?: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--border-subtle)",
        color: error ? "var(--danger)" : "var(--text-muted)",
        fontSize: 14,
        fontWeight: 600,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {error ? "!" : "⋯"}
    </div>
  );
}

function HeicPreviewPlaceholder({
  minHeight,
  errorMessage,
}: {
  minHeight: number;
  errorMessage: string | null;
}) {
  const err = Boolean(errorMessage);
  return (
    <div
      style={{
        width: "100%",
        minHeight,
        maxHeight: "min(38vh, 320px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        background: "var(--border-subtle)",
        color: err ? "var(--danger)" : "var(--text-muted)",
        fontSize: 14,
        gap: 6,
        padding: "0 12px",
        textAlign: "center",
      }}
    >
      {err ? (
        <>
          <span>HEIC 转 PNG 失败</span>
          <span style={{ fontSize: 12, opacity: 0.95 }}>{errorMessage}</span>
        </>
      ) : (
        <>
          <span>HEIC 转 PNG 中…</span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>大文件可能需数秒</span>
        </>
      )}
    </div>
  );
}
