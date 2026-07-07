import { buildTemplatePreviewHtml } from "@/lib/report/build-template-preview";
import { resolveTemplateId } from "@/lib/report/templates";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const templateId = resolveTemplateId(searchParams.get("templateId"));

  try {
    const html = buildTemplatePreviewHtml(templateId);
    return NextResponse.json({ templateId, html });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
