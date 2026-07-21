"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD = 50;

type Props = {
  imageUrl: string;
  fileName: string;
  currentIndex: number;
  total: number;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

export function PhotoPreviewModal({
  imageUrl,
  fileName,
  currentIndex,
  total,
  onClose,
  onPrev,
  onNext,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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
      else if (e.key === "ArrowLeft") onPrev?.();
      else if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      const touch = e.changedTouches[0];
      if (!start || !touch) return;
      touchStartRef.current = null;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX < SWIPE_THRESHOLD || absX <= absY) return;

      if (deltaX > 0) {
        onPrev?.();
      } else {
        onNext?.();
      }
    },
    [onPrev, onNext],
  );

  if (!mounted || typeof document === "undefined") return null;

  const counterText = `${currentIndex + 1} / ${total}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-label="照片全屏预览"
      className="photo-preview-modal"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="photo-preview-modal__frame"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="photo-preview-modal__counter"
          aria-live="polite"
          aria-atomic="true"
        >
          {counterText}
        </span>

        {total > 1 && onPrev && (
          <button
            type="button"
            className="photo-preview-modal__nav photo-preview-modal__nav--prev"
            aria-label="上一张"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
          >
            ‹
          </button>
        )}
        {total > 1 && onNext && (
          <button
            type="button"
            className="photo-preview-modal__nav photo-preview-modal__nav--next"
            aria-label="下一张"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
          >
            ›
          </button>
        )}

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
