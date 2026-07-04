/**
 * Minimal E2B client via documented HTTP APIs (api.e2b.app + sandbox.e2b.app/envd).
 * Avoids bundling the e2b npm SDK inside Next.js serverless functions on Vercel.
 *
 * @see https://e2b.dev/docs/api-reference/sandboxes/create-sandbox
 * @see https://e2b.dev/docs/api-reference/filesystem/upload-a-file-and-ensure-the-parent-directories-exist-if-the-file-exists-it-will-be-overwritten
 * @see https://e2b.dev/docs/api-reference/process/start
 */

const E2B_API_URL = process.env.E2B_API_URL ?? "https://api.e2b.app";
const E2B_SANDBOX_HOST = process.env.E2B_SANDBOX_URL ?? "https://sandbox.e2b.app";
const ENVD_PORT = 49983;

export interface E2bSandboxSession {
  sandboxId: string;
  envdAccessToken: string | null;
}

interface CreateSandboxResponse {
  sandboxID: string;
  envdAccessToken?: string | null;
}

interface ProcessStartEvent {
  start?: { pid?: number };
  data?: { stdout?: string; stderr?: string };
  end?: {
    exitCode?: number;
    exited?: boolean;
    status?: string;
    error?: string | null;
  };
}

interface ProcessStartMessage {
  event?: ProcessStartEvent;
}

export class E2bCommandError extends Error {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;

  constructor(exitCode: number, stdout: string, stderr: string, detail?: string) {
    super(
      detail ??
        `E2B command failed (exit ${exitCode})${stderr ? `: ${stderr.slice(0, 4000)}` : ""}`,
    );
    this.name = "E2bCommandError";
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

function parseExitCode(status: string | undefined, exitCode: number | undefined): number {
  if (typeof exitCode === "number" && Number.isFinite(exitCode)) return exitCode;
  const match = status?.match(/(\d+)\s*$/);
  return match ? Number.parseInt(match[1], 10) : 1;
}

function connectJsonEnvelope(json: string): Buffer {
  const payload = Buffer.from(json, "utf8");
  const envelope = Buffer.alloc(5 + payload.length);
  envelope[0] = 0x00;
  envelope.writeUInt32BE(payload.length, 1);
  payload.copy(envelope, 5);
  return envelope;
}

function decodeProcessOutput(value: string | undefined): string {
  if (!value) return "";
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return value;
  }
}

function applyProcessMessage(
  msg: ProcessStartMessage,
  state: { stdout: string; stderr: string; exitCode: number; error?: string },
): void {
  const event = msg.event;
  if (!event) return;
  if (event.data?.stdout) state.stdout += decodeProcessOutput(event.data.stdout);
  if (event.data?.stderr) state.stderr += decodeProcessOutput(event.data.stderr);
  if (event.end) {
    state.exitCode = parseExitCode(event.end.status, event.end.exitCode);
    state.error = event.end.error ?? state.error;
  }
}

function parseConnectEnvelopeStream(buffer: Buffer): {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
} {
  const state = { stdout: "", stderr: "", exitCode: 1, error: undefined as string | undefined };
  let offset = 0;

  while (offset + 5 <= buffer.length) {
    const flags = buffer[offset];
    const length = buffer.readUInt32BE(offset + 1);
    offset += 5;
    if (length < 0 || offset + length > buffer.length) break;

    const payload = buffer.subarray(offset, offset + length);
    offset += length;

    if (flags === 0x02) {
      try {
        const endMsg = JSON.parse(payload.toString("utf8")) as {
          error?: { message?: string };
        };
        if (endMsg.error?.message) state.error = endMsg.error.message;
      } catch {
        /* ignore malformed end-stream frame */
      }
      continue;
    }

    if (flags === 0x01) {
      throw new Error("E2B command stream used unsupported compressed frames");
    }
    if (flags !== 0x00) {
      continue;
    }

    applyProcessMessage(JSON.parse(payload.toString("utf8")) as ProcessStartMessage, state);
  }

  return state;
}

function parseConnectNdjsonStream(buffer: Buffer): {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
} {
  const state = { stdout: "", stderr: "", exitCode: 1, error: undefined as string | undefined };
  const text = buffer.toString("utf8").trim();
  if (!text) return state;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    applyProcessMessage(JSON.parse(trimmed) as ProcessStartMessage, state);
  }

  return state;
}

async function readApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    /* ignore */
  }
  return `${res.status} ${res.statusText}`.trim();
}

function platformHeaders(apiKey: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("X-API-Key", apiKey);
  return headers;
}

function envdHeaders(session: E2bSandboxSession, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("E2b-Sandbox-Id", session.sandboxId);
  headers.set("E2b-Sandbox-Port", String(ENVD_PORT));
  if (session.envdAccessToken) {
    headers.set("X-Access-Token", session.envdAccessToken);
  }
  return headers;
}

export async function e2bCreateSandbox(
  templateId: string,
  timeoutSeconds: number,
  apiKey: string,
): Promise<E2bSandboxSession> {
  const res = await fetch(`${E2B_API_URL}/sandboxes`, {
    method: "POST",
    headers: platformHeaders(apiKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      templateID: templateId,
      timeout: timeoutSeconds,
      secure: true,
      allow_internet_access: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`E2B create sandbox failed: ${await readApiError(res)}`);
  }

  const data = (await res.json()) as CreateSandboxResponse;
  return {
    sandboxId: data.sandboxID,
    envdAccessToken: data.envdAccessToken ?? null,
  };
}

export async function e2bDeleteSandbox(
  session: E2bSandboxSession,
  apiKey: string,
): Promise<void> {
  const res = await fetch(`${E2B_API_URL}/sandboxes/${session.sandboxId}`, {
    method: "DELETE",
    headers: platformHeaders(apiKey),
  });

  if (res.status === 404) return;
  if (!res.ok && res.status !== 204) {
    throw new Error(`E2B delete sandbox failed: ${await readApiError(res)}`);
  }
}

export async function e2bUploadFile(
  session: E2bSandboxSession,
  path: string,
  content: string | Buffer,
  signal?: AbortSignal,
): Promise<void> {
  const form = new FormData();
  const blob =
    typeof content === "string"
      ? new Blob([content], { type: "text/html;charset=utf-8" })
      : new Blob([content], { type: "application/octet-stream" });
  form.append("file", blob, path.split("/").pop() ?? "file");

  const url = new URL("/files", E2B_SANDBOX_HOST);
  url.searchParams.set("path", path);

  const res = await fetch(url, {
    method: "POST",
    headers: envdHeaders(session),
    body: form,
    signal,
  });

  if (!res.ok) {
    throw new Error(`E2B upload failed: ${await readApiError(res)}`);
  }
}

export async function e2bDownloadFile(
  session: E2bSandboxSession,
  path: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  const url = new URL("/files", E2B_SANDBOX_HOST);
  url.searchParams.set("path", path);

  const res = await fetch(url, {
    method: "GET",
    headers: envdHeaders(session),
    signal,
  });

  if (!res.ok) {
    throw new Error(`E2B download failed: ${await readApiError(res)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function parseConnectJsonStream(
  body: ReadableStream<Uint8Array> | null,
): Promise<{ stdout: string; stderr: string; exitCode: number; error?: string }> {
  if (!body) {
    throw new Error("E2B command stream ended without output");
  }

  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    total += value.length;
  }

  const buffer = Buffer.concat(
    parts.map((part) => Buffer.from(part)),
    total,
  );

  if (buffer.length === 0) {
    throw new Error("E2B command stream ended without output");
  }

  const framed = parseConnectEnvelopeStream(buffer);
  const sawProcessOutput =
    framed.stdout.length > 0 ||
    framed.stderr.length > 0 ||
    framed.exitCode === 0 ||
    framed.error !== undefined;

  if (sawProcessOutput) return framed;

  if (buffer[0] === 0x7b /* { */) {
    return parseConnectNdjsonStream(buffer);
  }

  return framed;
}

export async function e2bRunCommand(
  session: E2bSandboxSession,
  command: string,
  timeoutMs: number,
  signal?: AbortSignal,
  env?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const headers = envdHeaders(session, {
    "Connect-Protocol-Version": "1",
    "Connect-Timeout-Ms": String(timeoutMs),
    "Content-Type": "application/connect+json",
    "Keepalive-Ping-Interval": "50",
    Authorization: `Basic ${Buffer.from("user:").toString("base64")}`,
  });

  const requestJson = JSON.stringify({
    process: {
      cmd: "/bin/bash",
      args: ["-l", "-c", command],
      ...(env && Object.keys(env).length > 0 ? { envs: env } : {}),
    },
    stdin: false,
  });

  const res = await fetch(`${E2B_SANDBOX_HOST}/process.Process/Start`, {
    method: "POST",
    headers,
    body: connectJsonEnvelope(requestJson),
    signal,
  });

  if (!res.ok) {
    throw new Error(`E2B command start failed: ${await readApiError(res)}`);
  }

  const result = await parseConnectJsonStream(res.body);
  if (result.exitCode !== 0) {
    throw new E2bCommandError(
      result.exitCode,
      result.stdout,
      result.stderr,
      result.error ?? undefined,
    );
  }

  return result;
}
