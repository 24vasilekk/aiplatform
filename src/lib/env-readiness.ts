type EnvSeverity = "error" | "warn";

export type EnvReadinessIssue = {
  key: string;
  severity: EnvSeverity;
  message: string;
};

export type EnvReadinessSnapshot = {
  ok: boolean;
  checkedAt: string;
  mode: "strict" | "warn";
  missingRequired: string[];
  issues: EnvReadinessIssue[];
  requiredKeys: string[];
};

function normalizeBillingProvider(raw: string | undefined) {
  const value = raw?.trim().toLowerCase();
  if (value === "yookassa") return "yookassa";
  return "mock";
}

function isPlaceholderSecret(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.length < 12) return true;
  if (normalized.includes("change-me")) return true;
  if (normalized.includes("temporary")) return true;
  if (normalized.includes("example")) return true;
  if (normalized === "ci-secret") return true;
  return false;
}

function getRequiredKeys(env: NodeJS.ProcessEnv) {
  const required = ["DATABASE_URL", "AUTH_JWT_SECRET", "APP_URL"];
  if (normalizeBillingProvider(env.BILLING_PROVIDER) === "yookassa") {
    required.push("YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY", "BILLING_WEBHOOK_SECRET");
  }
  return required;
}

function pushPairIssue(
  issues: EnvReadinessIssue[],
  env: NodeJS.ProcessEnv,
  left: string,
  right: string,
  label: string,
) {
  const leftSet = Boolean(env[left]?.trim());
  const rightSet = Boolean(env[right]?.trim());
  if (leftSet !== rightSet) {
    issues.push({
      key: `${left}|${right}`,
      severity: "warn",
      message: `${label}: переменные должны быть заданы парой (${left}, ${right}).`,
    });
  }
}

export function getEnvReadinessSnapshot(options?: {
  env?: NodeJS.ProcessEnv;
  mode?: "strict" | "warn";
}): EnvReadinessSnapshot {
  const env = options?.env ?? process.env;
  const mode = options?.mode ?? "strict";
  const requiredKeys = getRequiredKeys(env);
  const missingRequired: string[] = [];
  const issues: EnvReadinessIssue[] = [];

  for (const key of requiredKeys) {
    const value = env[key]?.trim();
    if (!value) {
      missingRequired.push(key);
      issues.push({
        key,
        severity: "error",
        message: `Не задана обязательная переменная окружения ${key}.`,
      });
    }
  }

  const jwt = env.AUTH_JWT_SECRET?.trim();
  if (jwt && isPlaceholderSecret(jwt)) {
    issues.push({
      key: "AUTH_JWT_SECRET",
      severity: mode === "strict" ? "error" : "warn",
      message: "AUTH_JWT_SECRET выглядит как временный/небезопасный секрет.",
    });
  }

  const appUrl = env.APP_URL?.trim();
  if (appUrl && !/^https?:\/\//i.test(appUrl)) {
    issues.push({
      key: "APP_URL",
      severity: "error",
      message: "APP_URL должен быть абсолютным URL (http/https).",
    });
  }

  pushPairIssue(issues, env, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "Google OAuth");
  pushPairIssue(
    issues,
    env,
    "TELEGRAM_BOT_TOKEN",
    "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",
    "Telegram OAuth",
  );
  pushPairIssue(issues, env, "SMTP_HOST", "SMTP_FROM", "SMTP");
  pushPairIssue(issues, env, "SMTP_USER", "SMTP_PASS", "SMTP");

  const hasError = issues.some((issue) => issue.severity === "error");

  return {
    ok: !hasError,
    checkedAt: new Date().toISOString(),
    mode,
    missingRequired,
    issues,
    requiredKeys,
  };
}
