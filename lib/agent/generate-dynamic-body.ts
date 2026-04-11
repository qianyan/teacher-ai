import { createLlmClient } from "@/lib/llm";
import type { ChatMessage, ToolDefinition } from "@/lib/llm/types";
import { SKILL_TOOL_DEFINITIONS, executeSkillTool } from "@/lib/agent/skill-tools";

const MAX_TOOL_ITERATIONS = 24;

function buildSystemPrompt(): string {
  return `You are an expert assistant that outputs HTML for a Chinese toddler class biweekly newsletter (托班两周周报).

You MUST follow the project SKILL (use tools to read get_skill_instructions and templates when needed).

Your final output must be ONLY the dynamic middle of the page:
- One or more <div class="section" style="background: ...">...</div> blocks (alternating backgrounds: first section uses background: var(--color-bg); then #fff and var(--color-bg) alternating).
- Then one <div class="tips-section">...</div> with .tips-title, .tips-grid / .tip-card, and .closing-section as appropriate.

Do NOT include the page header (already fixed in reference-shell). Do NOT include <!DOCTYPE>, <html>, <head>, or the newsletter hero header.

Photo images: use empty img tags with attribute data-report-photo="PREFIX:INDEX" where PREFIX matches the section's photo_prefix and INDEX is the numeric index (e.g. data-report-photo="探究:1"). Never add .photo-label. Use .photo-grid with grid-3 for 6 photos, grid-4 for 8 photos, following SKILL rules.

Section titles: use class section-title (red). tips title: class tips-title (red). Do NOT prefix titles with Chinese ordinals like 一、二、.

When you have finished and no more tool calls are needed, output the HTML fragment as plain text (optionally wrapped in a single \`\`\`html code fence).`;
}

export type GenerateInput = {
  biweeklyDateRange: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  photoLogicalNames: string[];
};

function buildUserPayload(input: GenerateInput): string {
  return JSON.stringify(
    {
      biweeklyDateRange: input.biweeklyDateRange,
      subTitle: input.subTitle,
      introHtml: input.introHtml,
      bodyHtml: input.bodyHtml,
      photoLogicalNames: input.photoLogicalNames,
    },
    null,
    2,
  );
}

export function extractHtmlFragment(text: string): string {
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const t = text.trim();
  if (t.startsWith("<")) return t;
  return t;
}

export async function generateDynamicBodyHtml(
  input: GenerateInput,
): Promise<string> {
  const client = createLlmClient();
  const tools: ToolDefinition[] = SKILL_TOOL_DEFINITIONS;

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    {
      role: "user",
      content: `Generate the dynamic HTML fragment.\n\nContext (JSON):\n${buildUserPayload(input)}\n\nCall tools if you need the full SKILL or reference HTML. Then output only the fragment.`,
    },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await client.complete({ messages, tools });
    const msg = res.message;

    if (msg.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: msg.content,
        tool_calls: msg.tool_calls,
      });
      for (const tc of msg.tool_calls) {
        const name = tc.function.name;
        const result = await executeSkillTool(name);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue;
    }

    const text = msg.content || "";
    if (!text.trim()) {
      throw new Error("Model returned empty content");
    }
    return extractHtmlFragment(text);
  }

  throw new Error("Tool loop exceeded max iterations");
}
