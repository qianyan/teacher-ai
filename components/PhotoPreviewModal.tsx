"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type Props = {
  imageUrl: string;
  fileName: string;
  onClose: () => void;
};

export function PhotoPreviewModal({ imageUrl, fileName, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // 重置状态；若图片已缓存完成（complete && naturalWidth>0）则直接标记已加载，
    // 否则等待 onLoad/onError。这避免了 src 在挂载前就已 resolve 时 onLoad 不触发。
    setLoaded(false);
    setFailed(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [imageUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-label="照片全屏预览"
      className="photo-preview-modal"
      onClick={onClose}
    >
      <div
        className="photo-preview-modal__frame"
        onClick={(e) => e.stopPropagation()}
      >
        {!loaded && !failed && (
          <div className="photo-preview-modal__loading" aria-hidden>
            <span className="photo-stage-skeleton photo-preview-modal__spinner" />
          </div>
        )}
        {failed ? (
          <div
            className="photo-preview-modal__error"
            role="alert"
            style={{
              minWidth: "min(60vw, 360px)",
              minHeight: "min(40vh, 200px)",
              display: "grid",
              placeItems: "center",
              color: "var(--text-muted)",
              fontSize: 14,
              textAlign: "center",
              padding: 24,
              background: "var(--bg)",
              borderRadius: 8,
            }}
          >
            图片加载失败，可能原图已失效。
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={imgRef}
            src={imageUrl}
            alt={fileName}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{
              maxWidth: "96vw",
              maxHeight: "96vh",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "var(--shadow-md)",
              display: loaded ? "block" : "none",
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
