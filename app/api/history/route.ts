import {
  deleteHistoryEntry,
  insertHistoryEntry,
  listHistoryEntries,
  parseRemoteSnapshot,
} from "@/lib/server/history-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type CreateHistoryBody = { snapshot?: unknown; savedAt?: unknown };

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await listHistoryEntries(supabase);
    return NextResponse.json({ history: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: CreateHistoryBody;
  try {
    body = (await request.json()) as CreateHistoryBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const snapshot = parseRemoteSnapshot(body.snapshot);
  if (!snapshot) {
    return NextResponse.json(
      { error: "snapshot is required and must not contain fileBlob" },
      { status: 400 },
    );
  }

  const savedAt =
    typeof body.savedAt === "string" && Number.isFinite(Date.parse(body.savedAt))
      ? body.savedAt
      : undefined;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const row = await insertHistoryEntry(supabase, {
      userId: user.id,
      snapshot,
      savedAt,
    });
    return NextResponse.json({ history: row }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
