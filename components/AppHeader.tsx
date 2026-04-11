"use client";

import { DraftStatusChip } from "@/components/DraftStatusChip";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { CSSProperties } from "react";

type Props = {
  draftSavedAt: number | null;
  draftError: string | null;
  onClearDraft: () => void;
  historyCount: number;
  historySidebarOpen: boolean;
  onToggleHistorySidebar: () => void;
};

export function AppHeader({
  draftSavedAt,
  draftError,
  onClearDraft,
  historyCount,
  historySidebarOpen,
  onToggleHistorySidebar,
}: Props) {
  return (
    <header className="app-header" style={headerStyle}>
      <div style={heroBlock}>
        <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>
          托班两周周报 · Teacher AI
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 15, lineHeight: 1.55, maxWidth: "56ch" }}>
          编辑开篇与正文、导入照片并核对文件名，生成 HTML 预览与长图 PNG。需配置服务端 LLM
          环境变量。
        </p>
      </div>
      <div style={toolbar}>
        <DraftStatusChip
          draftSavedAt={draftSavedAt}
          draftError={draftError}
          onClearDraft={onClearDraft}
        />
        <button
          type="button"
          className={`btn btn--secondary history-sidebar-toggle ${historySidebarOpen ? "is-active" : ""}`}
          style={historyBtn}
          onClick={onToggleHistorySidebar}
          aria-expanded={historySidebarOpen}
          aria-controls="history-sidebar-panel"
          title="历史记录"
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconHistoryClock />
            <span>历史</span>
            {historyCount > 0 && (
              <span className="history-badge">{historyCount > 99 ? "99+" : historyCount}</span>
            )}
          </span>
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}

function IconHistoryClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 8v4l3 2M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const headerStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 20,
  marginBottom: 28,
};

const heroBlock: CSSProperties = {
  flex: "1 1 280px",
  minWidth: 0,
};

const toolbar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flex: "0 1 auto",
};

const historyBtn: CSSProperties = {
  fontSize: 14,
  padding: "10px 14px",
  display: "inline-flex",
  alignItems: "center",
};
