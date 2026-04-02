import { describe, expect, it } from "vitest";
import { getEnvReadinessSnapshot } from "@/lib/env-readiness";

describe("getEnvReadinessSnapshot", () => {
  it("returns not ok when required env vars are missing", () => {
    const snapshot = getEnvReadinessSnapshot({
      env: {
        NODE_ENV: "production",
      },
    });

    expect(snapshot.ok).toBe(false);
    expect(snapshot.missingRequired).toContain("DATABASE_URL");
    expect(snapshot.missingRequired).toContain("AUTH_JWT_SECRET");
    expect(snapshot.missingRequired).toContain("APP_URL");
  });

  it("requires yookassa vars when yookassa billing provider is used", () => {
    const snapshot = getEnvReadinessSnapshot({
      env: {
        DATABASE_URL: "postgresql://localhost:5432/ege",
        AUTH_JWT_SECRET: "super-long-secret-value-for-prod",
        APP_URL: "https://ege.example.com",
        BILLING_PROVIDER: "yookassa",
      },
    });

    expect(snapshot.ok).toBe(false);
    expect(snapshot.missingRequired).toContain("YOOKASSA_SHOP_ID");
    expect(snapshot.missingRequired).toContain("YOOKASSA_SECRET_KEY");
    expect(snapshot.missingRequired).toContain("BILLING_WEBHOOK_SECRET");
  });

  it("accepts minimal required vars with mock billing", () => {
    const snapshot = getEnvReadinessSnapshot({
      env: {
        DATABASE_URL: "postgresql://localhost:5432/ege",
        AUTH_JWT_SECRET: "super-long-secret-value-for-prod",
        APP_URL: "https://ege.example.com",
        BILLING_PROVIDER: "mock",
      },
    });

    expect(snapshot.ok).toBe(true);
    expect(snapshot.missingRequired).toHaveLength(0);
  });
});

