import { generateDynamicBodyHtml } from "@/lib/agent/generate-dynamic-body";
import {
  checkCanGenerate,
  QuotaExceededError,
  recordGenerateUsage,
} from "@/lib/server/entitlements";
import { assembleFullDocument } from "@/lib/report/assemble";
import {
  readReferenceFooter,
  readReferenceShell,
} from "@/lib/report/read-assets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export type GenerateRequestBody = {
  biweeklyDateRange: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  photoLogicalNames: string[];
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
      subTitle,
      introHtml,
      bodyHtml,
      photoLogicalNames,
    } = body;

    if (!biweeklyDateRange || typeof biweeklyDateRange !== "string") {
      return NextResponse.json(
        { error: "biweeklyDateRange is required" },
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

    await checkCanGenerate(supabase, user.id);

    const dynamicBodyHtml = await generateDynamicBodyHtml({
      biweeklyDateRange,
      subTitle,
      introHtml,
      bodyHtml,
      photoLogicalNames,
    });

    const shell = readReferenceShell();
    const footer = readReferenceFooter();
    const fullHtml = assembleFullDocument(shell, footer, {
      biweeklyDateRange,
      subTitle,
      introHtml,
      dynamicBodyHtml,
    });

    await recordGenerateUsage(user.id);

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
