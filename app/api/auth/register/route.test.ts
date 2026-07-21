import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const createUser = vi.fn();
  const deleteUser = vi.fn();
  const admin = {
    auth: { admin: { createUser, deleteUser } },
  };
  const isInviteCodeAvailable = vi.fn();
  const claimInviteCode = vi.fn();
  return {
    admin,
    createUser,
    deleteUser,
    isInviteCodeAvailable,
    claimInviteCode,
  };
});

vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdminClient: () => mocks.admin,
}));

vi.mock("@/lib/server/invite-codes", () => ({
  isInviteCodeAvailable: (code: string) => mocks.isInviteCodeAvailable(code),
  claimInviteCode: (code: string, userId: string) =>
    mocks.claimInviteCode(code, userId),
}));

import { POST } from "@/app/api/auth/register/route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body:
      typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function json(res: Response): Promise<{ ok?: boolean; error?: string }> {
  return (await res.json()) as { ok?: boolean; error?: string };
}

beforeEach(() => {
  mocks.createUser.mockReset();
  mocks.deleteUser.mockReset();
  mocks.isInviteCodeAvailable.mockReset();
  mocks.claimInviteCode.mockReset();
});

describe("POST /api/auth/register — input validation", () => {
  it("rejects invalid JSON with 400", async () => {
    const res = await POST(jsonRequest("not-json"));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const res = await POST(
      jsonRequest({ email: "bad", password: "password1", inviteCode: "C" }),
    );
    expect(res.status).toBe(400);
    expect((await json(res)).error).toContain("邮箱");
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await POST(
      jsonRequest({ email: "a@b.c", password: "short", inviteCode: "C" }),
    );
    expect(res.status).toBe(400);
    expect((await json(res)).error).toContain("密码");
  });

  it("rejects a missing invite code", async () => {
    const res = await POST(
      jsonRequest({ email: "a@b.c", password: "password1", inviteCode: "" }),
    );
    expect(res.status).toBe(400);
    expect((await json(res)).error).toContain("邀请码");
  });

  it("does not touch Supabase or invite codes when validation fails", async () => {
    await POST(jsonRequest({ email: "bad" }));
    expect(mocks.isInviteCodeAvailable).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/register — invite + user creation", () => {
  const validBody = {
    email: "teacher@example.com",
    password: "password1",
    inviteCode: "SPRING-2026-A",
  };

  it("registers a user when the invite code is valid and claimable", async () => {
    mocks.isInviteCodeAvailable.mockResolvedValue(true);
    mocks.createUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.claimInviteCode.mockResolvedValue(true);

    const res = await POST(jsonRequest(validBody));
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true, userId: "user-1" });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("returns 403 when the invite code is not available", async () => {
    mocks.isInviteCodeAvailable.mockResolvedValue(false);

    const res = await POST(jsonRequest(validBody));
    expect(res.status).toBe(403);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("returns 409 when the email is already registered", async () => {
    mocks.isInviteCodeAvailable.mockResolvedValue(true);
    mocks.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const res = await POST(jsonRequest(validBody));
    expect(res.status).toBe(409);
  });

  it("deletes the user and returns 403 when the claim race is lost", async () => {
    mocks.isInviteCodeAvailable.mockResolvedValue(true);
    mocks.createUser.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });
    mocks.claimInviteCode.mockResolvedValue(false);

    const res = await POST(jsonRequest(validBody));
    expect(res.status).toBe(403);
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-2");
  });
});
