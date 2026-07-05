export function getFreeTierMonthlyGenerations(): number {
  const raw = process.env.FREE_TIER_MONTHLY_GENERATIONS?.trim();
  if (!raw) return 5;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export class QuotaExceededError extends Error {
  readonly status = 429;
  readonly limit: number;

  constructor(limit: number) {
    super(`本月免费生成次数已用完（${limit} 次/月），升级 Pro 可无限使用`);
    this.name = "QuotaExceededError";
    this.limit = limit;
  }
}

export type UsageSummary = {
  plan: "free" | "pro";
  limit: number | null;
  used: number;
  remaining: number | null;
};

type UserClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
>;

export async function getUsageSummary(
  supabase: UserClient,
  userId: string,
): Promise<UsageSummary> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const plan = profile?.plan === "pro" ? "pro" : "free";
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count, error: countError } = await supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", "generate")
    .gte("created_at", monthStart.toISOString());

  if (countError) throw new Error(countError.message);

  const used = count ?? 0;
  if (plan === "pro") {
    return { plan, limit: null, used, remaining: null };
  }

  const limit = getFreeTierMonthlyGenerations();
  return { plan, limit, used, remaining: Math.max(0, limit - used) };
}

export async function checkCanGenerate(supabase: UserClient, userId: string): Promise<void> {
  const usage = await getUsageSummary(supabase, userId);
  if (usage.plan === "pro") return;
  if (usage.remaining !== null && usage.remaining <= 0) {
    throw new QuotaExceededError(usage.limit ?? getFreeTierMonthlyGenerations());
  }
}

export async function recordGenerateUsage(userId: string): Promise<void> {
  const { getSupabaseAdminClient } = await import("@/lib/server/supabase-admin");
  const { error } = await getSupabaseAdminClient().from("usage_events").insert({
    user_id: userId,
    action: "generate",
  });
  if (error) throw new Error(error.message);
}
