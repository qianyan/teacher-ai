"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type Props = {
  imageUrl: string;
  fileName: string;
  onClose: () => void;
};

export function PhotoPreviewModal({ imageUrl, fileName, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLoaded(false);
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
        {!loaded && (
          <div className="photo-preview-modal__loading" aria-hidden>
            <span className="photo-stage-skeleton photo-preview-modal__spinner" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={fileName}
          decoding="async"
          onLoad={() => setLoaded(true)}
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
      </div>
    </div>,
    document.body,
  );
}
