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

/**
 * Atomically consumes one generation from the user's monthly quota.
 *
 * The check and the usage insert happen inside a single DB transaction
 * (pg function `try_consume_generation`, serialized per user via an advisory
 * lock), so concurrent requests cannot race past the free-tier limit.
 *
 * Returns the inserted usage_events id; pass it to refundGenerationQuota if
 * the generation itself fails so failed attempts do not burn quota.
 * Throws QuotaExceededError when the monthly limit is already reached.
 */
export async function consumeGenerationQuota(userId: string): Promise<string> {
  const limit = getFreeTierMonthlyGenerations();
  const { getSupabaseAdminClient } = await import("@/lib/server/supabase-admin");
  const { data, error } = await getSupabaseAdminClient().rpc(
    "try_consume_generation",
    { p_user_id: userId, p_limit: limit },
  );
  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !data) {
    throw new QuotaExceededError(limit);
  }
  return data;
}

/**
 * Refunds a previously consumed generation (deletes the usage_events row).
 * Best-effort: callers should log and continue when this fails.
 */
export async function refundGenerationQuota(
  userId: string,
  eventId: string,
): Promise<void> {
  const { getSupabaseAdminClient } = await import("@/lib/server/supabase-admin");
  const { error } = await getSupabaseAdminClient()
    .from("usage_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
