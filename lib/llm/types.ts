export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export type CompleteResult = {
  message: ChatMessage & { role: "assistant" };
  finishReason: string | null;
};

export interface LlmClient {
  complete(params: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    maxTokens?: number;
  }): Promise<CompleteResult>;
}
