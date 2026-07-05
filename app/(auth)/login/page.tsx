"use client";

import { AuthForm } from "@/app/(auth)/login/AuthForm";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page"><p className="auth-hint">加载中…</p></main>}>
      <AuthForm />
    </Suspense>
  );
}
