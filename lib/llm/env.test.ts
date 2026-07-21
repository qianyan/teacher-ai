import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAnthropicConfig,
  getLlmProvider,
  getOpenAiCompatibleConfig,
} from "@/lib/llm/env";

const LLM_ENV_KEYS = [
  "LLM_PROVIDER",
  "LLM_API_KEY",
  "OPENAI_API_KEY",
  "DASHSCOPE_API_KEY",
  "ZHIPUAI_API_KEY",
  "MOONSHOT_API_KEY",
  "MINIMAX_API_KEY",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "OPENAI_MODEL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
];

beforeEach(() => {
  for (const key of LLM_ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of LLM_ENV_KEYS) delete process.env[key];
});

describe("getLlmProvider", () => {
  it("defaults to openai_compatible when unset", () => {
    delete process.env.LLM_PROVIDER;
    expect(getLlmProvider()).toBe("openai_compatible");
  });

  it("returns anthropic when configured (case-insensitive)", () => {
    process.env.LLM_PROVIDER = "Anthropic";
    expect(getLlmProvider()).toBe("anthropic");
  });

  it("falls back to openai_compatible for unknown values", () => {
    process.env.LLM_PROVIDER = "gemini";
    expect(getLlmProvider()).toBe("openai_compatible");
  });
});

describe("getOpenAiCompatibleConfig", () => {
  it("reads LLM_API_KEY first", () => {
    process.env.LLM_API_KEY = "primary";
    process.env.OPENAI_API_KEY = "secondary";
    expect(getOpenAiCompatibleConfig().apiKey).toBe("primary");
  });

  it("falls back to provider-specific keys", () => {
    process.env.DASHSCOPE_API_KEY = "dash";
    expect(getOpenAiCompatibleConfig().apiKey).toBe("dash");
  });

  it("returns an empty key when nothing is set", () => {
    expect(getOpenAiCompatibleConfig().apiKey).toBe("");
  });

  it("defaults the model to gpt-4o-mini", () => {
    expect(getOpenAiCompatibleConfig().model).toBe("gpt-4o-mini");
  });

  it("passes through LLM_BASE_URL when set", () => {
    process.env.LLM_BASE_URL = "https://api.example.com/v1";
    expect(getOpenAiCompatibleConfig().baseURL).toBe(
      "https://api.example.com/v1",
    );
  });
});

describe("getAnthropicConfig", () => {
  it("prefers ANTHROPIC_API_KEY then LLM_API_KEY", () => {
    process.env.LLM_API_KEY = "shared";
    expect(getAnthropicConfig().apiKey).toBe("shared");
    process.env.ANTHROPIC_API_KEY = "direct";
    expect(getAnthropicConfig().apiKey).toBe("direct");
  });

  it("defaults the model when unset", () => {
    expect(getAnthropicConfig().model).toBeTruthy();
  });
});
