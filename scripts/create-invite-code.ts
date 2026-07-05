#!/usr/bin/env tsx
/**
 * Create a single-use invite code.
 *
 * Usage:
 *   npx tsx scripts/create-invite-code.ts              # auto-generate code
 *   npx tsx scripts/create-invite-code.ts MY-CODE      # explicit code
 *   npx tsx scripts/create-invite-code.ts MY-CODE "Batch note"
 */
import { randomBytes } from "node:crypto";
import { getSupabaseAdminClient } from "../lib/server/supabase-admin";

function generateCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

async function main() {
  const argCode = process.argv[2]?.trim();
  const note = process.argv[3]?.trim() ?? null;
  const code = argCode || generateCode();

  if (code.length > 64) {
    console.error("Code must be at most 64 characters");
    process.exit(1);
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("invite_codes")
    .insert({ code, max_uses: 1, note })
    .select("id,code,max_uses,note")
    .single();

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log("Created single-use invite code:", data);
}

main();
