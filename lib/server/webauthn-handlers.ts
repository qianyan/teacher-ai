import {
  assertSessionLockEnabled,
  isSessionLockEnabled,
  verifySessionLockPin,
} from "@/lib/server/session-lock-pin";
import {
  consumeChallenge,
  countPasskeys,
  getPasskeyByCredentialId,
  insertChallenge,
  insertPasskey,
  listPasskeysForWebAuthn,
  updatePasskeyCounter,
} from "@/lib/server/passkey-store";
import {
  assertOriginAllowed,
  getWebAuthnConfig,
  isWebAuthnBackendConfigured,
} from "@/lib/server/webauthn-config";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  try {
    const lockEnabled = isSessionLockEnabled();
    const backend = isWebAuthnBackendConfigured();
    if (!lockEnabled || !backend) {
      return NextResponse.json({
        lockEnabled,
        webauthnReady: backend,
        passkeyCount: 0,
      });
    }
    const passkeyCount = await countPasskeys();
    return NextResponse.json({ lockEnabled, webauthnReady: true, passkeyCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type RegisterOptionsBody = { pin?: unknown };

export async function registerOptions(request: Request): Promise<NextResponse> {
  let body: RegisterOptionsBody;
  try {
    body = (await request.json()) as RegisterOptionsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    assertSessionLockEnabled();
    if (!isWebAuthnBackendConfigured()) {
      return NextResponse.json({ error: "WebAuthn storage is not configured" }, { status: 503 });
    }
    if (!verifySessionLockPin(body.pin)) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }
    const { rpID, rpName, expectedOrigins } = getWebAuthnConfig();
    assertOriginAllowed(request, expectedOrigins);

    const existing = await listPasskeysForWebAuthn();
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: "teacher-ai-lock",
      userDisplayName: "Teacher AI",
      userID: isoUint8Array.fromUTF8String("teacher-ai-lock-v1"),
      attestationType: "none",
      excludeCredentials: existing.map((p) => ({
        id: p.id,
        transports: p.transports,
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });

    const challengeId = await insertChallenge(options.challenge);
    return NextResponse.json({ options, challengeId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration options failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

type RegisterVerifyBody = {
  pin?: unknown;
  challengeId?: unknown;
  credential?: unknown;
};

export async function registerVerify(request: Request): Promise<NextResponse> {
  let body: RegisterVerifyBody;
  try {
    body = (await request.json()) as RegisterVerifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    assertSessionLockEnabled();
    if (!isWebAuthnBackendConfigured()) {
      return NextResponse.json({ error: "WebAuthn storage is not configured" }, { status: 503 });
    }
    if (!verifySessionLockPin(body.pin)) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }
    const { rpID, expectedOrigins } = getWebAuthnConfig();
    const origin = assertOriginAllowed(request, expectedOrigins);

    if (typeof body.challengeId !== "string" || !body.challengeId) {
      return NextResponse.json({ error: "challengeId is required" }, { status: 400 });
    }
    const expectedChallenge = await consumeChallenge(body.challengeId);
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 400 });
    }

    const credential = body.credential as RegistrationResponseJSON | undefined;
    if (!credential || typeof credential !== "object") {
      return NextResponse.json({ error: "credential is required" }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Registration verification failed" }, { status: 400 });
    }

    const { registrationInfo } = verification;
    const cred = registrationInfo.credential;

    await insertPasskey({
      credentialId: cred.id,
      publicKeyBase64Url: isoBase64URL.fromBuffer(cred.publicKey, "base64url"),
      counter: cred.counter,
      transports: cred.transports ?? [],
      aaguid: registrationInfo.aaguid,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration verify failed";
    const lower = message.toLowerCase();
    const dup =
      lower.includes("duplicate") ||
      lower.includes("unique") ||
      lower.includes("already exists") ||
      /23505/.test(lower);
    const status = dup ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function authOptions(request: Request): Promise<NextResponse> {
  try {
    assertSessionLockEnabled();
    if (!isWebAuthnBackendConfigured()) {
      return NextResponse.json({ error: "WebAuthn storage is not configured" }, { status: 503 });
    }
    const { rpID, expectedOrigins } = getWebAuthnConfig();
    assertOriginAllowed(request, expectedOrigins);

    const allowCredentials = await listPasskeysForWebAuthn();
    if (allowCredentials.length === 0) {
      return NextResponse.json({ error: "No passkeys registered" }, { status: 400 });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: "preferred",
    });

    const challengeId = await insertChallenge(options.challenge);
    return NextResponse.json({ options, challengeId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication options failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

type AuthVerifyBody = {
  challengeId?: unknown;
  credential?: unknown;
};

export async function authVerify(request: Request): Promise<NextResponse> {
  let body: AuthVerifyBody;
  try {
    body = (await request.json()) as AuthVerifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    assertSessionLockEnabled();
    if (!isWebAuthnBackendConfigured()) {
      return NextResponse.json({ error: "WebAuthn storage is not configured" }, { status: 503 });
    }
    const { rpID, expectedOrigins } = getWebAuthnConfig();
    const origin = assertOriginAllowed(request, expectedOrigins);

    if (typeof body.challengeId !== "string" || !body.challengeId) {
      return NextResponse.json({ error: "challengeId is required" }, { status: 400 });
    }
    const expectedChallenge = await consumeChallenge(body.challengeId);
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 400 });
    }

    const credentialResponse = body.credential as AuthenticationResponseJSON | undefined;
    if (!credentialResponse || typeof credentialResponse !== "object") {
      return NextResponse.json({ error: "credential is required" }, { status: 400 });
    }

    const credentialId = credentialResponse.id;
    const dbPasskey = await getPasskeyByCredentialId(credentialId);
    if (!dbPasskey) {
      return NextResponse.json({ error: "Unknown credential" }, { status: 400 });
    }

    const transports =
      dbPasskey.transports && dbPasskey.transports.length > 0
        ? (dbPasskey.transports as AuthenticatorTransportFuture[])
        : undefined;

    const verification = await verifyAuthenticationResponse({
      response: credentialResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: dbPasskey.credential_id,
        publicKey: isoBase64URL.toBuffer(dbPasskey.public_key, "base64url"),
        counter: dbPasskey.counter,
        transports,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Authentication verification failed" }, { status: 400 });
    }

    await updatePasskeyCounter(
      verification.authenticationInfo.credentialID,
      verification.authenticationInfo.newCounter,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication verify failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
