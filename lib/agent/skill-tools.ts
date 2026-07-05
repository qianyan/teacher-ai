import type { ToolDefinition } from "@/lib/llm/types";
import { readSkillMd, readTemplateShell } from "@/lib/report/read-assets";
import {
  DEFAULT_TEMPLATE_ID,
  resolveTemplateId,
  type ReportTemplateId,
} from "@/lib/report/templates";

export const SKILL_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_skill_instructions",
      description:
        "Load the full toddler biweekly report SKILL.md (rules, grids, photo naming, badge). Call when you need authoritative constraints.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_newsletter_template_html",
      description:
        "Load the theme shell HTML (locked head, CSS, header). Use to match section/tips markup and classes.",
      parameters: {
        type: "object",
        properties: {
          templateId: {
            type: "string",
            enum: ["cream-soft", "ocean-fresh"],
            description:
              "Report theme shell to load. Defaults to cream-soft if omitted.",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

function parseTemplateIdArg(argsJson: string | undefined): ReportTemplateId {
  if (!argsJson) return DEFAULT_TEMPLATE_ID;
  try {
    const parsed = JSON.parse(argsJson) as { templateId?: unknown };
    return resolveTemplateId(parsed.templateId);
  } catch {
    return DEFAULT_TEMPLATE_ID;
  }
}

export async function executeSkillTool(
  name: string,
  argsJson?: string,
): Promise<string> {
  switch (name) {
    case "get_skill_instructions":
      return readSkillMd();
    case "get_newsletter_template_html":
      return readTemplateShell(parseTemplateIdArg(argsJson));
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
