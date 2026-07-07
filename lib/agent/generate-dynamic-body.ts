import { createLlmClient } from "@/lib/llm";
import type { ChatMessage, ToolDefinition } from "@/lib/llm/types";
import { SKILL_TOOL_DEFINITIONS, executeSkillTool } from "@/lib/agent/skill-tools";
import type { ReportTemplateId } from "@/lib/report/templates";
import { getTemplateLayoutProfile } from "@/lib/report/templates/layout-profiles";
import {
  isValidDynamicBodyHtml,
  renderDynamicBodyFromSource,
} from "@/lib/report/render-dynamic-body";

const MAX_AGENT_TURNS = 8;

function buildSystemPrompt(templateId: ReportTemplateId): string {
  const layout = getTemplateLayoutProfile(templateId);
  return `You are an expert assistant that outputs HTML for a Chinese toddler class biweekly newsletter (托班两周周报).

You MUST follow the project SKILL (use tools to read get_skill_instructions and templates when needed).

Active theme: \`${templateId}\` — layout profile: ${layout.layoutName}.

## Layout rules for this theme
${layout.aiLayoutInstructions}

Your final output must be ONLY the dynamic middle of the page:
- One or more section blocks (alternating backgrounds: first section uses background: var(--color-bg); then #fff and var(--color-bg) alternating).
- Then one <div class="tips-section">...</div> with .tips-title, tips grid / .tip-card, and .closing-section as appropriate.

Do NOT include the page header (already fixed in theme shell). Do NOT include <!DOCTYPE>, <html>, <head>, or the newsletter hero header.

Photo images: use empty img tags with attribute data-report-photo="PREFIX:INDEX" where PREFIX matches the section's photo_prefix and INDEX is the numeric index (e.g. data-report-photo="探究:1"). Never add .photo-label. Follow this theme's photo container classes (see layout rules above).

Section titles: use class section-title (primary accent). tips title: class tips-title. Do NOT prefix titles with Chinese ordinals like 一、二、.

When you have finished and no more tool calls are needed, output the HTML fragment as plain text (optionally wrapped in a single \`\`\`html code fence).`;
}

export type GenerateInput = {
  biweeklyDateRange: string;
  englishClassName: string;
  subTitle: string;
  introHtml: string;
  bodyHtml: string;
  photoLogicalNames: string[];
  templateId: ReportTemplateId;
};

function buildUserPayload(input: GenerateInput): string {
  return JSON.stringify(
    {
      biweeklyDateRange: input.biweeklyDateRange,
      englishClassName: input.englishClassName,
      subTitle: input.subTitle,
      introHtml: input.introHtml,
      bodyHtml: input.bodyHtml,
      photoLogicalNames: input.photoLogicalNames,
      templateId: input.templateId,
    },
    null,
    2,
  );
}

export function extractHtmlFragment(text: string): string {
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (fence) {
    const inner = fence[1].trim();
    if (inner) return inner;
  }
  const t = text.trim();
  if (t.startsWith("<")) return t;
  return t;
}

export async function generateDynamicBodyHtml(
  input: GenerateInput,
): Promise<string> {
  const client = createLlmClient();
  const tools: ToolDefinition[] = SKILL_TOOL_DEFINITIONS;
  const toolResultCache = new Map<string, string>();

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(input.templateId) },
    {
      role: "user",
      content: `Generate the dynamic HTML fragment.\n\nContext (JSON):\n${buildUserPayload(input)}\n\nCall tools if you need the full SKILL or reference HTML. Then output only the fragment.`,
    },
  ];

  let llmHtml = "";

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const res = await client.complete({ messages, tools });
    const msg = res.message;
    const toolCalls = msg.tool_calls ?? [];

    if (toolCalls.length) {
      messages.push({
        role: "assistant",
        content: msg.content,
        tool_calls: toolCalls,
      });

      const toolMessages = await Promise.all(
        toolCalls.map(async (tc) => {
          const name = tc.function.name;
          const argsJson = tc.function.arguments;
          const cacheKey = `${name}:${argsJson ?? ""}`;
          const cached = toolResultCache.get(cacheKey);
          const content = cached ?? (await executeSkillTool(name, argsJson));
          if (!cached) {
            toolResultCache.set(cacheKey, content);
          }

          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content,
          };
        }),
      );

      messages.push(...toolMessages);
      continue;
    }

    const text = msg.content || "";
    if (!text.trim()) {
      break;
    }
    llmHtml = extractHtmlFragment(text);
    if (isValidDynamicBodyHtml(llmHtml)) {
      return llmHtml;
    }
    break;
  }

  return renderDynamicBodyFromSource({
    templateId: input.templateId,
    bodyHtml: input.bodyHtml,
    photoLogicalNames: input.photoLogicalNames,
  });
}
