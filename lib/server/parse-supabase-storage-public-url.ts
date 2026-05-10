import { getReportPhotosBucket } from "@/lib/server/report-photos-bucket";

/**
 * Parses a Supabase Storage public object URL into the object path within the bucket.
 * Example: .../storage/v1/object/public/report-photos/a/b.jpg → a/b.jpg
 */
export function objectPathFromSupabasePublicUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const bucket = getReportPhotosBucket();
  const prefix = `/storage/v1/object/public/${bucket}/`;
  const idx = u.pathname.indexOf(prefix);
  if (idx === -1) return null;

  const encoded = u.pathname.slice(idx + prefix.length);
  if (!encoded || encoded.includes("..")) return null;

  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}
