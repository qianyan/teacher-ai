type SmokeCheck = {
  path: string;
  acceptStatuses?: number[];
  expectJson?: boolean;
};

const CHECKS: SmokeCheck[] = [
  { path: "/" },
  { path: "/api/session/webauthn/status", expectJson: true },
];

function baseUrl(): string {
  const raw = process.env.PREVIEW_URL ?? process.env.DEPLOYMENT_URL ?? "";
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) {
    throw new Error("PREVIEW_URL or DEPLOYMENT_URL is required.");
  }
  return trimmed;
}

function requestHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "text/html,application/json",
  };
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
  }
  return headers;
}

async function runCheck(url: string, check: SmokeCheck): Promise<void> {
  const acceptStatuses = check.acceptStatuses ?? [200];
  const res = await fetch(`${url}${check.path}`, {
    headers: requestHeaders(),
    redirect: "follow",
  });

  if (!acceptStatuses.includes(res.status)) {
    const body = await res.text();
    throw new Error(
      `${check.path} returned ${res.status}. Body: ${body.slice(0, 200)}`,
    );
  }

  if (check.expectJson) {
    await res.json();
  }

  console.log(`OK ${check.path} (${res.status})`);
}

async function main(): Promise<void> {
  const url = baseUrl();
  console.log(`Running smoke tests against ${url}`);

  for (const check of CHECKS) {
    await runCheck(url, check);
  }

  console.log(`Smoke tests passed for ${url}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
