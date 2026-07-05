import { assertUserOwnsStoragePath } from "@/lib/server/history-store";
import { objectPathFromSupabasePublicUrl } from "@/lib/server/parse-supabase-storage-public-url";
import { getReportPhotosBucket } from "@/lib/server/report-photos-bucket";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  let url: unknown;
  try {
    const body = (await request.json()) as { url?: unknown };
    url = body.url;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof url !== "string" || !url.startsWith("http")) {
    return NextResponse.json({ error: "Body must include a string \"url\"" }, { status: 400 });
  }

  const objectPath = objectPathFromSupabasePublicUrl(url);
  if (!objectPath) {
    return NextResponse.json({ error: "Not a report photo URL for this project" }, { status: 400 });
  }

  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!assertUserOwnsStoragePath(user.id, objectPath)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bucket = getReportPhotosBucket();
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage.from(bucket).remove([objectPath]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
