import dotenv from "dotenv";
import {
  type DeploymentTarget,
  type EnvValidationIssue,
  validateEnvironment,
} from "../lib/env/schema";

const TARGETS = new Set<DeploymentTarget>(["local", "preview", "production"]);

function usage(): string {
  return [
    "Usage: npm run env:validate -- --target <local|preview|production> [--env-file .env.local]",
    "",
    "Examples:",
    "  npm run env:validate:local",
    "  npm run env:validate -- --target production",
  ].join("\n");
}

function parseArgs(argv: string[]): {
  target: DeploymentTarget;
  envFile: string | null;
} {
  let target: DeploymentTarget = "local";
  let envFile: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--target") {
      if (!next || !TARGETS.has(next as DeploymentTarget)) {
        throw new Error(`Invalid --target value.\n\n${usage()}`);
      }
      target = next as DeploymentTarget;
      i += 1;
      continue;
    }

    if (arg === "--env-file") {
      if (!next) {
        throw new Error(`Missing --env-file value.\n\n${usage()}`);
      }
      envFile = next;
      i += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
  }

  return { target, envFile };
}

function printIssues(label: string, issues: EnvValidationIssue[]): void {
  if (issues.length === 0) return;

  console.log(`\n${label}:`);
  for (const item of issues) {
    console.log(`- ${item.name}: ${item.message}`);
  }
}

function main(): void {
  const { target, envFile } = parseArgs(process.argv.slice(2));

  if (envFile) {
    const result = dotenv.config({ path: envFile });
    if (result.error) {
      throw new Error(`Could not load ${envFile}: ${result.error.message}`);
    }
  }

  const result = validateEnvironment(process.env, target);
  const source = envFile ? ` from ${envFile}` : "";

  console.log(`Environment validation: ${target}${source}`);
  printIssues("Warnings", result.warnings);
  printIssues("Errors", result.errors);

  if (!result.ok) {
    console.error(`\nEnvironment validation failed for ${target}.`);
    process.exit(1);
  }

  console.log(`Environment validation passed for ${target}.`);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}
