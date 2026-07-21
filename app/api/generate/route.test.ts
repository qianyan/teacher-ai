import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level tests for POST /api/generate quota enforcement (issue #15).
 * The route must consume one quota slot atomically BEFORE generation and
 * refund it when generation fails.
 */
const mocks = vi.hoisted(() => {
  const getUser = vi.fn();
  const consumeGenerationQuota = vi.fn();
  const refundGenerationQuota = vi.fn();
  const generateDynamicBodyHtml = vi.fn();
  return {
    getUser,
    consumeGenerationQuota,
    refundGenerationQuota,
    generateDynamicBodyHtml,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: () => mocks.getUser() },
  }),
}));

vi.mock("@/lib/server/entitlements", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/entitlements")>();
  return {
    ...actual,
    consumeGenerationQuota: (userId: string) =>
      mocks.consumeGenerationQuota(userId),
    refundGenerationQuota: (userId: string, eventId: string) =>
      mocks.refundGenerationQuota(userId, eventId),
  };
});

vi.mock("@/lib/agent/generate-dynamic-body", () => ({
  generateDynamicBodyHtml: (args: unknown) =>
    mocks.generateDynamicBodyHtml(args),
}));

import { QuotaExceededError } from "@/lib/server/entitlements";
import { POST } from "@/app/api/generate/route";

const USER = { id: "user-1" };

function authed() {
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validBody() {
  return {
    biweeklyDateRange: "2026-07-06 ~ 2026-07-17",
    englishClassName: "Mama Love",
    subTitle: "sub",
    introHtml: "<p>intro</p>",
    bodyHtml: "<p>body</p>",
    photoLogicalNames: [],
  };
}

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.consumeGenerationQuota.mockReset();
  mocks.refundGenerationQuota.mockReset();
  mocks.generateDynamicBodyHtml.mockReset();
  mocks.refundGenerationQuota.mockResolvedValue(undefined);
  mocks.generateDynamicBodyHtml.mockResolvedValue("<p>generated</p>");
});

describe("POST /api/generate — quota enforcement", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(jsonRequest(validBody()));
    expect(res.status).toBe(401);
    expect(mocks.consumeGenerationQuota).not.toHaveBeenCalled();
  });

  it("returns 429 with quota_exceeded when the quota is exhausted", async () => {
    authed();
    mocks.consumeGenerationQuota.mockRejectedValue(new QuotaExceededError(5));

    const res = await POST(jsonRequest(validBody()));
    expect(res.status).toBe(429);
    const body = (await res.json()) as { code?: string; limit?: number };
    expect(body.code).toBe("quota_exceeded");
    expect(body.limit).toBe(5);
    // The LLM must never run once the quota slot could not be consumed.
    expect(mocks.generateDynamicBodyHtml).not.toHaveBeenCalled();
  });

  it("consumes quota before generating and does not refund on success", async () => {
    authed();
    mocks.consumeGenerationQuota.mockResolvedValue("event-1");

    const res = await POST(jsonRequest(validBody()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      dynamicBodyHtml?: string;
      fullHtml?: string;
    };
    expect(body.dynamicBodyHtml).toBe("<p>generated</p>");
    expect(typeof body.fullHtml).toBe("string");

    expect(mocks.consumeGenerationQuota).toHaveBeenCalledWith("user-1");
    // Consume must happen strictly before generation (no check-then-act gap).
    expect(
      mocks.consumeGenerationQuota.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.generateDynamicBodyHtml.mock.invocationCallOrder[0]);
    // Usage is recorded exactly once (inside consume), never refunded.
    expect(mocks.refundGenerationQuota).not.toHaveBeenCalled();
  });

  it("refunds the consumed slot when generation fails", async () => {
    authed();
    mocks.consumeGenerationQuota.mockResolvedValue("event-1");
    mocks.generateDynamicBodyHtml.mockRejectedValue(new Error("LLM down"));

    const res = await POST(jsonRequest(validBody()));
    expect(res.status).toBe(500);
    expect(mocks.refundGenerationQuota).toHaveBeenCalledWith(
      "user-1",
      "event-1",
    );
  });

  it("still returns 500 when both generation and refund fail", async () => {
    authed();
    mocks.consumeGenerationQuota.mockResolvedValue("event-1");
    mocks.generateDynamicBodyHtml.mockRejectedValue(new Error("LLM down"));
    mocks.refundGenerationQuota.mockRejectedValue(new Error("delete failed"));

    const res = await POST(jsonRequest(validBody()));
    expect(res.status).toBe(500);
    expect(mocks.refundGenerationQuota).toHaveBeenCalledWith(
      "user-1",
      "event-1",
    );
  });

  it("regression #15: concurrent requests cannot exceed the remaining quota", async () => {
    authed();
    // Simulate the DB-side atomic consume: synchronous check-and-insert, so
    // only one of two parallel requests can grab the last remaining slot.
    let used = 4;
    const limit = 5;
    mocks.consumeGenerationQuota.mockImplementation(async () => {
      if (used >= limit) throw new QuotaExceededError(limit);
      used += 1;
      return `event-${used}`;
    });
    // Slow generation so both requests are in flight at once.
    mocks.generateDynamicBodyHtml.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve("<p>generated</p>"), 50),
        ),
    );

    const [resA, resB] = await Promise.all([
      POST(jsonRequest(validBody())),
      POST(jsonRequest(validBody())),
    ]);
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 429]);
    expect(mocks.generateDynamicBodyHtml).toHaveBeenCalledTimes(1);
    // No refund: the single successful generation keeps its slot.
    expect(mocks.refundGenerationQuota).not.toHaveBeenCalled();
  });
});
