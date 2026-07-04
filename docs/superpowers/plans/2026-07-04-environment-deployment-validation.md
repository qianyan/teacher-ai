# Environment Deployment Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add executable environment validation for `local`, `preview`, and `production` deployments.

**Architecture:** A pure validator in `lib/env/schema.ts` owns environment variable rules and returns structured errors and warnings. A Node CLI in `scripts/validate-env.ts` loads `.env.local` for local validation, reads deployment environment variables for preview/production, prints a redacted report, and exits non-zero on errors.

**Tech Stack:** Next.js 15, TypeScript, `tsx`, Node `assert`, existing `dotenv`.

---

## File Structure

- Create `lib/env/schema.ts`: environment target types, variable metadata, and validation functions.
- Create `scripts/validate-env.ts`: command-line wrapper around the validator.
- Create `scripts/validate-env.test.ts`: focused tests for validator behavior.
- Modify `package.json`: add environment validation and test scripts.
- Modify `.env.example`: document target-specific validation commands and deployment expectations.

### Task 1: Validator Tests

**Files:**
- Create: `scripts/validate-env.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add a test script**

Add this script to `package.json`:

```json
"test:env": "tsx scripts/validate-env.test.ts"
```

- [ ] **Step 2: Write the failing tests**

Create `scripts/validate-env.test.ts` with Node `assert` tests importing `validateEnvironment` from `../lib/env/schema`.

The tests must cover:

```ts
import assert from "node:assert/strict";
import { validateEnvironment } from "../lib/env/schema";

function baseEnv(): Record<string, string> {
  return {
    LLM_PROVIDER: "openai_compatible",
    LLM_API_KEY: "test-key",
    LLM_MODEL: "gpt-4o-mini",
    REPORT_GENERATE_MAX_TOKENS: "8192",
  };
}

function messages(result: ReturnType<typeof validateEnvironment>): string[] {
  return result.errors.map((error) => error.message);
}

{
  const result = validateEnvironment(baseEnv(), "local");
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
}

{
  const result = validateEnvironment(baseEnv(), "production");
  assert.equal(result.ok, false);
  assert(messages(result).some((message) => message.includes("NEXT_PUBLIC_SUPABASE_URL")));
  assert(messages(result).some((message) => message.includes("SUPABASE_SERVICE_ROLE_KEY")));
}

{
  const result = validateEnvironment(
    { ...baseEnv(), E2B_API_KEY: "e2b_test" },
    "preview",
  );
  assert.equal(result.ok, false);
  assert(messages(result).some((message) => message.includes("E2B_LONG_SCREENSHOT_TEMPLATE")));
}

{
  const result = validateEnvironment(
    {
      ...baseEnv(),
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_ORIGIN: "http://localhost:3000",
    },
    "production",
  );
  assert.equal(result.ok, false);
  assert(messages(result).some((message) => message.includes("WEBAUTHN_RP_ID")));
  assert(messages(result).some((message) => message.includes("https")));
}

{
  const result = validateEnvironment(
    {
      LLM_PROVIDER: "anthropic",
      LLM_MODEL: "claude-sonnet-4-20250514",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      WEBAUTHN_RP_ID: "teacher.example.com",
      WEBAUTHN_ORIGIN: "https://teacher.example.com",
    },
    "production",
  );
  assert.equal(result.ok, false);
  assert(messages(result).some((message) => message.includes("ANTHROPIC_API_KEY")));
}

console.log("Environment validator tests passed");
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:env`

Expected: FAIL because `../lib/env/schema` does not exist.

### Task 2: Pure Environment Validator

**Files:**
- Create: `lib/env/schema.ts`
- Test: `scripts/validate-env.test.ts`

- [ ] **Step 1: Implement minimal validator**

Create `lib/env/schema.ts` with:

- `DeploymentTarget = "local" | "preview" | "production"`
- `validateEnvironment(env, target)`
- provider-specific LLM checks
- numeric max token check
- Supabase required checks for preview/production
- production WebAuthn checks
- paired E2B checks

- [ ] **Step 2: Run validator tests**

Run: `npm run test:env`

Expected: PASS and prints `Environment validator tests passed`.

### Task 3: CLI Entrypoint

**Files:**
- Create: `scripts/validate-env.ts`
- Modify: `package.json`

- [ ] **Step 1: Add CLI scripts**

Add these scripts to `package.json`:

```json
"env:validate": "tsx scripts/validate-env.ts",
"env:validate:local": "tsx scripts/validate-env.ts --target local --env-file .env.local",
"env:validate:preview": "tsx scripts/validate-env.ts --target preview",
"env:validate:production": "tsx scripts/validate-env.ts --target production"
```

- [ ] **Step 2: Implement CLI**

Create `scripts/validate-env.ts` that parses `--target` and optional `--env-file`, loads the env file with `dotenv.config`, calls `validateEnvironment`, prints warnings and errors without secret values, and exits with code `1` when validation fails.

- [ ] **Step 3: Verify CLI local path**

Run: `npm run env:validate:local`

Expected: exit `0` when the local env has required LLM credentials, or exit `1` with redacted missing-variable messages if local credentials are absent.

### Task 4: Documentation Sync

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update `.env.example`**

Add a short section near the top:

```env
# Validate environment files before deploying:
#   npm run env:validate:local
#   npm run env:validate:preview
#   npm run env:validate:production
```

Clarify that Supabase and WebAuthn are optional locally but required for preview/production, and production WebAuthn origins must be HTTPS.

- [ ] **Step 2: Run validation and build checks**

Run:

```bash
npm run test:env
npm run env:validate:local
npm run build
```

Expected: validator tests pass. Local env validation reflects the current `.env.local`. Build exits `0`.

## Self-Review

- Spec coverage: all design components map to Tasks 1-4.
- Placeholder scan: no `TBD`, `TODO`, or vague implementation steps remain.
- Type consistency: plan consistently uses `DeploymentTarget`, `validateEnvironment`, and `scripts/validate-env.test.ts`.
