"use client";

import { DraftStatusChip } from "@/components/DraftStatusChip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useMemo } from "react";

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
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [router, supabase]);

  return (
    <header className="app-header app-header--compact">
      <div className="app-header__brand">
        <div className="app-brand-mark" title="Teacher AI">
          <Image
            src="/teacher-ai-icon.png"
            alt="Teacher AI"
            width={44}
            height={44}
            priority
          />
        </div>
        <div className="app-header__titles">
          <p className="app-brand-kicker">
            <span className="app-brand-kicker-dot" aria-hidden />
            简报工作台
          </p>
          <h1 className="app-brand-title app-brand-title--compact">
            托班两周周报
          </h1>
        </div>
      </div>
      <div className="app-header__toolbar">
        <DraftStatusChip
          draftSavedAt={draftSavedAt}
          draftError={draftError}
          onClearDraft={onClearDraft}
        />
        <button
          type="button"
          className={`btn btn--secondary history-sidebar-toggle ${historySidebarOpen ? "is-active" : ""}`}
          onClick={onToggleHistorySidebar}
          aria-expanded={historySidebarOpen}
          aria-controls="history-sidebar-panel"
          title="历史记录"
        >
          <span className="app-header__history-inner">
            <IconHistoryClock />
            <span className="app-header__label-text">历史</span>
            {historyCount > 0 && (
              <span className="history-badge">{historyCount > 99 ? "99+" : historyCount}</span>
            )}
          </span>
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={signOut} title="退出登录" aria-label="退出登录">
          <IconLogout />
          <span className="app-header__label-text">退出</span>
        </button>
        <Link href="/account" className="btn btn--secondary btn--sm" title="账户与通行密钥" aria-label="账户与通行密钥">
          <IconUser />
          <span className="app-header__label-text">账户</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
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
