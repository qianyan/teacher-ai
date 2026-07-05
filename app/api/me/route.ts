import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { getUsageSummary } = await import("@/lib/server/entitlements");
    const usage = await getUsageSummary(supabase, user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, plan")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? null,
        displayName: profile?.display_name ?? null,
        plan: profile?.plan ?? usage.plan,
      },
      usage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
