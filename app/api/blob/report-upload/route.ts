import {
  normalizeReportPhotoContentType,
} from "@/lib/photos/report-photo-mime";
import { userScopedStoragePath } from "@/lib/server/history-store";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { getReportPhotosBucket } from "@/lib/server/report-photos-bucket";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_BYTES = 50 * 1024 * 1024;

type Body = {
  pathname?: unknown;
  contentType?: unknown;
  size?: unknown;
};

function isSafeObjectPath(path: string): boolean {
  if (!path || path.length > 512) return false;
  if (path.startsWith("/") || path.includes("..")) return false;
  return /^[\w./-]+$/.test(path);
}

/**
 * Issues a signed upload URL for report photos (browser → Supabase Storage).
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * and a public bucket (see .env.example).
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SUPABASE_URL is not configured" },
      { status: 503 },
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pathname =
    typeof body.pathname === "string" ? body.pathname.trim() : "";
  const rawContentType =
    typeof body.contentType === "string" ? body.contentType.trim() : "";
  const size = typeof body.size === "number" && Number.isFinite(body.size) ? body.size : null;
  const filenameForMime = pathname.split("/").pop() ?? pathname;

  if (!pathname || !isSafeObjectPath(pathname)) {
    const staleBlobClient =
      body &&
      typeof body === "object" &&
      body !== null &&
      "type" in body &&
      !("pathname" in body);
    const hint = staleBlobClient
      ? " Page still running old Vercel Blob client — hard-refresh (Cmd+Shift+R) or redeploy so the Supabase upload script loads."
      : "";
    return NextResponse.json({ error: `Invalid pathname.${hint}` }, { status: 400 });
  }
  const contentType = normalizeReportPhotoContentType(filenameForMime, rawContentType);
  if (!contentType) {
    return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
  }
  // Some environments report file.size === 0 briefly; only enforce max when we have a positive size.
  if (size !== null && size > 0 && size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / (1024 * 1024)}MB)` },
      { status: 400 },
    );
  }

  const bucket = getReportPhotosBucket();

  try {
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const scopedPath = userScopedStoragePath(user.id, pathname);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(scopedPath, { upsert: true });

    if (error || !data) {
      const message = error?.message ?? "Could not create signed upload URL";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return NextResponse.json({
      bucket,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: pub.publicUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload URL failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
