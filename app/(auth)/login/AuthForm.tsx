"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type Mode = "login" | "register";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const initialError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const submitLogin = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }, [email, next, password, router, supabase]);

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

      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败");
    } finally {
      setBusy(false);
    }
  }, [email, inviteCode, next, password, router, supabase]);

  const onSubmit = mode === "login" ? submitLogin : submitRegister;

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
      </div>
    </main>
  );
}
