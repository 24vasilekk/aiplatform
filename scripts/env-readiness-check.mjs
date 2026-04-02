import process from "node:process";

function isTruthy(raw) {
  if (!raw) return false;
  const value = String(raw).trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function normalizeBillingProvider(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "yookassa" ? "yookassa" : "mock";
}

function isPlaceholderSecret(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.length < 12) return true;
  if (normalized.includes("change-me")) return true;
  if (normalized.includes("temporary")) return true;
  if (normalized.includes("example")) return true;
  return normalized === "ci-secret";
}

function validateEnv(env, mode) {
  const required = ["DATABASE_URL", "AUTH_JWT_SECRET", "APP_URL"];
  if (normalizeBillingProvider(env.BILLING_PROVIDER) === "yookassa") {
    required.push("YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY", "BILLING_WEBHOOK_SECRET");
  }

  const issues = [];
  const missing = [];
  for (const key of required) {
    if (!String(env[key] ?? "").trim()) {
      missing.push(key);
      issues.push({ key, severity: "error", message: `Missing required env: ${key}` });
    }
  }

  if (String(env.AUTH_JWT_SECRET ?? "").trim() && isPlaceholderSecret(env.AUTH_JWT_SECRET)) {
    issues.push({
      key: "AUTH_JWT_SECRET",
      severity: mode === "strict" ? "error" : "warn",
      message: "AUTH_JWT_SECRET looks weak/placeholder",
    });
  }

  const appUrl = String(env.APP_URL ?? "").trim();
  if (appUrl && !/^https?:\/\//i.test(appUrl)) {
    issues.push({ key: "APP_URL", severity: "error", message: "APP_URL must be absolute URL" });
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");
  return {
    ok: !hasErrors,
    mode,
    billingProvider: normalizeBillingProvider(env.BILLING_PROVIDER),
    missing,
    issues,
  };
}

async function main() {
  const mode = String(process.env.ENV_READINESS_MODE ?? "strict").trim().toLowerCase() === "warn" ? "warn" : "strict";
  const enabled = process.env.ENV_READINESS_ENABLED === undefined ? true : isTruthy(process.env.ENV_READINESS_ENABLED);

  if (!enabled) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason: "ENV_READINESS_ENABLED=0",
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const result = validateEnv(process.env, mode);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

