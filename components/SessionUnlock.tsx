"use client";

/**
 * Session PIN gate (client-side only).
 *
 * Future (WebAuthn / 通行密钥 / Touch ID): register a platform authenticator credential,
 * then call `navigator.credentials.get({ publicKey, mediation: 'conditional' })` with a
 * server-issued challenge. Requires registration UX + verifier — not implemented here.
 */

import { Fredoka, ZCOOL_KuaiLe } from "next/font/google";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const fontFredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-unlock-fredoka",
  display: "swap",
});

const fontKuaile = ZCOOL_KuaiLe({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const STORAGE_KEY = "teacher-ai-unlocked";

const ROTATE_MS = 520;
const SPLIT_MS = 720;

function lockPinFromEnv(): string {
  return process.env.NEXT_PUBLIC_APP_LOCK_PIN?.trim() ?? "";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Props = {
  children: ReactNode;
};

type RevealPhase = "idle" | "rotate" | "split";

export function SessionUnlock({ children }: Props) {
  const expectedPin = lockPinFromEnv();
  const lockEnabled = expectedPin.length > 0;
  const labelId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const keyholeRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(!lockEnabled);
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [playVaultReveal, setPlayVaultReveal] = useState(false);
  const [fx, setFx] = useState<"none" | "shake" | "success">("none");
  const [revealPhase, setRevealPhase] = useState<RevealPhase>("idle");
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const splitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateUnlockAxis = useCallback(() => {
    const wrap = keyholeRef.current;
    const overlay = overlayRef.current;
    if (!wrap || !overlay) return;
    const r = wrap.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    overlay.style.setProperty("--unlock-axis-x", `${x}px`);
    overlay.style.setProperty("--unlock-origin-y", `${y}px`);
  }, []);

  useLayoutEffect(() => {
    updateUnlockAxis();
  }, [updateUnlockAxis, fx, revealPhase]);

  useEffect(() => {
    const onResize = () => updateUnlockAxis();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateUnlockAxis]);

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
      if (rotateTimer.current) clearTimeout(rotateTimer.current);
      if (splitTimer.current) clearTimeout(splitTimer.current);
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
    setRevealPhase("idle");
  }, []);

  const runUnlockAnimation = useCallback(() => {
    if (prefersReducedMotion()) {
      setFx("success");
      splitTimer.current = setTimeout(() => completeUnlock(), 120);
      return;
    }
    setFx("success");
    setRevealPhase("rotate");
    rotateTimer.current = setTimeout(() => {
      updateUnlockAxis();
      setRevealPhase("split");
    }, ROTATE_MS);
    splitTimer.current = setTimeout(() => {
      completeUnlock();
    }, ROTATE_MS + SPLIT_MS);
  }, [completeUnlock, updateUnlockAxis]);

  const submit = useCallback(() => {
    if (!lockEnabled) return;
    if (pinInput === expectedPin) {
      runUnlockAnimation();
    } else {
      setError("咦？咒语好像不对哦～再悄悄试一次？");
      setFx("shake");
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => {
        setFx("none");
      }, 520);
    }
  }, [lockEnabled, pinInput, expectedPin, runUnlockAnimation]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  if (!checked && lockEnabled) {
    return (
      <div
        className={`${fontFredoka.variable} ${fontKuaile.className} session-unlock-theme session-unlock-overlay`}
        role="presentation"
        aria-hidden
      >
        <SessionUnlockBackdrop />
        <div className="session-unlock-loading">
          <span className="session-unlock-loading-emoji" aria-hidden>
            🎒
          </span>
          <p className="session-unlock-loading-text">小书包正在翻找教室钥匙…</p>
        </div>
      </div>
    );
  }

  if (lockEnabled && !unlocked) {
    const barClass =
      fx === "shake"
        ? "session-unlock-bar session-unlock-bar--shake"
        : "session-unlock-bar";

    const unlocking = fx === "success";
    const splitting = revealPhase === "split";

    return (
      <div
        ref={overlayRef}
        className={`${fontFredoka.variable} ${fontKuaile.className} session-unlock-theme session-unlock-overlay${
          splitting ? " session-unlock-overlay--splitting" : ""
        }`}
        role="dialog"
        aria-modal
        aria-labelledby={labelId}
      >
        <SessionUnlockBackdrop />
        {splitting && (
          <>
            <div className="session-unlock-curtain session-unlock-curtain--left" aria-hidden />
            <div className="session-unlock-curtain session-unlock-curtain--right" aria-hidden />
          </>
        )}
        <UnlockFireworks active={unlocking && !prefersReducedMotion()} />
        <div className={`session-unlock-card${splitting ? " session-unlock-card--exit" : ""}`}>
          <p className="session-unlock-sticker" aria-hidden>
            <span className="session-unlock-sticker-inner">老师专用</span>
          </p>
          <h1 id={labelId} className="session-unlock-brand">
            <span className="session-unlock-brand-en">Teacher AI</span>
            <span className="session-unlock-brand-sub">噓——这是教室后门的秘密通道</span>
          </h1>
          <p className="session-unlock-hint">
            对妈妈说悄悄话、对小朋友念咒语都可以：输入一次即可继续。我们<strong>不</strong>把密语存进小饼干里。
          </p>

          <div className={barClass}>
            <div
              ref={keyholeRef}
              className={`session-unlock-keyhole-wrap${unlocking ? " session-unlock-keyhole-wrap--unlocking" : ""}`}
            >
              <div
                className={
                  unlocking
                    ? "session-unlock-keyhole-ring session-unlock-keyhole-ring--pulse"
                    : "session-unlock-keyhole-ring"
                }
              />
              <div className="session-unlock-keyhole-face" aria-hidden>
                <KeyholeMascot unlocking={unlocking} />
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
              placeholder="唰唰唰，输入密语"
              disabled={unlocking}
            />
            <button
              type="button"
              className={`session-unlock-submit${unlocking ? " session-unlock-submit--unlocking" : ""}`}
              onClick={submit}
              aria-label="开门啦"
              disabled={unlocking}
            >
              <PadlockIcon open={unlocking} />
            </button>
          </div>

          {error && (
            <p className="session-unlock-error" role="alert">
              <span className="session-unlock-error-emoji" aria-hidden>
                🙈
              </span>
              {error}
            </p>
          )}

          <p className="session-unlock-whisper" aria-hidden>
            <span>按 Enter 也可以「砰」地一下开门</span>
          </p>
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

/** 教室主题：慢速漂浮的图形与表情，不抢主内容焦点 */
function SessionUnlockBackdrop() {
  return (
    <div className="session-unlock-backdrop" aria-hidden>
      <div className="session-unlock-blob session-unlock-blob--a" />
      <div className="session-unlock-blob session-unlock-blob--b" />
      <div className="session-unlock-blob session-unlock-blob--c" />
      <span className="session-unlock-float session-unlock-float--1">⭐</span>
      <span className="session-unlock-float session-unlock-float--2">🦒</span>
      <span className="session-unlock-float session-unlock-float--3">🎨</span>
      <span className="session-unlock-float session-unlock-float--4">📣</span>
    </div>
  );
}

/** 锁孔里的小圆脸：普通态眨眼，解锁中变成超开心 */
function KeyholeMascot({ unlocking }: { unlocking: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`session-unlock-mascot-svg${unlocking ? " session-unlock-mascot-svg--unlocking" : ""}`}
      aria-hidden
    >
      {unlocking ? (
        <>
          <path
            d="M9.5 12.5C9.5 10.5 10.5 8.5 12.5 8.5C14.5 8.5 15.5 10.5 15.5 12.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M16.5 12.5C16.5 10.5 17.5 8.5 19.5 8.5C21.5 8.5 22.5 10.5 22.5 12.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M9 20C11 24 16 25.5 22 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="11" cy="12.5" r="2" fill="currentColor" />
          <circle cx="21" cy="12.5" r="2" fill="currentColor" />
          <path
            d="M11 20C13 22 15.5 23.5 18 22.5C19.2 22 20.2 20.8 20.5 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

/** Firework-like sparks + flash rings from lock center during success transition */
function UnlockFireworks({ active }: { active: boolean }) {
  if (!active) return null;
  const n1 = 32;
  const n2 = 22;
  return (
    <div className="session-unlock-fireworks" aria-hidden>
      {Array.from({ length: n1 }, (_, i) => (
        <span
          key={`s-${i}`}
          className="session-unlock-spark"
          style={
            {
              "--ang": `${(360 / n1) * i}deg`,
              "--hue": `${12 + ((i * 47) % 330)}`,
              animationDelay: `${i * 0.014}s`,
            } as CSSProperties
          }
        />
      ))}
      {Array.from({ length: n2 }, (_, i) => (
        <span
          key={`t-${i}`}
          className="session-unlock-spark session-unlock-spark--late"
          style={
            {
              "--ang": `${(360 / n2) * i + 19}deg`,
              "--hue": `${175 + ((i * 53) % 120)}`,
              animationDelay: `${0.34 + i * 0.018}s`,
            } as CSSProperties
          }
        />
      ))}
      <span className="session-unlock-flash-ring" />
      <span className="session-unlock-flash-ring session-unlock-flash-ring--b" />
      <span className="session-unlock-flash-ring session-unlock-flash-ring--c" />
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
