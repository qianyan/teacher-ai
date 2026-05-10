/** Bucket for report HTML image URLs (public read). Override via SUPABASE_REPORT_PHOTOS_BUCKET. */
export function getReportPhotosBucket(): string {
  return process.env.SUPABASE_REPORT_PHOTOS_BUCKET?.trim() || "report-photos";
}
