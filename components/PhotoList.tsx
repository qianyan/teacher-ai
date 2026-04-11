"use client";

import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { logicalKeyFromFilename } from "@/lib/photos/inject-blobs";
import type { CSSProperties } from "react";
import { useCallback, useRef, useState } from "react";
import { PhotoPreviewModal } from "@/components/PhotoPreviewModal";

type Props = {
  photos: PhotoEntry[];
  onChange: (photos: PhotoEntry[]) => void;
};

function newId(): string {
  return crypto.randomUUID();
}

export function PhotoList({ photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [preview, setPreview] = useState<PhotoEntry | null>(null);

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const next: PhotoEntry[] = [...photos];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        next.push({
          id: newId(),
          file,
          logicalName: file.name,
          blobUrl: URL.createObjectURL(file),
        });
      }
      onChange(next);
    },
    [photos, onChange],
  );

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
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          文件名需符合「前缀+数字」如 探究1.jpg；可拖拽排序或点击预览
        </span>
      </div>
      {photos.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
          尚未添加照片
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--panel-elevated)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {photos.map((p, index) => {
            const key = logicalKeyFromFilename(p.logicalName);
            const isDragging = draggingIndex === index;
            return (
              <li
                key={p.id}
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
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 80px minmax(0, 1fr) auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "12px 14px",
                  borderBottom:
                    index < photos.length - 1
                      ? "1px solid var(--border-subtle)"
                      : "none",
                  fontSize: 14,
                  opacity: isDragging ? 0.65 : 1,
                  background: isDragging ? "var(--accent-soft)" : undefined,
                }}
              >
                <span
                  draggable
                  title="拖拽排序"
                  onDragStart={(e) => {
                    setDraggingIndex(index);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(index));
                  }}
                  onDragEnd={() => setDraggingIndex(null)}
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    userSelect: "none",
                    letterSpacing: 1,
                    cursor: isDragging ? "grabbing" : "grab",
                  }}
                  aria-hidden
                >
                  ⋮⋮
                </span>
                <button
                  type="button"
                  onClick={() => setPreview(p)}
                  style={thumbBtn}
                  title="预览大图"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.blobUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      pointerEvents: "none",
                    }}
                  />
                </button>
                <div style={{ minWidth: 0 }}>
                  <input
                    type="text"
                    value={p.logicalName}
                    onChange={(e) => {
                      const name = e.target.value;
                      onChange(
                        photos.map((x) =>
                          x.id === p.id ? { ...x, logicalName: name } : x,
                        ),
                      );
                    }}
                    className="app-input"
                    style={{ marginBottom: 6 }}
                    spellCheck={false}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    style={{
                      fontSize: 12,
                      color: key ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {key
                      ? `映射占位符: data-report-photo="${key}"`
                      : "无法解析前缀+序号，请改为如 特色游戏1.jpg"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      style={smallBtn}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      style={smallBtn}
                      disabled={index === photos.length - 1}
                      onClick={() => move(index, 1)}
                      title="下移"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    style={{ ...smallBtn, color: "var(--danger)" }}
                    onClick={() => {
                      URL.revokeObjectURL(p.blobUrl);
                      onChange(photos.filter((x) => x.id !== p.id));
                    }}
                  >
                    删除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {preview && (
        <PhotoPreviewModal
          imageUrl={preview.blobUrl}
          fileName={preview.logicalName}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

const thumbBtn: CSSProperties = {
  width: 80,
  height: 45,
  padding: 0,
  border: "1px solid var(--border)",
  borderRadius: 6,
  overflow: "hidden",
  cursor: "zoom-in",
  background: "var(--bg)",
};

const smallBtn: CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  cursor: "pointer",
  fontFamily: "inherit",
};
