import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mock the Supabase admin client so invite-code logic is exercised in isolation.
 * vi.hoisted keeps the mock handles available to the (hoisted) vi.mock factory.
 */
const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const query = {
    select: () => query,
    ilike: () => query,
    maybeSingle,
  };
  const rpc = vi.fn();
  const admin = { from: () => query, rpc };
  return { admin, maybeSingle, rpc };
});

vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdminClient: () => mocks.admin,
}));

import { claimInviteCode, isInviteCodeAvailable } from "@/lib/server/invite-codes";

beforeEach(() => {
  mocks.maybeSingle.mockReset();
  mocks.rpc.mockReset();
});

describe("isInviteCodeAvailable", () => {
  it("returns false for a blank code without touching the database", async () => {
    await expect(isInviteCodeAvailable("   ")).resolves.toBe(false);
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });

  it("returns true for an unredeemed, unexpired code", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "1", use_count: 0, redeemed_by_user_id: null, expires_at: null },
      error: null,
    });
    await expect(isInviteCodeAvailable("SPRING-2026-A")).resolves.toBe(true);
  });

  it("returns false when already used", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "1", use_count: 1, redeemed_by_user_id: "u", expires_at: null },
      error: null,
    });
    await expect(isInviteCodeAvailable("USED-01")).resolves.toBe(false);
  });

  it("returns false when the code does not exist", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(isInviteCodeAvailable("MISSING")).resolves.toBe(false);
  });

  it("returns false when expired", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "1",
        use_count: 0,
        redeemed_by_user_id: null,
        expires_at: "2020-01-01T00:00:00Z",
      },
      error: null,
    });
    await expect(isInviteCodeAvailable("OLD")).resolves.toBe(false);
  });

  it("throws on a database error", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "boom" } as unknown as null,
    });
    await expect(isInviteCodeAvailable("X")).rejects.toThrow("boom");
  });
});

describe("claimInviteCode", () => {
  it("returns false for a blank code or missing user", async () => {
    await expect(claimInviteCode("   ", "u")).resolves.toBe(false);
    await expect(claimInviteCode("CODE", "")).resolves.toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns false for a code longer than 64 characters", async () => {
    await expect(claimInviteCode("X".repeat(65), "u")).resolves.toBe(false);
  });

  it("returns true when the RPC confirms the claim", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await expect(claimInviteCode("CODE-1", "user-1")).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_invite_code", {
      p_code: "CODE-1",
      p_user_id: "user-1",
    });
  });

  it("returns false when the RPC reports the code already taken", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(claimInviteCode("CODE-1", "user-1")).resolves.toBe(false);
  });

  it("throws on an RPC error", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "rpc failed" } as unknown as null,
    });
    await expect(claimInviteCode("CODE-1", "user-1")).rejects.toThrow(
      "rpc failed",
    );
  });
});
