#!/usr/bin/env tsx
/**
 * Batch-create single-use invite codes.
 *
 * Usage:
 *   npx tsx scripts/create-invite-codes-batch.ts 10 "Spring 2026 cohort"
 */
import { randomBytes } from "node:crypto";
import { getSupabaseAdminClient } from "../lib/server/supabase-admin";

function generateCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

async function main() {
  const count = Number.parseInt(process.argv[2] ?? "0", 10);
  const note = process.argv[3]?.trim() ?? null;

  if (!Number.isFinite(count) || count < 1 || count > 500) {
    console.error("Usage: npx tsx scripts/create-invite-codes-batch.ts <count 1-500> [note]");
    process.exit(1);
  }

  const rows = Array.from({ length: count }, () => ({
    code: generateCode(),
    max_uses: 1,
    note,
  }));

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("invite_codes").insert(rows).select("code");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`Created ${data?.length ?? 0} single-use invite codes:`);
  for (const row of data ?? []) {
    console.log(row.code);
  }
}

main();
