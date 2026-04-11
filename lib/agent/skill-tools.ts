import type { ToolDefinition } from "@/lib/llm/types";
import {
  readReferenceFooter,
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
      name: "get_reference_shell_html",
      description:
        "Load reference-shell.html (locked head, CSS, header). Use to match section/tips markup and classes.",
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
      name: "get_reference_footer_html",
      description: "Load reference-footer.html (closing footer bar).",
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
      name: "get_long_screenshot_export_note",
      description:
        "How PNG is produced in this app: same as SKILL — scripts/generate-long-screenshot.py (Playwright full-page). Call if the user asks about exporting PNG or parity with the CLI.",
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
    case "get_reference_shell_html":
      return readReferenceShell();
    case "get_reference_footer_html":
      return readReferenceFooter();
    case "get_long_screenshot_export_note":
      return [
        "PNG export in the Teacher AI UI: the browser POSTs self-contained HTML (photos inlined as data URLs) to POST /api/long-screenshot.",
        "The API runs `python3 scripts/generate-long-screenshot.py <tmp/report.html>` (Playwright full-page screenshot; same script as the skill CLI).",
        "Requires on the machine running `next dev` / `next start`: Python 3, `npx`, and Playwright browsers (`npx playwright install` if needed).",
        "CLI equivalent: save HTML to a file, then `python3 scripts/generate-long-screenshot.py path/to/report.html`.",
      ].join("\n");
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
