"use client";

import { browserSupportsPasskeys, passkeyErrorMessage } from "@/lib/auth/passkey";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "login" | "register";
type Step = "credentials" | "passkeySetup";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const initialError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    setPasskeyAvailable(browserSupportsPasskeys());
  }, []);

  const navigateAfterAuth = useCallback(() => {
    router.replace(next.startsWith("/") ? next : "/");
    router.refresh();
  }, [next, router]);

  const submitLogin = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;
      navigateAfterAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }, [email, navigateAfterAuth, password, supabase]);

  const submitRegister = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          inviteCode: inviteCode.trim(),
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;

      if (passkeyAvailable) {
        setStep("passkeySetup");
      } else {
        navigateAfterAuth();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败");
    } finally {
      setBusy(false);
    }
  }, [email, inviteCode, navigateAfterAuth, passkeyAvailable, password, supabase]);

  const signInWithPasskey = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { data, error: passkeyError } = await supabase.auth.signInWithPasskey();
      if (passkeyError) throw passkeyError;
      if (!data.session) throw new Error("通行密钥登录失败");
      navigateAfterAuth();
    } catch (e) {
      setError(passkeyErrorMessage(e, "通行密钥登录失败"));
    } finally {
      setBusy(false);
    }
  }, [navigateAfterAuth, supabase]);

  const registerPasskey = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { data, error: passkeyError } = await supabase.auth.registerPasskey();
      if (passkeyError) throw passkeyError;
      if (data?.id) {
        await supabase.auth.passkey.update({
          passkeyId: data.id,
          friendlyName: "本设备",
        });
      }
      navigateAfterAuth();
    } catch (e) {
      setError(passkeyErrorMessage(e, "通行密钥绑定失败"));
    } finally {
      setBusy(false);
    }
  }, [navigateAfterAuth, supabase]);

  const onSubmit = mode === "login" ? submitLogin : submitRegister;

  if (step === "passkeySetup") {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-card__brand">
            <Image src="/teacher-ai-icon.png" alt="Teacher AI" width={56} height={56} priority />
            <div>
              <p className="auth-card__kicker">Teacher AI</p>
              <h1 className="auth-card__title">启用通行密钥</h1>
            </div>
          </div>

          <p className="auth-hint">
            注册成功。你可以绑定指纹、面容或设备 PIN，下次登录时无需输入密码。
          </p>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="auth-passkey-actions">
            <button
              type="button"
              className="btn btn--primary btn--lg auth-submit"
              disabled={busy}
              onClick={() => void registerPasskey()}
            >
              {busy ? "请稍候…" : "启用指纹 / 通行密钥"}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--lg auth-passkey-skip"
              disabled={busy}
              onClick={navigateAfterAuth}
            >
              稍后再说
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <Image src="/teacher-ai-icon.png" alt="Teacher AI" width={56} height={56} priority />
          <div>
            <p className="auth-card__kicker">Teacher AI</p>
            <h1 className="auth-card__title">托班周报</h1>
          </div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`auth-tabs__btn ${mode === "login" ? "is-active" : ""}`}
            aria-selected={mode === "login"}
            onClick={() => setMode("login")}
          >
            登录
          </button>
          <button
            type="button"
            role="tab"
            className={`auth-tabs__btn ${mode === "register" ? "is-active" : ""}`}
            aria-selected={mode === "register"}
            onClick={() => setMode("register")}
          >
            邀请码注册
          </button>
        </div>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <label className="auth-field">
            <span>邮箱</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <label className="auth-field">
            <span>密码</span>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              minLength={8}
              required
            />
          </label>
          {mode === "register" && (
            <label className="auth-field">
              <span>邀请码</span>
              <input
                type="text"
                autoComplete="off"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                disabled={busy}
                required
              />
            </label>
          )}
          <button type="submit" className="btn btn--primary btn--lg auth-submit" disabled={busy}>
            {busy ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </form>

        {mode === "login" && passkeyAvailable && (
          <div className="auth-passkey-divider">
            <span>或</span>
          </div>
        )}

        {mode === "login" && passkeyAvailable && (
          <button
            type="button"
            className="btn btn--secondary btn--lg auth-passkey-login"
            disabled={busy}
            onClick={() => void signInWithPasskey()}
          >
            {busy ? "请稍候…" : "通行密钥登录"}
          </button>
        )}
      </div>
    </main>
  );
}
