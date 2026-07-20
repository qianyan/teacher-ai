import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QuotaExceededError,
  getFreeTierMonthlyGenerations,
} from "@/lib/server/entitlements";

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
