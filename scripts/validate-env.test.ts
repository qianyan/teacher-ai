import assert from "node:assert/strict";
import { validateEnvironment } from "../lib/env/schema";

function baseEnv(): Record<string, string> {
  return {
    LLM_PROVIDER: "openai_compatible",
    LLM_API_KEY: "test-key",
    LLM_MODEL: "gpt-4o-mini",
    REPORT_GENERATE_MAX_TOKENS: "8192",
  };
}

function messages(result: ReturnType<typeof validateEnvironment>): string[] {
  return result.errors.map((error) => error.message);
}

{
  const result = validateEnvironment(baseEnv(), "local");
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
}

{
  const result = validateEnvironment(baseEnv(), "production");
  assert.equal(result.ok, false);
  assert(
    messages(result).some((message) =>
      message.includes("NEXT_PUBLIC_SUPABASE_URL"),
    ),
  );
  assert(
    messages(result).some((message) =>
      message.includes("SUPABASE_SERVICE_ROLE_KEY"),
    ),
  );
}

{
  const result = validateEnvironment(
    { ...baseEnv(), E2B_API_KEY: "e2b_test" },
    "preview",
  );
  assert.equal(result.ok, false);
  assert(
    messages(result).some((message) =>
      message.includes("E2B_LONG_SCREENSHOT_TEMPLATE"),
    ),
  );
}

{
  const result = validateEnvironment(
    {
      ...baseEnv(),
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      E2B_API_KEY: "",
      E2B_LONG_SCREENSHOT_TEMPLATE: "teacher-ai-long-screenshot",
    },
    "preview",
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
}

{
  const result = validateEnvironment(
    {
      ...baseEnv(),
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_ORIGIN: "http://localhost:3000",
    },
    "production",
  );
  assert.equal(result.ok, false);
  assert(
    messages(result).some((message) => message.includes("WEBAUTHN_RP_ID")),
  );
  assert(messages(result).some((message) => message.includes("https")));
}

{
  const result = validateEnvironment(
    {
      LLM_PROVIDER: "anthropic",
      LLM_MODEL: "claude-sonnet-4-20250514",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      WEBAUTHN_RP_ID: "teacher.example.com",
      WEBAUTHN_ORIGIN: "https://teacher.example.com",
    },
    "production",
  );
  assert.equal(result.ok, false);
  assert(
    messages(result).some((message) => message.includes("ANTHROPIC_API_KEY")),
  );
}

console.log("Environment validator tests passed");
