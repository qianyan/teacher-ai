import { runGenerateLongScreenshot } from "@/lib/report/run-generate-long-screenshot";
import { NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(request: Request) {
  let html: unknown;
  try {
    const body = (await request.json()) as { html?: unknown };
    html = body.html;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof html !== "string") {
    return NextResponse.json(
      { error: "Body must include a string \"html\" field" },
      { status: 400 },
    );
  }

  try {
    const png = await runGenerateLongScreenshot(html);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Screenshot failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
