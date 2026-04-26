import type { ToolDefinition } from "@/lib/llm/types";
import {
  readReferenceShell,
  readSkillMd,
} from "@/lib/report/read-assets";

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
        "Load reference-shell.html (locked head, CSS, header). Use to match section/tips markup and classes.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

export async function executeSkillTool(name: string): Promise<string> {
  switch (name) {
    case "get_skill_instructions":
      return readSkillMd();
    case "get_newsletter_template_html":
      return readReferenceShell();
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
