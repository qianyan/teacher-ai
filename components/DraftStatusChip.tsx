"use client";

import type { CSSProperties } from "react";

type Props = {
  draftSavedAt: number | null;
  draftError: string | null;
  onClearDraft: () => void;
};

export function DraftStatusChip({ draftSavedAt, draftError, onClearDraft }: Props) {
  const timeLabel =
    draftSavedAt !== null
      ? new Date(draftSavedAt).toLocaleString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          month: "numeric",
          day: "numeric",
        })
      : null;

  return (
    <div style={wrap}>
      <span style={iconWrap} aria-hidden>
        <IconDraft />
      </span>
      <div style={textCol}>
        <span style={label}>草稿</span>
        <span style={sub}>
          {draftError ? (
            <span style={{ color: "var(--danger)" }}>{draftError}</span>
          ) : timeLabel ? (
            <>已保存 · {timeLabel}</>
          ) : (
            <>将自动保存到本机</>
          )}
        </span>
      </div>
      <button
        type="button"
        className="btn btn--secondary"
        style={{ fontSize: 12, padding: "6px 10px", flexShrink: 0 }}
        onClick={() => {
          void onClearDraft();
        }}
      >
        清除
      </button>
    </div>
  );
}

function IconDraft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const wrap: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--panel-elevated)",
  maxWidth: "min(100%, 360px)",
};

const iconWrap: CSSProperties = {
  color: "var(--accent)",
  flexShrink: 0,
  display: "flex",
};

const textCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

const sub: CSSProperties = {
  fontSize: 13,
  color: "var(--text)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
