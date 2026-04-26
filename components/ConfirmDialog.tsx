"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger：强调危险操作，打开时焦点落在「取消」上 */
  tone?: "danger" | "neutral";
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "取消",
  tone = "neutral",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || pending) return;
    const id = requestAnimationFrame(() => {
      if (tone === "danger") cancelRef.current?.focus();
      else confirmRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, tone, pending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, pending]);

  const runConfirm = () => {
    void (async () => {
      setPending(true);
      try {
        await Promise.resolve(onConfirm());
      } finally {
        setPending(false);
      }
    })();
  };

  if (!mounted || !open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="confirm-dialog-backdrop"
      role="presentation"
      onClick={pending ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="confirm-dialog-panel glass-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-dialog-title">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="confirm-dialog-desc">
            {description}
          </p>
        ) : null}
        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={tone === "danger" ? "btn btn--danger" : "btn btn--primary"}
            onClick={runConfirm}
            disabled={pending}
          >
            {pending ? "请稍候…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
