import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// When the auth backend is unreachable (e.g. local Supabase not running),
// creating an auth client with a stale session cookie makes auth-js fire a
// background token-refresh chain whose rejections spam the server console and
// cannot be caught from outside. Gate client creation on a cheap health check
// instead: one caught fetch per interval, zero uncaught rejections.
const AUTH_CHECK_INTERVAL_MS = 15_000;

let authDownUntil = 0;
let authHealthyAt = 0;
let authBackendWarned = false;

function markAuthBackendDown() {
  authDownUntil = Date.now() + AUTH_CHECK_INTERVAL_MS;
  if (authBackendWarned) return;
  authBackendWarned = true;
  console.warn(
    "[middleware] Supabase auth unreachable; treating requests as anonymous. " +
      "Is local Supabase running (npm run supabase:start)?",
  );
}

/** Sync fast path for callers that only need the cached verdict. */
export function isAuthBackendDown(): boolean {
  return Date.now() < authDownUntil;
}

/**
 * Cached health verdict for the auth backend. At most one real request per
 * AUTH_CHECK_INTERVAL_MS; a failure treats requests as anonymous until the
 * interval elapses and the probe is retried.
 */
export async function isAuthBackendReachable(
  url: string,
  anonKey: string,
): Promise<boolean> {
  const now = Date.now();
  if (now < authDownUntil) return false;
  if (now - authHealthyAt < AUTH_CHECK_INTERVAL_MS) return true;
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
    if (res.ok) {
      authHealthyAt = Date.now();
      // Backend recovered: allow the next outage to warn again.
      authBackendWarned = false;
      return true;
    }
  } catch {
    // Unreachable: fall through to mark down.
  }
  markAuthBackendDown();
  return false;
}

function noteGetUserError(error: unknown) {
  // auth-js classifies network-level failures as AuthRetryableFetchError with
  // status 0 (no HTTP response was received). The health probe should have
  // caught this already; this only covers a backend dying mid-request.
  const isUnreachable =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 0;
  if (isUnreachable) markAuthBackendDown();
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return supabaseResponse;
  if (!(await isAuthBackendReachable(url, anonKey))) return supabaseResponse;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const { error } = await supabase.auth.getUser();
    if (error) noteGetUserError(error);
  } catch (error) {
    // Defensive: getUser normally returns errors instead of throwing.
    noteGetUserError(error);
  }
  return supabaseResponse;
}
