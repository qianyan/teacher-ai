"use client";

/**
 * Session PIN gate (client-side only).
 *
 * Future (WebAuthn / 通行密钥 / Touch ID): register a platform authenticator credential,
 * then call `navigator.credentials.get({ publicKey, mediation: 'conditional' })` with a
 * server-issued challenge. Requires registration UX + verifier — not implemented here.
 */

import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
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
  const [playVaultReveal, setPlayVaultReveal] = useState(false);
  const [fx, setFx] = useState<"none" | "shake" | "success">("none");
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const completeUnlock = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setError(null);
    setUnlocked(true);
    setPlayVaultReveal(true);
    setPinInput("");
    setFx("none");
  }, []);

  const submit = useCallback(() => {
    if (!lockEnabled) return;
    if (pinInput === expectedPin) {
      setFx("success");
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => {
        completeUnlock();
      }, 620);
    } else {
      setError("密码不正确");
      setFx("shake");
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => {
        setFx("none");
      }, 520);
    }
  }, [lockEnabled, pinInput, expectedPin, completeUnlock]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  if (!checked && lockEnabled) {
    return (
      <div className="session-unlock-overlay" role="presentation" aria-hidden>
        <div className="session-unlock-loading glass-panel">
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>加载中…</p>
        </div>
      </div>
    );
  }

  if (lockEnabled && !unlocked) {
    const barClass =
      fx === "shake"
        ? "session-unlock-bar session-unlock-bar--shake"
        : fx === "success"
          ? "session-unlock-bar session-unlock-bar--success"
          : "session-unlock-bar";

    return (
      <div className="session-unlock-overlay" role="dialog" aria-modal aria-labelledby={labelId}>
        <div className="session-unlock-vertical-rule" aria-hidden />
        <div className="session-unlock-card">
          <div className="session-unlock-window-dots" aria-hidden>
            <span className="session-unlock-dot session-unlock-dot--red" />
            <span className="session-unlock-dot session-unlock-dot--yellow" />
            <span className="session-unlock-dot session-unlock-dot--green" />
          </div>
          <p id={labelId} className="session-unlock-brand">
            Teacher AI
          </p>
          <p className="session-unlock-hint">
            输入会话密码以继续（仅校验，密码本身不会写入本地存储）。
          </p>

          <div className={barClass}>
            <div className="session-unlock-keyhole-wrap">
              <div
                className={
                  fx === "success"
                    ? "session-unlock-keyhole-ring session-unlock-keyhole-ring--pulse"
                    : "session-unlock-keyhole-ring"
                }
              />
              <div className="session-unlock-keyhole-face">
                <svg viewBox="0 0 32 32" className="session-unlock-keyhole-svg" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M16 8c-2.5 0-4.5 2-4.5 4.5 0 1.2.5 2.3 1.3 3.1L14 22h4l1.2-6.4c.8-.8 1.3-1.9 1.3-3.1C20.5 10 18.5 8 16 8z"
                  />
                </svg>
              </div>
            </div>
            <label htmlFor="session-pin" className="visually-hidden">
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
              className="session-unlock-field"
              placeholder="密码"
            />
            <button
              type="button"
              className="session-unlock-submit"
              onClick={submit}
              aria-label="解锁"
            >
              <PadlockIcon open={fx === "success"} />
            </button>
          </div>

          {error && (
            <p className="session-unlock-error" role="alert">
              {error}
            </p>
          )}
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

function PadlockIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 11V8a5 5 0 0110 0v3M6 11h12v10H6V11z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 15v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 11V8a5 5 0 019.9-1M17 11H7v10h10V11z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 15v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
