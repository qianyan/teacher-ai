import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mock the Supabase admin client so quota consumption logic is exercised in
 * isolation (same pattern as lib/server/invite-codes.test.ts).
 */
const mocks = vi.hoisted(() => {
  const state = { deleteError: null as null | { message: string } };
  const rpc = vi.fn();
  const chain: Record<string, unknown> = {};
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ error: state.deleteError });
  const from = vi.fn(() => chain);
  return { state, rpc, chain, from };
});

vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));

import {
  consumeGenerationQuota,
  getFreeTierMonthlyGenerations,
  QuotaExceededError,
  refundGenerationQuota,
} from "@/lib/server/entitlements";

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.from.mockClear();
  (mocks.chain.delete as ReturnType<typeof vi.fn>).mockClear();
  (mocks.chain.eq as ReturnType<typeof vi.fn>).mockClear();
  mocks.state.deleteError = null;
});

afterEach(() => {
  delete process.env.FREE_TIER_MONTHLY_GENERATIONS;
});

describe("getFreeTierMonthlyGenerations", () => {
  it("defaults to 5 when unset", () => {
    delete process.env.FREE_TIER_MONTHLY_GENERATIONS;
    expect(getFreeTierMonthlyGenerations()).toBe(5);
  });

  it("reads a positive integer override", () => {
    process.env.FREE_TIER_MONTHLY_GENERATIONS = "50";
    expect(getFreeTierMonthlyGenerations()).toBe(50);
  });

  it("falls back to 5 for invalid values", () => {
    for (const v of ["0", "-3", "abc", " "]) {
      process.env.FREE_TIER_MONTHLY_GENERATIONS = v;
      expect(getFreeTierMonthlyGenerations()).toBe(5);
    }
  });
});

describe("QuotaExceededError", () => {
  it("carries a 429 status and the limit", () => {
    const err = new QuotaExceededError(5);
    expect(err.status).toBe(429);
    expect(err.limit).toBe(5);
    expect(err.message).toContain("5");
  });
});

describe("consumeGenerationQuota", () => {
  it("calls the atomic RPC with the user id and configured limit", async () => {
    process.env.FREE_TIER_MONTHLY_GENERATIONS = "7";
    mocks.rpc.mockResolvedValue({ data: "event-1", error: null });

    await expect(consumeGenerationQuota("user-1")).resolves.toBe("event-1");
    expect(mocks.rpc).toHaveBeenCalledWith("try_consume_generation", {
      p_user_id: "user-1",
      p_limit: 7,
    });
  });

  it("uses the default limit of 5 when unset", async () => {
    delete process.env.FREE_TIER_MONTHLY_GENERATIONS;
    mocks.rpc.mockResolvedValue({ data: "event-1", error: null });

    await consumeGenerationQuota("user-1");
    expect(mocks.rpc).toHaveBeenCalledWith("try_consume_generation", {
      p_user_id: "user-1",
      p_limit: 5,
    });
  });

  it("throws QuotaExceededError when the RPC reports an exhausted quota", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    const err = await consumeGenerationQuota("user-1").catch((e) => e);
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect((err as QuotaExceededError).limit).toBe(5);
  });

  it("throws on an RPC error", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "rpc failed" },
    });
    await expect(consumeGenerationQuota("user-1")).rejects.toThrow(
      "rpc failed",
    );
  });
});

describe("refundGenerationQuota", () => {
  it("deletes the usage_events row scoped to the user", async () => {
    await expect(
      refundGenerationQuota("user-1", "event-1"),
    ).resolves.toBeUndefined();
    expect(mocks.from).toHaveBeenCalledWith("usage_events");
    expect(mocks.chain.delete).toHaveBeenCalled();
    expect(mocks.chain.eq).toHaveBeenNthCalledWith(1, "id", "event-1");
    expect(mocks.chain.eq).toHaveBeenNthCalledWith(2, "user_id", "user-1");
  });

  it("throws on a delete error", async () => {
    mocks.state.deleteError = { message: "delete failed" };
    await expect(refundGenerationQuota("user-1", "event-1")).rejects.toThrow(
      "delete failed",
    );
  });
});
