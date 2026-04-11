import OpenAI from "openai";
import type {
  ChatMessage,
  CompleteResult,
  LlmClient,
  ToolCall,
  ToolDefinition,
} from "./types";

function toOpenAiMessages(
  messages: ChatMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      out.push({ role: "system", content: m.content });
    } else if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const a: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
        role: "assistant",
        content: m.content,
      };
      if (m.tool_calls?.length) {
        a.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }
      out.push(a);
    } else if (m.role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: m.tool_call_id,
        content: m.content,
      });
    }
  }
  return out;
}

function fromAssistantMessage(
  msg: OpenAI.Chat.Completions.ChatCompletionMessage,
): CompleteResult {
  const tool_calls: ToolCall[] | undefined = msg.tool_calls?.map((tc) => ({
    id: tc.id,
    type: "function" as const,
    function: {
      name: tc.function!.name,
      arguments: tc.function!.arguments || "{}",
    },
  }));
  return {
    message: {
      role: "assistant",
      content: msg.content,
      tool_calls,
    },
    finishReason: null,
  };
}

export function createOpenAiCompatibleClient(opts: {
  apiKey: string;
  baseURL?: string;
  model: string;
}): LlmClient {
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
  });
  const model = opts.model;

  return {
    async complete({ messages, tools, maxTokens }) {
      const envMax = parseInt(process.env.REPORT_GENERATE_MAX_TOKENS || "8192", 10);
      const res = await client.chat.completions.create({
        model,
        messages: toOpenAiMessages(messages),
        tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
        max_tokens: maxTokens ?? (Number.isFinite(envMax) ? envMax : 8192),
      });
      const choice = res.choices?.[0];
      if (!choice?.message) {
        throw new Error(
          "No assistant message from provider (missing or empty choices). Check LLM base URL, model name, and that the API returns OpenAI-compatible chat completions.",
        );
      }
      const r = fromAssistantMessage(choice.message);
      r.finishReason = choice.finish_reason;
      return r;
    },
  };
}
