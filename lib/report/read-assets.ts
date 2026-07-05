import { readFileSync } from "fs";
import { join } from "path";
import {
  DEFAULT_TEMPLATE_ID,
  type ReportTemplateId,
} from "@/lib/report/templates";

const ASSETS = join(process.cwd(), "lib", "report", "assets");
const TEMPLATES = join(process.cwd(), "lib", "report", "templates");

export function readSkillMd(): string {
  return readFileSync(join(ASSETS, "SKILL.md"), "utf-8");
}

export function readTemplateShell(templateId: ReportTemplateId): string {
  return readFileSync(join(TEMPLATES, templateId, "shell.html"), "utf-8");
}

/** @deprecated Use readTemplateShell(templateId) */
export function readReferenceShell(): string {
  return readTemplateShell(DEFAULT_TEMPLATE_ID);
}

export function readReferenceFooter(): string {
  return readFileSync(join(ASSETS, "reference-footer.html"), "utf-8");
}
