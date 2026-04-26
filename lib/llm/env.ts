export type LlmProviderKind = "openai_compatible" | "anthropic";

export function getLlmProvider(): LlmProviderKind {
  const p = (process.env.LLM_PROVIDER || "openai_compatible").toLowerCase();
  if (p === "anthropic") return "anthropic";
  return "openai_compatible";
}

export function getOpenAiCompatibleConfig(): {
  apiKey: string;
  baseURL: string | undefined;
  model: string;
} {
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.DASHSCOPE_API_KEY ||
    process.env.ZHIPUAI_API_KEY ||
    process.env.MOONSHOT_API_KEY ||
    process.env.MINIMAX_API_KEY ||
    "";
  const baseURL = process.env.LLM_BASE_URL || undefined;
  const model =
    process.env.LLM_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";
  return { apiKey, baseURL, model };
}

export function getAnthropicConfig(): { baseURL: string | undefined; apiKey: string; model: string } {
  const baseURL = process.env.LLM_BASE_URL || undefined;
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY || "";
  const model = process.env.ANTHROPIC_MODEL || process.env.LLM_MODEL || "deepseek-v4-pro";
  return { baseURL, apiKey, model };
}
