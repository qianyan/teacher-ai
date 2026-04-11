"use client";

import { applyThemeToDocument, getStoredTheme, setStoredTheme, type ThemeMode } from "@/lib/theme";
import { useCallback, useEffect, useState } from "react";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = getStoredTheme();
    const initial = stored ?? "light";
    setMode(initial);
    applyThemeToDocument(initial);
  }, []);

  const toggle = useCallback(() => {
    const next: ThemeMode = mode === "light" ? "dark" : "light";
    setMode(next);
    setStoredTheme(next);
    applyThemeToDocument(next);
  }, [mode]);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={mode === "light" ? "切换到深色模式" : "切换到浅色模式"}
      title={mode === "light" ? "深色模式" : "浅色模式"}
    >
      {mode === "light" ? <IconMoon /> : <IconSun />}
    </button>
  );
}

function IconMoon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.5A8.5 8.5 0 019.5 3a8.5 8.5 0 1011.5 11.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
