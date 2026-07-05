import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function claimInviteCode(code: string, userId: string): Promise<boolean> {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > 64 || !userId) return false;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_invite_code", {
    p_code: trimmed,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function isInviteCodeAvailable(code: string): Promise<boolean> {
  const trimmed = code.trim();
  if (!trimmed) return false;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("invite_codes")
    .select("id, use_count, redeemed_by_user_id, expires_at")
    .ilike("code", trimmed)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return false;
  if (data.use_count >= 1 || data.redeemed_by_user_id) return false;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return false;
  return true;
}
