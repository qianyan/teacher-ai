import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildApplyMigrationsCommand,
  buildLocalResetCommand,
  type DbMigrateTarget,
} from "../lib/db/migrate-commands";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage(): string {
  return [
    "Usage: tsx scripts/migrate-db.ts --target <local|linked> [--reset]",
    "",
    "  local   Apply pending migrations to local Supabase (additive, no data wipe)",
    "  linked  Push pending migrations to linked remote Supabase (additive only)",
    "",
    "  --reset  LOCAL ONLY — drop and recreate the local database (never use in CI)",
    "",
    "Examples:",
    "  npm run db:migrate:local",
    "  npm run db:migrate:remote",
    "  npm run db:reset:local",
  ].join("\n");
}

function parseArgs(argv: string[]): {
  target: DbMigrateTarget;
  reset: boolean;
} {
  let target: DbMigrateTarget | null = null;
  let reset = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--target") {
      if (next !== "local" && next !== "linked") {
        throw new Error(`Invalid --target value.\n\n${usage()}`);
      }
      target = next;
      i += 1;
      continue;
    }

    if (arg === "--reset") {
      reset = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
  }

  if (!target) {
    throw new Error(`Missing --target.\n\n${usage()}`);
  }

  if (reset && target !== "local") {
    throw new Error(
      "db reset is only allowed for --target local. Remote/linked databases must use additive migrations (db push / migration up).",
    );
  }

  if (process.env.CI === "true" && reset) {
    throw new Error(
      "Refusing to reset the database in CI. Use db:migrate:local or db:migrate:remote instead.",
    );
  }

  return { target, reset };
}

function run(command: string): void {
  console.log(`> ${command}`);
  execSync(command, { cwd: ROOT, stdio: "inherit" });
}

function main(): void {
  const { target, reset } = parseArgs(process.argv.slice(2));

  if (reset) {
    console.log("Resetting local database (all local data will be dropped)...");
    run(buildLocalResetCommand());
    return;
  }

  console.log(
    target === "linked"
      ? "Applying pending migrations to linked Supabase (additive only)..."
      : "Applying pending migrations to local Supabase (additive only)...",
  );
  run(buildApplyMigrationsCommand(target));
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}
