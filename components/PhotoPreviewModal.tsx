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

  useEffect(() => {
    setMounted(true);
  }, []);

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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 25000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "96vw",
          maxHeight: "96vh",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={fileName}
          style={{
            maxWidth: "96vw",
            maxHeight: "96vh",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            display: "block",
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
