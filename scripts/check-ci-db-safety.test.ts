import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCiSafeDbCommands,
  buildApplyMigrationsCommand,
  buildLocalResetCommand,
  findUnsafeDbCommands,
  isAllowedRemoteMigrateCommand,
} from "../lib/db/migrate-commands";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

{
  assert.equal(
    buildApplyMigrationsCommand("linked"),
    "npx supabase db push --linked --yes",
  );
  assert.equal(
    buildApplyMigrationsCommand("local"),
    "npx supabase migration up --local --yes",
  );
  assert.equal(
    buildLocalResetCommand(),
    "npx supabase db reset --local --yes",
  );
  assert.equal(isAllowedRemoteMigrateCommand(buildApplyMigrationsCommand("linked")), true);
  assert.equal(isAllowedRemoteMigrateCommand("npx supabase db reset --linked"), false);
}

{
  const unsafe = findUnsafeDbCommands(
    "npx supabase db reset --linked --yes\nnpm run db:migrate:remote",
  );
  assert.ok(unsafe.some((line) => line.includes("db reset --linked")));
  assert.equal(findUnsafeDbCommands("npx supabase db reset --local --yes").length, 0);
  assert.equal(findUnsafeDbCommands("npm run db:migrate:remote").length, 0);
}

{
  const workflowsDir = join(ROOT, ".github", "workflows");
  for (const file of readdirSync(workflowsDir)) {
    if (!file.endsWith(".yml") && !file.endsWith(".yaml")) {
      continue;
    }
    const content = readFileSync(join(workflowsDir, file), "utf8");
    assertCiSafeDbCommands(content, `.github/workflows/${file}`);
  }
}

{
  const packageJson = readFileSync(join(ROOT, "package.json"), "utf8");
  const ciScripts = packageJson
    .split("\n")
    .filter((line) =>
      /"(prepare:preview|prepare:production|verify:preview|verify:production|deploy:preview|deploy:production|test:env|test:ci-db-safety)"/.test(
        line,
      ),
    )
    .join("\n");
  assertCiSafeDbCommands(ciScripts, "package.json CI-related scripts");
}

console.log("CI database safety checks passed");
