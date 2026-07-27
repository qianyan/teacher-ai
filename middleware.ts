import {
  isAuthBackendReachable,
  updateSession,
} from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/auth/callback", "/api/auth/register", "/api/webhooks/stripe"];

// Dev-only E2E harness route (the page itself returns 404 in production).
if (process.env.NODE_ENV !== "production") PUBLIC_PREFIXES.push("/dev-preview");

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  const response = await updateSession(request);
  if (isPublic(pathname)) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return response;

  let user: { id: string } | null = null;
  if (await isAuthBackendReachable(url, anonKey)) {
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      // Auth backend died mid-request: treat as anonymous (updateSession
      // already tripped the circuit breaker and logged the warning).
    }
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|teacher-ai-icon.png).*)"],
};
