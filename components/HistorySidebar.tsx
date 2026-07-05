"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MAX_HISTORY } from "@/lib/persistence/idb";
import type { HistoryRecord } from "@/lib/persistence/types";
import { REPORT_TEMPLATES } from "@/lib/report/templates";
import type { CSSProperties } from "react";
import { memo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  history: HistoryRecord[];
  onRestore: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
};

type HistoryConfirm =
  | null
  | { action: "delete"; id: string; dateLabel: string }
  | { action: "restore"; id: string; dateLabel: string };

function HistorySidebarInner({
  open,
  onClose,
  history,
  onRestore,
  onDelete,
}: Props) {
  const [confirm, setConfirm] = useState<HistoryConfirm>(null);

  return (
    <>
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.action === "delete"
            ? "删除这条历史记录？"
            : confirm?.action === "restore"
              ? "用该条历史替换当前内容？"
              : ""
        }
        description={
          confirm?.action === "delete"
            ? `将永久移除「${confirm.dateLabel}」这一条，且无法恢复。`
            : confirm?.action === "restore"
              ? `将把「${confirm.dateLabel}」载入编辑区与照片列表，未保存的当前修改会被覆盖。`
              : undefined
        }
        confirmLabel={confirm?.action === "delete" ? "删除" : "恢复"}
        tone={confirm?.action === "delete" ? "danger" : "neutral"}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          if (confirm.action === "delete") await onDelete(confirm.id);
          else await onRestore(confirm.id);
          setConfirm(null);
        }}
      />
      {open && (
        <button
          type="button"
          className="history-sidebar-backdrop"
          aria-label="关闭历史记录"
          onClick={onClose}
        />
      )}
      <aside
        id="history-sidebar-panel"
        className={`history-sidebar glass-panel ${open ? "history-sidebar--open" : ""}`}
        aria-hidden={!open}
        aria-label="历史记录"
      >
        <div style={head}>
          <span style={headIcon} aria-hidden>
            <IconHistory />
          </span>
          <div>
            <h2 style={title}>历史记录</h2>
            <p style={hint}>
              每次成功生成预览会自动保存，最多 {MAX_HISTORY} 条。
            </p>
          </div>
          <button
            type="button"
            className="btn btn--secondary history-sidebar-close"
            style={{ padding: "6px 10px", fontSize: 13 }}
            onClick={onClose}
            aria-label="收起侧栏"
          >
            收起
          </button>
        </div>
        {history.length === 0 ? (
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--text-muted)" }}>
            尚无历史。生成预览成功后将出现在此。
          </p>
        ) : (
          <ul style={list}>
            {history.map((row) => (
              <li key={row.id} className="history-list-item">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                    {row.snapshot.biweeklyDateRange}
                    <span className="history-template-tag">
                      {REPORT_TEMPLATES[row.snapshot.templateId].name}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {new Date(row.savedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    style={{ fontSize: 12, padding: "6px 10px" }}
                    onClick={() =>
                      setConfirm({
                        action: "restore",
                        id: row.id,
                        dateLabel: row.snapshot.biweeklyDateRange,
                      })
                    }
                  >
                    恢复
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    style={{
                      fontSize: 12,
                      padding: "6px 10px",
                      color: "var(--danger)",
                    }}
                    onClick={() =>
                      setConfirm({
                        action: "delete",
                        id: row.id,
                        dateLabel: row.snapshot.biweeklyDateRange,
                      })
                    }
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>
  );
}

export const HistorySidebar = memo(HistorySidebarInner);

function IconHistory() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const head: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 4,
};

const headIcon: CSSProperties = {
  color: "var(--accent)",
  flexShrink: 0,
  marginTop: 2,
};

const title: CSSProperties = {
  margin: 0,
  fontSize: "1.05rem",
  fontWeight: 700,
  color: "var(--text)",
};

const hint: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 12,
  color: "var(--text-muted)",
  lineHeight: 1.45,
};

const list: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "16px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  maxHeight: "min(70vh, 520px)",
  overflowY: "auto",
};

