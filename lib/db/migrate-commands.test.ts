import { describe, expect, it } from "vitest";
import {
  assertCiSafeDbCommands,
  buildApplyMigrationsCommand,
  buildLocalResetCommand,
  findUnsafeDbCommands,
  isAllowedRemoteMigrateCommand,
} from "@/lib/db/migrate-commands";

describe("migrate-commands builders", () => {
  it("builds additive apply commands per target", () => {
    expect(buildApplyMigrationsCommand("linked")).toBe(
      "npx supabase db push --linked --yes",
    );
    expect(buildApplyMigrationsCommand("local")).toBe(
      "npx supabase migration up --local --yes",
    );
  });

  it("builds the local reset command", () => {
    expect(buildLocalResetCommand()).toBe("npx supabase db reset --local --yes");
  });
});

describe("findUnsafeDbCommands", () => {
  it("flags db reset --linked", () => {
    const violations = findUnsafeDbCommands("npx supabase db reset --linked --yes");
    expect(violations.some((v) => v.includes("db reset --linked"))).toBe(true);
  });

  it("flags db reset without --local", () => {
    const violations = findUnsafeDbCommands("supabase db reset");
    expect(violations.some((v) => v.includes("without --local"))).toBe(true);
  });

  it("allows db reset --local", () => {
    expect(findUnsafeDbCommands(buildLocalResetCommand())).toEqual([]);
  });

  it("flags local-only scripts in CI (provision:local, db:reset:local)", () => {
    const violations = findUnsafeDbCommands(
      "npm run provision:local\nnpm run db:reset:local",
    );
    expect(violations).toHaveLength(2);
  });

  it("ignores comments and blank lines", () => {
    expect(
      findUnsafeDbCommands("# npm run db:reset:local\n\n  # commented out"),
    ).toEqual([]);
  });
});

describe("assertCiSafeDbCommands", () => {
  it("throws on unsafe commands", () => {
    expect(() =>
      assertCiSafeDbCommands("supabase db reset --linked", "deploy.yml"),
    ).toThrow(/unsafe database commands/);
  });

  it("passes for safe commands", () => {
    expect(() =>
      assertCiSafeDbCommands("npm run db:migrate:remote", "deploy.yml"),
    ).not.toThrow();
  });
});

describe("isAllowedRemoteMigrateCommand", () => {
  it("allows the canonical linked push command", () => {
    expect(isAllowedRemoteMigrateCommand(buildApplyMigrationsCommand("linked"))).toBe(
      true,
    );
  });

  it("allows the legacy linked migration-up command", () => {
    expect(
      isAllowedRemoteMigrateCommand("npx supabase migration up --linked --yes"),
    ).toBe(true);
  });

  it("rejects a linked reset", () => {
    expect(isAllowedRemoteMigrateCommand("npx supabase db reset --linked")).toBe(
      false,
    );
  });
});
