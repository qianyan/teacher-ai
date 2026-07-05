import { NextResponse } from "next/server";

/** Payment webhook stub — upgrade profiles.plan via service_role in Phase 2. */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ error: "Payment webhooks not enabled yet" }, { status: 501 });
}
