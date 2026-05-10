"use client";

import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import {
  logicalKeyFromFilename,
  pickPreviewImageUrl,
} from "@/lib/photos/inject-blobs";
import {
  decodeHeicLikeToPngBlobFromEntry,
  isHeicLikeFile,
} from "@/lib/photos/heic-preview";
import { uploadPhotoEntryToBlob } from "@/lib/photos/upload-report-blobs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PhotoPreviewModal } from "@/components/PhotoPreviewModal";
import { toastPhotoRemoved } from "@/lib/user-toast";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  photos: PhotoEntry[];
  onChange: Dispatch<SetStateAction<PhotoEntry[]>>;
};

function newId(): string {
  return crypto.randomUUID();
}

async function deleteRemoteBlob(url: string | null): Promise<void> {
  if (!url) return;
  try {
    await fetch("/api/blob/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    /* ignore */
  }
}

export function PhotoList({ photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadInFlight = useRef(new Set<string>());
  const heicDecodeInFlight = useRef(new Set<string>());
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullscreenEntry, setFullscreenEntry] = useState<PhotoEntry | null>(null);
  const [photoDeleteTarget, setPhotoDeleteTarget] = useState<PhotoEntry | null>(null);

  useEffect(() => {
    if (photos.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && photos.some((p) => p.id === prev) ? prev : photos[0].id,
    );
  }, [photos]);

  const selectedIndex = photos.findIndex((p) => p.id === selectedId);
  const selected = selectedIndex >= 0 ? photos[selectedIndex] : null;

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const next: PhotoEntry[] = [...photos];
      let firstNewId: string | null = null;
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const id = newId();
        if (!firstNewId) firstNewId = id;
        const heic = isHeicLikeFile(file);
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
          previewReady: !heic,
          previewError: null,
        });
      }
      onChange(next);
      if (firstNewId) setSelectedId(firstNewId);
    },
    [photos, onChange],
  );

  useEffect(() => {
    const pending = photos.filter((p) => p.uploadStatus === "pending");
    for (const snapshot of pending) {
      if (uploadInFlight.current.has(snapshot.id)) continue;
      if (!logicalKeyFromFilename(snapshot.logicalName.trim())) {
        onChange((prev) =>
          prev.map((x) =>
            x.id === snapshot.id && x.uploadStatus === "pending"
              ? {
                  ...x,
                  uploadStatus: "error",
                  uploadError: "文件名需含前缀+序号，如 探究1.jpg",
                }
              : x,
          ),
        );
        continue;
      }
      uploadInFlight.current.add(snapshot.id);
      const gen = snapshot.uploadGeneration;
      void (async () => {
        try {
          onChange((prev) =>
            prev.map((x) =>
              x.id === snapshot.id ? { ...x, uploadStatus: "uploading", uploadError: null } : x,
            ),
          );
          const result = await uploadPhotoEntryToBlob(snapshot);
          onChange((prev) =>
            prev.map((x) => {
              if (x.id !== snapshot.id) return x;
              if (x.uploadGeneration !== gen) return x;
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
      if (p.previewReady) continue;
      if (heicDecodeInFlight.current.has(p.id)) continue;
      heicDecodeInFlight.current.add(p.id);
      const id = p.id;
      const oldUrl = p.blobUrl;
      const revokeOld = oldUrl.startsWith("blob:");
      void (async () => {
        try {
          const pngBlob = await decodeHeicLikeToPngBlobFromEntry({
            file: p.file,
            logicalName: p.logicalName,
            remoteUrl: p.remoteUrl,
          });
          const newUrl = URL.createObjectURL(pngBlob);
          onChange((prev) => {
            if (!prev.some((x) => x.id === id)) {
              URL.revokeObjectURL(newUrl);
              return prev;
            }
            return prev.map((x) =>
              x.id === id
                ? { ...x, blobUrl: newUrl, previewReady: true, previewError: null }
                : x,
            );
          });
          if (revokeOld) URL.revokeObjectURL(oldUrl);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "HEIC 解码失败";
          onChange((prev) => {
            if (!prev.some((x) => x.id === id)) return prev;
            return prev.map((x) =>
              x.id === id ? { ...x, previewReady: true, previewError: msg } : x,
            );
          });
        } finally {
          heicDecodeInFlight.current.delete(id);
        }
      })();
    }
  }, [photos, onChange]);

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    if (from >= photos.length || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>
          照片
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn btn--secondary"
        >
          导入多张照片
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          支持 HEIC/HEIF（自动转为预览用 PNG）；文件名需「前缀+数字」如 探究1.jpg；缩略图栏拖拽排序，下方编辑当前选中项
        </span>
      </div>

      {photos.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
          尚未添加照片
        </p>
      ) : (
        <>
          <div className="photo-preview-stage">
            {selected ? (
              <>
                {isHeicLikeFile(selected.file) && !selected.previewReady ? (
                  <HeicPreviewPlaceholder
                    previewError={selected.previewError}
                    minHeight={160}
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={pickPreviewImageUrl(selected)}
                    alt={selected.logicalName}
                    onDoubleClick={() =>
                      selected.previewReady && setFullscreenEntry(selected)
                    }
                    style={{
                      width: "100%",
                      maxHeight: "min(38vh, 320px)",
                      minHeight: 160,
                      objectFit: "contain",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg)",
                      cursor: selected.previewReady ? "zoom-in" : "default",
                    }}
                  />
                )}
                {selected.previewError ? (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 13,
                      color: "var(--danger)",
                    }}
                  >
                    {selected.previewError}
                  </p>
                ) : null}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    style={{ fontSize: 13, padding: "6px 12px" }}
                    disabled={!selected.previewReady}
                    title={
                      !selected.previewReady ? "HEIC 正在解码，请稍候" : undefined
                    }
                    onClick={() => setFullscreenEntry(selected)}
                  >
                    全屏预览
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div
            className="photo-filmstrip"
            role="listbox"
            aria-label="照片缩略图"
            style={filmstripWrap}
          >
            {photos.map((p, index) => {
              const isSel = p.id === selectedId;
              const isDragging = draggingIndex === index;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  draggable
                  className="photo-filmstrip-thumb"
                  title={p.logicalName}
                  onClick={() => setSelectedId(p.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingIndex !== null) {
                      reorder(draggingIndex, index);
                      setDraggingIndex(null);
                    }
                  }}
                  onDragStart={(e) => {
                    setDraggingIndex(index);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(index));
                  }}
                  onDragEnd={() => setDraggingIndex(null)}
                  style={{
                    opacity: isDragging ? 0.55 : 1,
                    outline: "none",
                  }}
                >
                  {isHeicLikeFile(p.file) && !p.previewReady ? (
                    <HeicThumbPlaceholder previewError={p.previewError} />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={pickPreviewImageUrl(p)}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {selected && selectedIndex >= 0 ? (
            <div
              style={{
                marginTop: 14,
                padding: "14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--panel-elevated)",
              }}
            >
              {(() => {
                const p = selected;
                const index = selectedIndex;
                const key = logicalKeyFromFilename(p.logicalName);
                return (
                  <>
                    <input
                      type="text"
                      value={p.logicalName}
                      onChange={(e) => {
                        const name = e.target.value;
                        onChange(
                          photos.map((x) => {
                            if (x.id !== p.id) return x;
                            if (name === x.logicalName) return x;
                            void deleteRemoteBlob(x.remoteUrl);
                            uploadInFlight.current.delete(x.id);
                            return {
                              ...x,
                              logicalName: name,
                              remoteUrl: null,
                              remotePathname: null,
                              uploadStatus: "pending",
                              uploadError: null,
                              uploadGeneration: x.uploadGeneration + 1,
                            };
                          }),
                        );
                      }}
                      className="app-input"
                      style={{ marginBottom: 8 }}
                      spellCheck={false}
                    />
                    <div
                      style={{
                        fontSize: 12,
                        color: key ? "var(--success)" : "var(--danger)",
                        marginBottom: 6,
                      }}
                    >
                      {key
                        ? `映射: data-report-photo="${key}"`
                        : "无法解析前缀+序号，请改为如 特色游戏1.jpg"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                      {p.uploadStatus === "pending" && "Blob：排队上传…"}
                      {p.uploadStatus === "uploading" && "Blob：上传中…"}
                      {p.uploadStatus === "synced" && p.remoteUrl && "Blob：已同步"}
                      {p.uploadStatus === "error" && (
                        <span style={{ color: "var(--danger)" }}>
                          Blob：{p.uploadError || "同步失败"}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={smallBtn}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        style={smallBtn}
                        disabled={index === photos.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        style={{ ...smallBtn, color: "var(--danger)" }}
                        onClick={() => setPhotoDeleteTarget(p)}
                      >
                        删除
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
        </>
      )}

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

      {fullscreenEntry && fullscreenEntry.previewReady && (
        <PhotoPreviewModal
          imageUrl={pickPreviewImageUrl(fullscreenEntry)}
          fileName={fullscreenEntry.logicalName}
          onClose={() => setFullscreenEntry(null)}
        />
      )}
    </div>
  );
}

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

function HeicThumbPlaceholder({ previewError }: { previewError: string | null }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--border-subtle)",
        color: previewError ? "var(--danger)" : "var(--text-muted)",
        fontSize: 14,
        fontWeight: 600,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {previewError ? "!" : "⋯"}
    </div>
  );
}

function HeicPreviewPlaceholder({
  previewError,
  minHeight,
}: {
  previewError: string | null;
  minHeight: number;
}) {
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
        color: previewError ? "var(--danger)" : "var(--text-muted)",
        fontSize: 14,
        gap: 6,
      }}
    >
      {previewError ? (
        <span>无法显示预览</span>
      ) : (
        <>
          <span>HEIC 解码中…</span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>大文件可能需数秒</span>
        </>
      )}
    </div>
  );
}

const smallBtn: CSSProperties = {
  padding: "6px 12px",
  fontSize: 13,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  cursor: "pointer",
  fontFamily: "inherit",
};
