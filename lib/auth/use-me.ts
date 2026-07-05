"use client";

import { useCallback, useEffect, useState } from "react";

export type MeUsage = {
  plan: "free" | "pro";
  limit: number | null;
  used: number;
  remaining: number | null;
};

export function useMe() {
  const [usage, setUsage] = useState<MeUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as { usage?: MeUsage };
      if (!res.ok) {
        setUsage(null);
        return;
      }
      setUsage(json.usage ?? null);
    } catch {
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { usage, loading, refresh };
}
