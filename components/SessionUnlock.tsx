"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";

const STORAGE_KEY = "teacher-ai-unlocked";

function lockPinFromEnv(): string {
  return process.env.NEXT_PUBLIC_APP_LOCK_PIN?.trim() ?? "";
}

type Props = {
  children: ReactNode;
};

export function SessionUnlock({ children }: Props) {
  const expectedPin = lockPinFromEnv();
  const lockEnabled = expectedPin.length > 0;
  const labelId = useId();
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(!lockEnabled);
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Vault-style content reveal only after a successful PIN entry (not session restore). */
  const [playVaultReveal, setPlayVaultReveal] = useState(false);

  useEffect(() => {
    if (!lockEnabled) {
      setUnlocked(true);
      setChecked(true);
      return;
    }
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") {
        setUnlocked(true);
      }
    } catch {
      /* ignore */
    }
    setChecked(true);
  }, [lockEnabled]);

  const submit = useCallback(() => {
    if (!lockEnabled) return;
    if (pinInput === expectedPin) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      setError(null);
      setUnlocked(true);
      setPlayVaultReveal(true);
      setPinInput("");
    } else {
      setError("密码不正确，请重试");
    }
  }, [expectedPin, pinInput, lockEnabled]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  if (!checked && lockEnabled) {
    return (
      <div
        style={overlayStyle}
        role="presentation"
        aria-hidden
      >
        <div style={cardStyle}>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
            加载中…
          </p>
        </div>
      </div>
    );
  }

  if (lockEnabled && !unlocked) {
    return (
      <div style={overlayStyle} role="dialog" aria-modal aria-labelledby={labelId}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 16px",
                borderRadius: 16,
                background: "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
              aria-hidden
            >
              🔐
            </div>
            <h1
              id={labelId}
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: "0 0 8px",
                color: "var(--text)",
                letterSpacing: "-0.02em",
              }}
            >
              Teacher AI
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
              输入会话密码以继续编辑周报（仅校验，不会写入本地存储密码本身）。
            </p>
          </div>
          <label className="app-label" htmlFor="session-pin">
            会话密码
          </label>
          <input
            id="session-pin"
            type="password"
            autoComplete="off"
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            className="app-input"
            style={{ marginBottom: 12 }}
            placeholder="••••••"
          />
          {error && (
            <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 12px" }}>
              {error}
            </p>
          )}
          <button type="button" className="btn btn--primary btn--lg" style={{ width: "100%" }} onClick={submit}>
            解锁
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={playVaultReveal ? "app-unlocked-shell" : undefined}>
      {children}
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "rgba(35, 32, 30, 0.48)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 380,
  background: "var(--panel-elevated)",
  borderRadius: 16,
  padding: 28,
  boxShadow: "var(--shadow-md)",
  border: "1px solid var(--border-subtle)",
};
