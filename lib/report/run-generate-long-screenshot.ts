import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

/** Photo-heavy reports use data URLs; ~30+ images can exceed 100MB. */
const MAX_HTML_BYTES = 200 * 1024 * 1024;

function projectScriptPath(): string {
  return path.join(process.cwd(), "scripts", "generate-long-screenshot.py");
}

/**
 * Writes HTML to a temp file and runs `scripts/generate-long-screenshot.py`
 * (Playwright full-page screenshot). Requires local `python3`, `npx`, and Playwright
 * browsers as in the skill workflow.
 */
export async function runGenerateLongScreenshot(html: string): Promise<Buffer> {
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_HTML_BYTES) {
    throw new Error(
      `HTML is too large for screenshot (${bytes} bytes; max ${MAX_HTML_BYTES})`,
    );
  }

  const scriptPath = projectScriptPath();
  await fs.access(scriptPath).catch(() => {
    throw new Error(`Missing script: ${scriptPath}`);
  });

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "teacher-ai-report-"));
  const htmlPath = path.join(tmp, "report.html");
  const pngPath = path.join(tmp, "report.png");

  await fs.writeFile(htmlPath, html, "utf8");

  const { code, stderr, stdout } = await new Promise<{
    code: number | null;
    stderr: string;
    stdout: string;
  }>((resolve, reject) => {
    const child = spawn("python3", [scriptPath, htmlPath], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.on("error", reject);
    child.on("close", (c) => resolve({ code: c ?? 1, stderr, stdout }));
  });

  try {
    if (code !== 0) {
      const hint = [stderr, stdout].filter(Boolean).join("\n").trim();
      throw new Error(
        hint
          ? `generate-long-screenshot.py failed: ${hint}`
          : `generate-long-screenshot.py exited with code ${code}`,
      );
    }
    return await fs.readFile(pngPath);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
