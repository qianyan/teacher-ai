import { createAnthropicClient } from "./anthropic-adapter";
import { getAnthropicConfig, getLlmProvider, getOpenAiCompatibleConfig } from "./env";
import { createOpenAiCompatibleClient } from "./openai-compatible";
import type { LlmClient } from "./types";

export type { ChatMessage, LlmClient, ToolDefinition } from "./types";

export function createLlmClient(): LlmClient {
  const provider = getLlmProvider();
  if (provider === "anthropic") {
    const { baseURL, apiKey, model } = getAnthropicConfig();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
    }
    return createAnthropicClient({ baseURL, apiKey, model });
  }
  const { apiKey, baseURL, model } = getOpenAiCompatibleConfig();
  if (!apiKey) {
    throw new Error(
      "Set LLM_API_KEY or OPENAI_API_KEY (or a provider-specific key) for openai_compatible",
    );
  }
  return createOpenAiCompatibleClient({ apiKey, baseURL, model, enableThinking: false});
}
