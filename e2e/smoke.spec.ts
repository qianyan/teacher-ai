import { expect, test } from "@playwright/test";

// API-level smoke check that the server answers for public routes.
test("GET /login responds with 200", async ({ request }) => {
  const res = await request.get("/login");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain("托班周报");
});
