import { NextResponse } from "next/server";

// Liveness probe for load balancers / uptime checks. Deliberately dependency
// free: no database, no auth — the middleware whitelists this path.
export async function GET(request: Request): Promise<NextResponse> {
  void request; // Next.js passes the request in; the probe has nothing to inspect.
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
