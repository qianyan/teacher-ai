export type DbMigrateTarget = "local" | "linked";

/** Applies pending migrations only — never drops existing rows. */
export function buildApplyMigrationsCommand(target: DbMigrateTarget): string {
  if (target === "linked") {
    return "npx supabase db push --linked --yes";
  }
  return "npx supabase migration up --local --yes";
}

/** Wipes and recreates the local database. Must never run in CI or against linked projects. */
export function buildLocalResetCommand(): string {
  return "npx supabase db reset --local --yes";
}

/** Returns violations found in a shell/YAML command string. */
export function findUnsafeDbCommands(text: string): string[] {
  const violations: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (/\bdb reset\b/.test(trimmed) && /\b--linked\b/.test(trimmed)) {
      violations.push(`db reset --linked is forbidden: ${trimmed}`);
      continue;
    }

    if (/\bdb reset\b/.test(trimmed) && !/--local\b/.test(trimmed)) {
      violations.push(`db reset without --local is forbidden: ${trimmed}`);
    }

    if (/\bprovision:local\b/.test(trimmed) || /\bdb:reset:local\b/.test(trimmed)) {
      violations.push(`local-only database command in CI: ${trimmed}`);
    }
  }

  return violations;
}

export function assertCiSafeDbCommands(text: string, label: string): void {
  const violations = findUnsafeDbCommands(text);
  if (violations.length > 0) {
    throw new Error(
      `${label} contains unsafe database commands:\n${violations.map((v) => `- ${v}`).join("\n")}`,
    );
  }
}

export function isAllowedRemoteMigrateCommand(command: string): boolean {
  const normalized = command.trim();
  return (
    normalized === buildApplyMigrationsCommand("linked") ||
    normalized === "npx supabase migration up --linked --yes"
  );
}
