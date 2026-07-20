import { describe, expect, it } from "vitest";
import { validateEnvironment } from "@/lib/env/schema";

function baseEnv(): Record<string, string> {
  return {
    LLM_PROVIDER: "openai_compatible",
    LLM_API_KEY: "test-key",
    LLM_MODEL: "gpt-4o-mini",
    REPORT_GENERATE_MAX_TOKENS: "8192",
  };
}

function errorNames(result: ReturnType<typeof validateEnvironment>): string[] {
  return result.errors.map((e) => e.name);
}

describe("validateEnvironment", () => {
  it("accepts a minimal valid local env", () => {
    const result = validateEnvironment(baseEnv(), "local");
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts any OpenAI-compatible key variant", () => {
    for (const key of [
      "OPENAI_API_KEY",
      "DASHSCOPE_API_KEY",
      "ZHIPUAI_API_KEY",
      "MOONSHOT_API_KEY",
      "MINIMAX_API_KEY",
    ]) {
      const env = { ...baseEnv() };
      delete env.LLM_API_KEY;
      env[key] = "k";
      expect(validateEnvironment(env, "local").ok).toBe(true);
    }
  });

  it("rejects an unknown LLM_PROVIDER", () => {
    const result = validateEnvironment(
      { ...baseEnv(), LLM_PROVIDER: "gemini" },
      "local",
    );
    expect(result.ok).toBe(false);
    expect(errorNames(result)).toContain("LLM_PROVIDER");
  });

  it("requires an Anthropic key when LLM_PROVIDER=anthropic", () => {
    const result = validateEnvironment(
      { LLM_PROVIDER: "anthropic", LLM_MODEL: "claude-sonnet-4-20250514" },
      "production",
    );
    expect(result.ok).toBe(false);
    expect(errorNames(result)).toContain("ANTHROPIC_API_KEY");
  });

  it("accepts anthropic with ANTHROPIC_API_KEY plus Supabase for production", () => {
    const result = validateEnvironment(
      {
        LLM_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "k",
        LLM_MODEL: "claude-sonnet-4-20250514",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      },
      "production",
    );
    expect(result.ok).toBe(true);
  });

  it("requires Supabase keys for preview and production but not local", () => {
    const local = validateEnvironment(baseEnv(), "local");
    expect(local.ok).toBe(true);

    const preview = validateEnvironment(baseEnv(), "preview");
    expect(preview.ok).toBe(false);
    expect(errorNames(preview)).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
      ]),
    );
  });

  it("rejects a malformed NEXT_PUBLIC_SUPABASE_URL", () => {
    const result = validateEnvironment(
      {
        ...baseEnv(),
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      },
      "preview",
    );
    expect(result.ok).toBe(false);
    expect(errorNames(result)).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("flags a lone E2B_API_KEY as a pair mismatch", () => {
    const result = validateEnvironment(
      { ...baseEnv(), E2B_API_KEY: "e2b_test" },
      "preview",
    );
    expect(result.ok).toBe(false);
    expect(errorNames(result)).toContain("E2B_LONG_SCREENSHOT_TEMPLATE");
  });

  it("accepts a fully configured E2B pair", () => {
    const result = validateEnvironment(
      {
        ...baseEnv(),
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        E2B_API_KEY: "e2b_test",
        E2B_LONG_SCREENSHOT_TEMPLATE: "teacher-ai-long-screenshot",
      },
      "preview",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a non-positive REPORT_GENERATE_MAX_TOKENS", () => {
    const result = validateEnvironment(
      { ...baseEnv(), REPORT_GENERATE_MAX_TOKENS: "0" },
      "local",
    );
    expect(result.ok).toBe(false);
    expect(errorNames(result)).toContain("REPORT_GENERATE_MAX_TOKENS");
  });

  it("allows an unset REPORT_GENERATE_MAX_TOKENS", () => {
    const env = { ...baseEnv() };
    delete env.REPORT_GENERATE_MAX_TOKENS;
    expect(validateEnvironment(env, "local").ok).toBe(true);
  });
});
