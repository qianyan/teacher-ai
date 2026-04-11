import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

/**
 * Deletes a blob by public URL (used when user renames or removes a photo).
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not configured" },
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

  try {
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
