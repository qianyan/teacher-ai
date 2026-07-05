"use client";

import { browserSupportsPasskeys, passkeyErrorMessage } from "@/lib/auth/passkey";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PasskeyRow = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

export function AccountPageClient() {
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  const getSupabase = useCallback(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    setPasskeyAvailable(browserSupportsPasskeys());
  }, []);

  const refreshPasskeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: listError } = await getSupabase().auth.passkey.list();
      if (listError) throw listError;
      setPasskeys(data ?? []);
    } catch (e) {
      setPasskeys([]);
      setError(passkeyErrorMessage(e, "加载通行密钥失败"));
    } finally {
      setLoading(false);
    }
  }, [getSupabase]);

  useEffect(() => {
    void refreshPasskeys();
  }, [refreshPasskeys]);

  const addPasskey = useCallback(async () => {
    setRegistering(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: registerError } = await supabase.auth.registerPasskey();
      if (registerError) throw registerError;
      if (data?.id) {
        await supabase.auth.passkey.update({
          passkeyId: data.id,
          friendlyName: "本设备",
        });
      }
      await refreshPasskeys();
    } catch (e) {
      setError(passkeyErrorMessage(e, "添加通行密钥失败"));
    } finally {
      setRegistering(false);
    }
  }, [getSupabase, refreshPasskeys]);

  const deletePasskey = useCallback(
    async (passkeyId: string) => {
      setBusyId(passkeyId);
      setError(null);
      try {
        const { error: deleteError } = await getSupabase().auth.passkey.delete({ passkeyId });
        if (deleteError) throw deleteError;
        await refreshPasskeys();
      } catch (e) {
        setError(passkeyErrorMessage(e, "删除通行密钥失败"));
      } finally {
        setBusyId(null);
      }
    },
    [getSupabase, refreshPasskeys],
  );

  const formatDate = (iso: string | undefined): string => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("zh-CN");
    } catch {
      return iso;
    }
  };

  return (
    <main className="account-page">
      <div className="account-card">
        <div className="account-card__header">
          <div>
            <p className="account-card__kicker">账户</p>
            <h1 className="account-card__title">通行密钥</h1>
          </div>
          <Link href="/" className="btn btn--secondary btn--sm">
            返回工作台
          </Link>
        </div>

        <p className="auth-hint">
          绑定指纹、面容或设备 PIN 后，可在登录页使用通行密钥快速登录。
        </p>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="auth-hint">加载中…</p>
        ) : passkeys.length === 0 ? (
          <p className="auth-hint">尚未绑定通行密钥。</p>
        ) : (
          <ul className="account-passkey-list">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="account-passkey-item">
                <div>
                  <p className="account-passkey-item__name">
                    {passkey.friendly_name?.trim() || "未命名设备"}
                  </p>
                  <p className="account-passkey-item__meta">
                    创建于 {formatDate(passkey.created_at)}
                    {passkey.last_used_at
                      ? ` · 最近使用 ${formatDate(passkey.last_used_at)}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={busyId === passkey.id || registering}
                  onClick={() => void deletePasskey(passkey.id)}
                >
                  {busyId === passkey.id ? "删除中…" : "删除"}
                </button>
              </li>
            ))}
          </ul>
        )}

        {passkeyAvailable && (
          <button
            type="button"
            className="btn btn--primary btn--lg account-add-passkey"
            disabled={registering || busyId !== null}
            onClick={() => void addPasskey()}
          >
            {registering ? "请稍候…" : "添加通行密钥"}
          </button>
        )}

        {!passkeyAvailable && (
          <p className="auth-hint">当前浏览器不支持通行密钥。</p>
        )}
      </div>
    </main>
  );
}
