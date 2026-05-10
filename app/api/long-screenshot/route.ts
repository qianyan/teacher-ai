import { runGenerateLongScreenshot } from "@/lib/report/run-generate-long-screenshot";
import { NextResponse } from "next/server";

/**
 * Full-page PNG via Playwright. With `E2B_API_KEY` + `E2B_LONG_SCREENSHOT_TEMPLATE`, runs in E2B;
 * otherwise in-process (`lib/report/screenshot-html-playwright.ts`).
 * Request body should stay under Vercel’s limit (~4.5MB): prefer https Blob URLs (photos are PNG after HEIC normalization); unsynced locals still use data URLs.
 */
export const maxDuration = 120;

const LOG = "[long-screenshot]";

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

  const htmlBytes = Buffer.byteLength(html, "utf8");
  console.info(`${LOG} api: POST`, { htmlBytes });

  try {
    const png = await runGenerateLongScreenshot(html);
    console.info(`${LOG} api: 200 OK`, { pngBytes: png.length });
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Screenshot failed";
    console.error(`${LOG} api: 500`, { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
