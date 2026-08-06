import { describe, expect, it } from "vitest";
import { GET } from "@/app/health/route";

describe("GET /health", () => {
  it("returns 200 with the expected JSON shape", async () => {
    const response = await GET(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    // Timestamp must be a valid ISO string.
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
