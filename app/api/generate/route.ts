import { generateDynamicBodyHtml } from "@/lib/agent/generate-dynamic-body";
import { assembleFullDocument } from "@/lib/report/assemble";
import {
  createGenerateJob,
  getGenerateJob,
  runGenerateJob,
} from "@/lib/report/generate-jobs";
import {
  readReferenceFooter,
  readReferenceShell,
} from "@/lib/report/read-assets";
import { after, NextResponse } from "next/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export type GenerateRequestBody = {
  biweeklyDateRange: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  photoLogicalNames: string[];
};

function parseAndValidate(body: unknown): GenerateRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const candidate = body as Partial<GenerateRequestBody>;
  if (
    !candidate.biweeklyDateRange ||
    typeof candidate.biweeklyDateRange !== "string"
  ) {
    return null;
  }
  if (
    typeof candidate.subTitle !== "string" ||
    typeof candidate.introHtml !== "string" ||
    typeof candidate.bodyHtml !== "string"
  ) {
    return null;
  }
  if (
    !Array.isArray(candidate.photoLogicalNames) ||
    candidate.photoLogicalNames.some((x) => typeof x !== "string")
  ) {
    return null;
  }
  return {
    biweeklyDateRange: candidate.biweeklyDateRange,
    subTitle: candidate.subTitle,
    introHtml: candidate.introHtml,
    bodyHtml: candidate.bodyHtml,
    photoLogicalNames: candidate.photoLogicalNames,
  };
}

async function performGenerate(input: GenerateRequestBody): Promise<{
  dynamicBodyHtml: string;
  fullHtml: string;
}> {
  const dynamicBodyHtml = await generateDynamicBodyHtml(input);
  const shell = readReferenceShell();
  const footer = readReferenceFooter();
  const fullHtml = assembleFullDocument(shell, footer, {
    biweeklyDateRange: input.biweeklyDateRange,
    subTitle: input.subTitle,
    introHtml: input.introHtml,
    dynamicBodyHtml,
  });
  return { dynamicBodyHtml, fullHtml };
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const input = parseAndValidate(rawBody);
  if (!input) {
    return NextResponse.json(
      { error: "Invalid payload for generate request" },
      { status: 400 },
    );
  }

  const job = createGenerateJob(input);
  after(async () => {
    await runGenerateJob(job.id, performGenerate);
  });

  return NextResponse.json(
    {
      jobId: job.id,
      status: job.status,
      pollIntervalMs: 2000,
    },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId")?.trim();
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  const job = getGenerateJob(jobId);
  if (!job) {
    return NextResponse.json(
      { error: "Job not found (maybe expired). Please submit again." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      jobId: job.id,
      status: job.status,
      dynamicBodyHtml: job.dynamicBodyHtml,
      fullHtml: job.fullHtml,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
