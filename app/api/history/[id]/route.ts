import { deleteHistoryEntry, getHistoryEntry } from "@/lib/server/history-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(_: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  if (!isUuidLike(id)) {
    return NextResponse.json({ error: "Invalid history id" }, { status: 400 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const row = await getHistoryEntry(supabase, id);
    if (!row) return NextResponse.json({ error: "History not found" }, { status: 404 });
    return NextResponse.json({ history: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  if (!isUuidLike(id)) {
    return NextResponse.json({ error: "Invalid history id" }, { status: 400 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const deleted = await deleteHistoryEntry(supabase, id);
    if (!deleted) return NextResponse.json({ error: "History not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
