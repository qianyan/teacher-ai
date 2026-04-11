export const HISTORY_SIDEBAR_OPEN_KEY = "teacher-ai-history-open";

export function readHistorySidebarOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(HISTORY_SIDEBAR_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeHistorySidebarOpen(open: boolean): void {
  try {
    localStorage.setItem(HISTORY_SIDEBAR_OPEN_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}
