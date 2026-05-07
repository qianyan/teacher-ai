export type WebAuthnRuntimeConfig = {
  rpID: string;
  rpName: string;
  expectedOrigins: string[];
};

export function isWebAuthnBackendConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return Boolean(url && key);
}

export function getWebAuthnConfig(): WebAuthnRuntimeConfig {
  const rpID = process.env.WEBAUTHN_RP_ID?.trim() || "localhost";
  const rpName = process.env.WEBAUTHN_RP_NAME?.trim() || "Teacher AI";
  const originRaw = process.env.WEBAUTHN_ORIGIN?.trim();
  const expectedOrigins = originRaw
    ? originRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ["http://localhost:3000"];
  return { rpID, rpName, expectedOrigins };
}

export function getRequestOrigin(request: Request): string | null {
  return request.headers.get("origin");
}

export function assertOriginAllowed(request: Request, expectedOrigins: string[]): string {
  const origin = getRequestOrigin(request);
  if (!origin) {
    throw new Error("Missing Origin header");
  }
  if (!expectedOrigins.includes(origin)) {
    throw new Error("Origin not allowed for WebAuthn");
  }
  return origin;
}
