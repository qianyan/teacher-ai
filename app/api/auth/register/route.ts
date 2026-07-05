import { claimInviteCode, isInviteCodeAvailable } from "@/lib/server/invite-codes";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { NextResponse } from "next/server";

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  inviteCode?: unknown;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "请输入有效邮箱" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 });
  }
  if (!inviteCode) {
    return NextResponse.json({ error: "请输入邀请码" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  try {
    const available = await isInviteCodeAvailable(inviteCode);
    if (!available) {
      return NextResponse.json({ error: "邀请码无效、已使用或已过期" }, { status: 403 });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const userId = data.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "注册失败" }, { status: 500 });
    }

    const claimed = await claimInviteCode(inviteCode, userId);
    if (!claimed) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "邀请码已被使用，请更换邀请码后重试" },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, userId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "注册失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
