"use client";

import type { PhotoEntry } from "@/lib/photos/inject-blobs";
import { logicalKeyFromFilename } from "@/lib/photos/inject-blobs";
import type { CSSProperties } from "react";
import { useCallback, useRef } from "react";

type Props = {
  photos: PhotoEntry[];
  onChange: (photos: PhotoEntry[]) => void;
};

function newId(): string {
  return crypto.randomUUID();
}

export function PhotoList({ photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>照片</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={btnStyle}
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
        <span style={{ fontSize: 13, color: "#718096" }}>
          文件名需符合「前缀+数字」如 探究1.jpg，可在下列编辑
        </span>
      </div>
      {photos.length === 0 ? (
        <p style={{ fontSize: 14, color: "#a0aec0", margin: 0 }}>尚未添加照片</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          {photos.map((p, index) => {
            const key = logicalKeyFromFilename(p.logicalName);
            return (
              <li
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr auto",
                  gap: 8,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 14,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.blobUrl}
                  alt=""
                  style={{
                    width: 64,
                    height: 36,
                    objectFit: "cover",
                    borderRadius: 4,
                  }}
                />
                <div>
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
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                    }}
                    spellCheck={false}
                  />
                  <div style={{ fontSize: 12, color: key ? "#48bb78" : "#e53e3e" }}>
                    {key
                      ? `映射占位符: data-report-photo="${key}"`
                      : "无法解析前缀+序号，请改为如 特色游戏1.jpg"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    style={smallBtn}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    style={smallBtn}
                    disabled={index === photos.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    style={{ ...smallBtn, color: "#e53e3e" }}
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
    </div>
  );
}

const btnStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
};

const smallBtn: CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "#fafafa",
  cursor: "pointer",
};
