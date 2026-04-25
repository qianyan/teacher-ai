import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatMessage,
  CompleteResult,
  LlmClient,
  ToolCall,
  ToolDefinition,
} from "./types";

function getGenerateMaxTokens(): number {
  const n = parseInt(process.env.REPORT_GENERATE_MAX_TOKENS || "3072", 10);
  if (!Number.isFinite(n) || n < 256) return 3072;
  return n;
}

function getLlmTimeoutMs(): number {
  const n = parseInt(process.env.REPORT_LLM_REQUEST_TIMEOUT_MS || "25000", 10);
  if (!Number.isFinite(n) || n < 1000) return 25000;
  return n;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function toAnthropicMessages(
  messages: ChatMessage[],
): Anthropic.Messages.MessageParam[] {
  const out: Anthropic.Messages.MessageParam[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "system") continue;
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const blocks: Anthropic.Messages.ContentBlockParam[] = [];
      if (m.content) {
        blocks.push({ type: "text", text: m.content });
      }
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(tc.function.arguments || "{}") as Record<
              string,
              unknown
            >;
          } catch {
            input = {};
          }
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
      }
      out.push({ role: "assistant", content: blocks });
    } else if (m.role === "tool") {
      const results: Anthropic.Messages.ToolResultBlockParam[] = [];
      let j = i;
      while (j < messages.length && messages[j].role === "tool") {
        const t = messages[j] as Extract<ChatMessage, { role: "tool" }>;
        results.push({
          type: "tool_result",
          tool_use_id: t.tool_call_id,
          content: t.content,
        });
        j++;
      }
      i = j - 1;
      out.push({ role: "user", content: results });
    }
  }
  return out;
}

function extractSystem(messages: ChatMessage[]): string | undefined {
  const s = messages.find((m) => m.role === "system");
  return s && s.role === "system" ? s.content : undefined;
}

function toAnthropicTools(
  tools: ToolDefinition[] | undefined,
): Anthropic.Messages.Tool[] {
  if (!tools?.length) return [];
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: {
      type: "object" as const,
      ...(t.function.parameters as object),
    },
  }));
}

export function createAnthropicClient(opts: {
  apiKey: string;
  model: string;
}): LlmClient {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model;

  return {
    async complete({ messages, tools, maxTokens }) {
      const system = extractSystem(messages);
      const anthropicMessages = toAnthropicMessages(messages);

      const timeoutMs = getLlmTimeoutMs();
      const res = await withTimeout(
        client.messages.create({
          model,
          max_tokens: maxTokens ?? getGenerateMaxTokens(),
          system,
          messages: anthropicMessages,
          tools: toAnthropicTools(tools),
        }),
        timeoutMs,
        "LLM request",
      );

      const textParts: string[] = [];
      const toolCalls: ToolCall[] = [];

      for (const block of res.content) {
        if (block.type === "text") {
          textParts.push(block.text);
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {}),
            },
          });
        }
      }

      return {
        message: {
          role: "assistant",
          content: textParts.join("\n") || null,
          tool_calls: toolCalls.length ? toolCalls : undefined,
        },
        finishReason: res.stop_reason,
      };
    },
  };
}
