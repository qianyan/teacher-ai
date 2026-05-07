import { getSupabaseAdminClient } from "./supabase-admin";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

const PASSKEYS = "session_passkeys";
const CHALLENGES = "session_webauthn_challenges";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type StoredPasskeyRow = {
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
};

export async function pruneExpiredChallenges(): Promise<void> {
  const client = getSupabaseAdminClient();
  const cutoff = new Date(Date.now()).toISOString();
  await client.from(CHALLENGES).delete().lt("expires_at", cutoff);
}

export async function insertChallenge(challenge: string): Promise<string> {
  await pruneExpiredChallenges();
  const client = getSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const { data, error } = await client
    .from(CHALLENGES)
    .insert({ challenge, expires_at: expiresAt })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function consumeChallenge(challengeId: string): Promise<string | null> {
  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from(CHALLENGES)
    .delete()
    .eq("id", challengeId)
    .gt("expires_at", now)
    .select("challenge")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.challenge || typeof data.challenge !== "string") return null;
  return data.challenge;
}

export async function countPasskeys(): Promise<number> {
  const client = getSupabaseAdminClient();
  const { count, error } = await client
    .from(PASSKEYS)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listPasskeysForWebAuthn(): Promise<
  { id: string; transports?: AuthenticatorTransportFuture[] }[]
> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from(PASSKEYS)
    .select("credential_id, transports");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.credential_id as string,
    transports: (row.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
  }));
}

export async function getPasskeyByCredentialId(
  credentialId: string,
): Promise<StoredPasskeyRow | null> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from(PASSKEYS)
    .select("credential_id, public_key, counter, transports")
    .eq("credential_id", credentialId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    credential_id: data.credential_id as string,
    public_key: data.public_key as string,
    counter: Number(data.counter),
    transports: (data.transports as string[] | null) ?? null,
  };
}

export async function insertPasskey(row: {
  credentialId: string;
  publicKeyBase64Url: string;
  counter: number;
  transports: AuthenticatorTransportFuture[];
  aaguid: string;
}): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client.from(PASSKEYS).insert({
    credential_id: row.credentialId,
    public_key: row.publicKeyBase64Url,
    counter: row.counter,
    transports: row.transports,
    aaguid: row.aaguid,
  });
  if (error) throw new Error(error.message);
}

export async function updatePasskeyCounter(credentialId: string, counter: number): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client.from(PASSKEYS).update({ counter }).eq("credential_id", credentialId);
  if (error) throw new Error(error.message);
}
