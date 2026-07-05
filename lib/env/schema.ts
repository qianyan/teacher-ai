export type DeploymentTarget = "local" | "preview" | "production";

export type EnvValidationSeverity = "error" | "warning";

export type EnvValidationIssue = {
  severity: EnvValidationSeverity;
  name: string;
  message: string;
};

export type EnvValidationResult = {
  ok: boolean;
  target: DeploymentTarget;
  errors: EnvValidationIssue[];
  warnings: EnvValidationIssue[];
};

type EnvRecord = Record<string, string | undefined>;

const OPENAI_COMPATIBLE_KEYS = [
  "LLM_API_KEY",
  "OPENAI_API_KEY",
  "DASHSCOPE_API_KEY",
  "ZHIPUAI_API_KEY",
  "MOONSHOT_API_KEY",
  "MINIMAX_API_KEY",
] as const;

const STRICT_TARGETS = new Set<DeploymentTarget>(["preview", "production"]);

function read(env: EnvRecord, name: string): string {
  return env[name]?.trim() ?? "";
}

function has(env: EnvRecord, name: string): boolean {
  return read(env, name).length > 0;
}

function isDefined(env: EnvRecord, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(env, name);
}

function validateE2bPair(env: EnvRecord, errors: EnvValidationIssue[]): void {
  const apiDefined = isDefined(env, "E2B_API_KEY");
  const templateDefined = isDefined(env, "E2B_LONG_SCREENSHOT_TEMPLATE");

  if (apiDefined !== templateDefined) {
    const missing = apiDefined ? "E2B_LONG_SCREENSHOT_TEMPLATE" : "E2B_API_KEY";
    errors.push(
      issue(
        missing,
        `${missing} is missing from the environment. Configure both E2B variables in Vercel, or remove both.`,
      ),
    );
    return;
  }

  if (!apiDefined) {
    return;
  }

  const apiHasValue = has(env, "E2B_API_KEY");
  const templateHasValue = has(env, "E2B_LONG_SCREENSHOT_TEMPLATE");

  if (apiHasValue === templateHasValue) {
    return;
  }

  // Vercel "Sensitive" variables are redacted to empty strings by `vercel pull`.
  if ((apiHasValue && templateDefined) || (templateHasValue && apiDefined)) {
    return;
  }

  errors.push(
    issue(
      "E2B_API_KEY",
      "E2B_API_KEY and E2B_LONG_SCREENSHOT_TEMPLATE must be set together.",
    ),
  );
}

function issue(name: string, message: string): EnvValidationIssue {
  return { severity: "error", name, message };
}

function warning(name: string, message: string): EnvValidationIssue {
  return { severity: "warning", name, message };
}

function hasAny(env: EnvRecord, names: readonly string[]): boolean {
  return names.some((name) => has(env, name));
}

function validateUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateHttpsOriginList(value: string): boolean {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .every((origin) => {
      try {
        return new URL(origin).protocol === "https:";
      } catch {
        return false;
      }
    });
}

export function validateEnvironment(
  env: EnvRecord,
  target: DeploymentTarget,
): EnvValidationResult {
  const errors: EnvValidationIssue[] = [];
  const warnings: EnvValidationIssue[] = [];
  const provider = read(env, "LLM_PROVIDER") || "openai_compatible";

  if (provider !== "openai_compatible" && provider !== "anthropic") {
    errors.push(
      issue(
        "LLM_PROVIDER",
        "LLM_PROVIDER must be either openai_compatible or anthropic.",
      ),
    );
  }

  if (provider === "anthropic") {
    if (!hasAny(env, ["ANTHROPIC_API_KEY", "LLM_API_KEY"])) {
      errors.push(
        issue(
          "ANTHROPIC_API_KEY",
          "ANTHROPIC_API_KEY or LLM_API_KEY is required when LLM_PROVIDER=anthropic.",
        ),
      );
    }
  } else if (!hasAny(env, OPENAI_COMPATIBLE_KEYS)) {
    errors.push(
      issue(
        "LLM_API_KEY",
        `Set one OpenAI-compatible API key: ${OPENAI_COMPATIBLE_KEYS.join(", ")}.`,
      ),
    );
  }

  const maxTokens = read(env, "REPORT_GENERATE_MAX_TOKENS");
  if (maxTokens && (!/^\d+$/.test(maxTokens) || Number(maxTokens) <= 0)) {
    errors.push(
      issue(
        "REPORT_GENERATE_MAX_TOKENS",
        "REPORT_GENERATE_MAX_TOKENS must be a positive integer when set.",
      ),
    );
  }

  if (STRICT_TARGETS.has(target)) {
    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      if (!has(env, name)) {
        errors.push(issue(name, `${name} is required for ${target} deployments.`));
      }
    }
  }

  const supabaseUrl = read(env, "NEXT_PUBLIC_SUPABASE_URL");
  if (supabaseUrl && !validateUrl(supabaseUrl)) {
    errors.push(
      issue(
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL must be a valid URL.",
      ),
    );
  }

  validateE2bPair(env, errors);

  if (target === "production") {
    const rpID = read(env, "WEBAUTHN_RP_ID");
    const origin = read(env, "WEBAUTHN_ORIGIN");

    if (!rpID || rpID === "localhost") {
      errors.push(
        issue(
          "WEBAUTHN_RP_ID",
          "WEBAUTHN_RP_ID is required for production and must not be localhost.",
        ),
      );
    }

    if (!origin) {
      errors.push(
        issue("WEBAUTHN_ORIGIN", "WEBAUTHN_ORIGIN is required for production."),
      );
    } else if (!validateHttpsOriginList(origin)) {
      errors.push(
        issue(
          "WEBAUTHN_ORIGIN",
          "WEBAUTHN_ORIGIN must contain only valid https origins in production.",
        ),
      );
    }
  } else {
    const origin = read(env, "WEBAUTHN_ORIGIN");
    if (origin && !validateUrl(origin.split(",")[0]?.trim() ?? "")) {
      warnings.push(
        warning(
          "WEBAUTHN_ORIGIN",
          "WEBAUTHN_ORIGIN should be a comma-separated list of valid origins.",
        ),
      );
    }
  }

  return {
    ok: errors.length === 0,
    target,
    errors,
    warnings,
  };
}
