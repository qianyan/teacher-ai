import { generateDynamicBodyHtml } from "@/lib/agent/generate-dynamic-body";
import {
  consumeGenerationQuota,
  QuotaExceededError,
  refundGenerationQuota,
} from "@/lib/server/entitlements";
import { assembleFullDocument } from "@/lib/report/assemble";
import {
  readReferenceFooter,
  readTemplateShell,
} from "@/lib/report/read-assets";
import { resolveTemplateId } from "@/lib/report/templates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export type GenerateRequestBody = {
  biweeklyDateRange: string;
  englishClassName: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  photoLogicalNames: string[];
  templateId?: string;
};

export async function POST(request: Request) {
  try {
    let body: GenerateRequestBody;
    try {
      body = (await request.json()) as GenerateRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      biweeklyDateRange,
      englishClassName,
      subTitle,
      introHtml,
      bodyHtml,
      photoLogicalNames,
      templateId: rawTemplateId,
    } = body;
    const templateId = resolveTemplateId(rawTemplateId);

    if (!biweeklyDateRange || typeof biweeklyDateRange !== "string") {
      return NextResponse.json(
        { error: "biweeklyDateRange is required" },
        { status: 400 },
      );
    }
    if (typeof englishClassName !== "string" || !englishClassName.trim()) {
      return NextResponse.json(
        { error: "englishClassName is required" },
        { status: 400 },
      );
    }
    if (typeof subTitle !== "string" || typeof introHtml !== "string") {
      return NextResponse.json(
        { error: "subTitle and introHtml must be strings" },
        { status: 400 },
      );
    }
    if (typeof bodyHtml !== "string") {
      return NextResponse.json({ error: "bodyHtml is required" }, { status: 400 });
    }
    if (!Array.isArray(photoLogicalNames)) {
      return NextResponse.json(
        { error: "photoLogicalNames must be an array of strings" },
        { status: 400 },
      );
    }
    if (photoLogicalNames.some((name) => typeof name !== "string")) {
      return NextResponse.json(
        { error: "photoLogicalNames must contain only strings" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Atomically consume one quota slot BEFORE generating: the DB checks the
    // monthly count and inserts the usage row in a single transaction, so
    // concurrent requests cannot race past the free-tier limit (issue #15).
    const usageEventId = await consumeGenerationQuota(user.id);

    let dynamicBodyHtml: string;
    let fullHtml: string;
    try {
      dynamicBodyHtml = await generateDynamicBodyHtml({
        biweeklyDateRange,
        englishClassName,
        subTitle,
        introHtml,
        bodyHtml,
        photoLogicalNames,
        templateId,
      });

      const shell = readTemplateShell(templateId);
      const footer = readReferenceFooter();
      fullHtml = assembleFullDocument(shell, footer, {
        biweeklyDateRange,
        englishClassName,
        subTitle,
        introHtml,
        dynamicBodyHtml,
      });
    } catch (err) {
      // Refund the consumed slot: failed generations must not burn quota
      // (same semantics as the old record-on-success flow).
      try {
        await refundGenerationQuota(user.id, usageEventId);
      } catch (refundErr) {
        console.error("[generate] quota refund failed", {
          userId: user.id,
          usageEventId,
          error:
            refundErr instanceof Error ? refundErr.message : String(refundErr),
        });
      }
      throw err;
    }

    return NextResponse.json({ dynamicBodyHtml, fullHtml });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: err.message, code: "quota_exceeded", limit: err.limit },
        { status: 429 },
      );
    }
    const message = err instanceof Error ? err.message : "Generate failed";
    const missingKey =
      /API_KEY|LLM_API_KEY|OPENAI_API_KEY/i.test(message) ||
      message.includes("required");
    return NextResponse.json(
      { error: message },
      { status: missingKey ? 503 : 500 },
    );
  }
}
