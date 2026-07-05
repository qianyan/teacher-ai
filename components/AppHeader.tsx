"use client";

import { DraftStatusChip } from "@/components/DraftStatusChip";
import { ThemeToggle } from "@/components/ThemeToggle";
import Image from "next/image";
import type { CSSProperties } from "react";
import { memo } from "react";

type Props = {
  draftSavedAt: number | null;
  draftError: string | null;
  onClearDraft: () => void | Promise<void>;
  historyCount: number;
  historySidebarOpen: boolean;
  onToggleHistorySidebar: () => void;
};

export const AppHeader = memo(AppHeaderInner);

function AppHeaderInner({
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
        <div className="app-brand-row">
          <div className="app-brand-mark" title="Teacher AI">
            <Image
              src="/teacher-ai-icon.png"
              alt="Teacher AI"
              width={52}
              height={52}
              priority
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="app-brand-kicker">
              <span className="app-brand-kicker-dot" aria-hidden />
              简报工作台
            </p>
            <h1 className="app-brand-title">托班两周周报 · Teacher AI</h1>
            <p className="app-hero-lede">
              像拼贴手帐一样整理双周内容：写好开篇与板块要点、拖好照片顺序，一键生成预览与长图。
            </p>
            <div className="app-hero-pills" aria-hidden>
              <span className="app-hero-pill">HTML 预览</span>
              <span className="app-hero-pill app-hero-pill--warm">长图 PNG</span>
              <span className="app-hero-pill">本机草稿</span>
            </div>
          </div>
        </div>
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
