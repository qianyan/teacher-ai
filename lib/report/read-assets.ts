import { readFileSync } from "fs";
import { join } from "path";

const ASSETS = join(process.cwd(), "lib", "report", "assets");

export function readSkillMd(): string {
  return readFileSync(join(ASSETS, "SKILL.md"), "utf-8");
}

export function readReferenceShell(): string {
  return readFileSync(join(ASSETS, "reference-shell.html"), "utf-8");
}

export function readReferenceFooter(): string {
  return readFileSync(join(ASSETS, "reference-footer.html"), "utf-8");
}
