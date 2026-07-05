"use client";

/**
 * Session PIN gate (client-side PIN compare) plus optional WebAuthn (passkeys / 指纹 / 面容).
 */

import { playClassroomUnlockFanfare } from "@/lib/sounds/play-classroom-unlock-fanfare";
import { preloadUnlockChildVoice, scheduleUnlockChildVoice } from "@/lib/sounds/unlock-child-voice";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { Fredoka, ZCOOL_KuaiLe } from "next/font/google";
import Image from "next/image";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
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
/** 与开门动效错开，避免与 fanfare 主音完全重叠 */
const CHILD_VOICE_DELAY_SEC = 1.0;
const CHILD_VOICE_DELAY_REDUCED_MOTION_SEC = 0.4;

function lockPinFromEnv(): string {
  return process.env.NEXT_PUBLIC_APP_LOCK_PIN?.trim() ?? "";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function browserSupportsWebAuthnNative(): boolean {
  return (
    typeof window !== "undefined" &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === "function"
  );
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
  const [postUnlockFiesta, setPostUnlockFiesta] = useState(false);
  const [webauthnReady, setWebauthnReady] = useState(false);
  const [passkeyCount, setPasskeyCount] = useState(0);
  const [webauthnBusy, setWebauthnBusy] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState<string | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const splitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fiestaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const refreshPasskeyStatus = useCallback(async () => {
    if (!lockEnabled) return;
    try {
      const r = await fetch("/api/session/webauthn/status");
      const j = (await r.json()) as { webauthnReady?: boolean; passkeyCount?: number };
      if (r.ok) {
        setWebauthnReady(Boolean(j.webauthnReady));
        setPasskeyCount(typeof j.passkeyCount === "number" ? j.passkeyCount : 0);
      } else {
        setWebauthnReady(false);
        setPasskeyCount(0);
      }
    } catch {
      setWebauthnReady(false);
      setPasskeyCount(0);
    }
  }, [lockEnabled]);

  useEffect(() => {
    if (!lockEnabled || !checked) return;
    void refreshPasskeyStatus();
  }, [lockEnabled, checked, refreshPasskeyStatus]);

  useEffect(() => {
    preloadUnlockChildVoice();
  }, []);

  useEffect(() => {
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (rotateTimer.current) clearTimeout(rotateTimer.current);
      if (splitTimer.current) clearTimeout(splitTimer.current);
      if (fiestaTimer.current) clearTimeout(fiestaTimer.current);
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
    if (!prefersReducedMotion()) {
      setPostUnlockFiesta(true);
      if (fiestaTimer.current) clearTimeout(fiestaTimer.current);
      fiestaTimer.current = setTimeout(() => {
        setPostUnlockFiesta(false);
        fiestaTimer.current = null;
      }, 3000);
    }
  }, []);

  const runUnlockAnimation = useCallback(() => {
    if (prefersReducedMotion()) {
      scheduleUnlockChildVoice(CHILD_VOICE_DELAY_REDUCED_MOTION_SEC);
      setFx("success");
      splitTimer.current = setTimeout(() => completeUnlock(), 120);
      return;
    }
    playClassroomUnlockFanfare();
    scheduleUnlockChildVoice(CHILD_VOICE_DELAY_SEC);
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

  const unlockWithPasskey = useCallback(async () => {
    if (!lockEnabled || webauthnBusy || fx === "success") return;
    setWebauthnBusy(true);
    setError(null);
    setPasskeyMsg(null);
    try {
      const optRes = await fetch("/api/session/webauthn/auth/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const optJson = (await optRes.json()) as {
        options?: PublicKeyCredentialRequestOptionsJSON;
        challengeId?: string;
        error?: string;
      };
      if (!optRes.ok || !optJson.options || !optJson.challengeId) {
        setError(
          typeof optJson.error === "string" ? optJson.error : "设备解锁准备失败，悄悄话方式还可以用哦～",
        );
        return;
      }
      const credential = await (
        await import("@simplewebauthn/browser")
      ).startAuthentication({ optionsJSON: optJson.options });
      const verRes = await fetch("/api/session/webauthn/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: optJson.challengeId, credential }),
      });
      const verJson = (await verRes.json()) as { ok?: boolean; error?: string };
      if (!verRes.ok || !verJson.ok) {
        setError(typeof verJson.error === "string" ? verJson.error : "验证没通过，再试一次？");
        return;
      }
      runUnlockAnimation();
    } catch {
      setError("验证被取消，或设备暂时不可用。密语开门一直都在～");
    } finally {
      setWebauthnBusy(false);
    }
  }, [lockEnabled, webauthnBusy, fx, runUnlockAnimation]);

  const registerPasskey = useCallback(async () => {
    if (!lockEnabled || webauthnBusy || fx === "success") return;
    if (!pinInput.trim()) {
      setError("先在小框里输入密语，我们再保存通行密钥哦～");
      return;
    }
    setWebauthnBusy(true);
    setError(null);
    setPasskeyMsg(null);
    try {
      const optRes = await fetch("/api/session/webauthn/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const optJson = (await optRes.json()) as {
        options?: PublicKeyCredentialCreationOptionsJSON;
        challengeId?: string;
        error?: string;
      };
      if (!optRes.ok || !optJson.options || !optJson.challengeId) {
        setError(typeof optJson.error === "string" ? optJson.error : "没法开始注册通行密钥");
        return;
      }
      const credential = await (
        await import("@simplewebauthn/browser")
      ).startRegistration({ optionsJSON: optJson.options });
      const verRes = await fetch("/api/session/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pinInput,
          challengeId: optJson.challengeId,
          credential,
        }),
      });
      const verJson = (await verRes.json()) as { ok?: boolean; error?: string };
      if (!verRes.ok || !verJson.ok) {
        setError(typeof verJson.error === "string" ? verJson.error : "保存通行密钥失败");
        return;
      }
      await refreshPasskeyStatus();
      setPinInput("");
      setPasskeyMsg("通行密钥存好啦：下次可以试试指纹、面容或设备 PIN 嗖一下开门～");
    } catch {
      setError("注册被打断，或本机暂不支持。密语方式不受影响～");
    } finally {
      setWebauthnBusy(false);
    }
  }, [lockEnabled, webauthnBusy, fx, pinInput, refreshPasskeyStatus]);

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
    const showWebauthn = webauthnReady && browserSupportsWebAuthnNative();

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
        {unlocking && !prefersReducedMotion() && <UnlockBurstFlash />}
        {unlocking && !prefersReducedMotion() && (
          <UnlockConfettiShower active={unlocking} variant="overlay" />
        )}
        {unlocking && !prefersReducedMotion() && (
          <UnlockFireworks active={unlocking} />
        )}
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
          <p
            className="visually-hidden"
            aria-live="polite"
            aria-atomic="true"
          >
            {unlocking ? "小朋友说：妈妈，我爱你哟" : ""}
          </p>

          <div className={barClass}>
            <div ref={keyholeRef} className="session-unlock-keyhole-wrap">
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
                setPasskeyMsg(null);
              }}
              onKeyDown={handleKeyDown}
              className="session-unlock-field"
              placeholder="唰唰唰，输入密语"
              disabled={unlocking || webauthnBusy}
            />
            <button
              type="button"
              className={`session-unlock-submit${unlocking ? " session-unlock-submit--unlocking" : ""}`}
              onClick={submit}
              aria-label="开门啦"
              disabled={unlocking || webauthnBusy}
            >
              <PadlockIcon open={unlocking} />
            </button>
          </div>

          {showWebauthn && (
            <div className="session-unlock-passkey-actions">
              {passkeyCount > 0 && (
                <button
                  type="button"
                  className="session-unlock-passkey-btn session-unlock-passkey-btn--primary"
                  onClick={() => void unlockWithPasskey()}
                  disabled={unlocking || webauthnBusy}
                >
                  用指纹 / 面容 / 本机验证解锁
                </button>
              )}
              <button
                type="button"
                className="session-unlock-passkey-btn"
                onClick={() => void registerPasskey()}
                disabled={unlocking || webauthnBusy}
              >
                保存通行密钥到本机（需先在上方输入密语）
              </button>
            </div>
          )}

          {passkeyMsg && (
            <p className="session-unlock-passkey-msg" role="status">
              {passkeyMsg}
            </p>
          )}

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
    <>
      {postUnlockFiesta && <UnlockConfettiShower active variant="victory" />}
      <div className={playVaultReveal ? "app-unlocked-shell" : undefined}>{children}</div>
    </>
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

/** 锁孔里的小朋友照片，解锁中轻微弹一下呼应祝福语音 */
function KeyholeMascot({ unlocking }: { unlocking: boolean }) {
  return (
    <div
      className={
        unlocking
          ? "session-unlock-mascot-photo session-unlock-mascot-photo--unlocking"
          : "session-unlock-mascot-photo"
      }
    >
      <Image
        src="/images/unlock-boy.png"
        alt=""
        width={32}
        height={32}
        className="session-unlock-mascot-img"
        unoptimized
      />
    </div>
  );
}

/** 成功瞬间全屏高亮，不阻挡交互 */
function UnlockBurstFlash() {
  return <div className="session-unlock-burst-flash" aria-hidden />;
}

type ConfettiVariant = "overlay" | "victory";

/** 全屏彩条下落；victory 在解锁后覆盖主应用再续 3s */
function UnlockConfettiShower({ active, variant }: { active: boolean; variant: ConfettiVariant }) {
  const count = variant === "victory" ? 260 : 150;
  const specs = useMemo(() => {
    if (!active) return [];
    return Array.from({ length: count }, (_, i) => {
      const r = () => Math.random();
      return {
        i,
        x: r() * 100,
        delay: r() * 0.5,
        duration: 1.4 + r() * 2.4,
        drift: (r() - 0.5) * 300,
        rot: r() * 1080,
        w: 5 + r() * 12,
        h: 8 + r() * 20,
        hue: (i * 19) % 360,
        round: r() > 0.58,
      };
    });
  }, [active, count]);

  if (!active || specs.length === 0) return null;
  return (
    <div
      className={
        variant === "victory"
          ? "session-unlock-confetti session-unlock-confetti--victory"
          : "session-unlock-confetti"
      }
      aria-hidden
    >
      {specs.map((c) => {
        const side = c.round ? (c.w + c.h) / 2 : c.w;
        return (
          <span
            key={`${variant}-${c.i}`}
            className={
              c.round
                ? "session-unlock-confetti-piece session-unlock-confetti-piece--round"
                : "session-unlock-confetti-piece"
            }
            style={
              {
                left: `${c.x}%`,
                width: c.round ? `${side}px` : `${c.w}px`,
                height: c.round ? `${side}px` : `${c.h}px`,
                ["--ch"]: c.hue,
                ["--cd"]: `${c.duration}s`,
                ["--cdelay"]: `${c.delay}s`,
                ["--dx"]: `${c.drift}px`,
                ["--rot"]: `${c.rot}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** 锁心礼花 + 扩散环，密度与距离拉满 */
function UnlockFireworks({ active }: { active: boolean }) {
  if (!active) return null;
  const n1 = 80;
  const n2 = 56;
  const n3 = 48;
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
              animationDelay: `${i * 0.009}s`,
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
              animationDelay: `${0.2 + i * 0.012}s`,
            } as CSSProperties
          }
        />
      ))}
      {Array.from({ length: n3 }, (_, i) => (
        <span
          key={`u-${i}`}
          className="session-unlock-spark session-unlock-spark--wide"
          style={
            {
              "--ang": `${(360 / n3) * i + 7}deg`,
              "--hue": `${(i * 67) % 360}`,
              animationDelay: `${0.1 + (i * 0.007) % 0.4}s`,
            } as CSSProperties
          }
        />
      ))}
      <span className="session-unlock-flash-ring" />
      <span className="session-unlock-flash-ring session-unlock-flash-ring--b" />
      <span className="session-unlock-flash-ring session-unlock-flash-ring--c" />
      <span className="session-unlock-flash-ring session-unlock-flash-ring--d" />
      <span className="session-unlock-flash-ring session-unlock-flash-ring--e" />
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
