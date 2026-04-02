import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSchemaReadinessSnapshotMock: vi.fn(),
  getEnvReadinessSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/schema-readiness", () => ({
  getSchemaReadinessSnapshot: mocks.getSchemaReadinessSnapshotMock,
}));

vi.mock("@/lib/env-readiness", () => ({
  getEnvReadinessSnapshot: mocks.getEnvReadinessSnapshotMock,
}));

import { GET } from "@/app/api/readiness/route";

describe("GET /api/readiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 for ready schema", async () => {
    mocks.getSchemaReadinessSnapshotMock.mockResolvedValue({
      status: "ready",
      policy: "strict",
      gate: "open",
      compatibility: "compatible",
      expectedVersion: "20260402021000_add_user_360_indexes",
      appliedVersion: "20260402021000_add_user_360_indexes",
      reasons: [],
      checks: {
        database: { ok: true, error: null },
        migrationTable: { ok: true, error: null },
      },
      runbook: { commands: ["npm run schema:check"], docsPath: "/docs/runbook-part-3-4.md" },
    });
    mocks.getEnvReadinessSnapshotMock.mockReturnValue({
      ok: true,
      checkedAt: "2026-04-02T00:00:00.000Z",
      mode: "strict",
      missingRequired: [],
      issues: [],
      requiredKeys: ["DATABASE_URL", "AUTH_JWT_SECRET", "APP_URL"],
    });

    const response = await GET(new Request("http://localhost/api/readiness"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ready");
    expect(data.compatibility).toBe("compatible");
    expect(data.env.ok).toBe(true);
  });

  it("returns 503 for maintenance schema state", async () => {
    mocks.getSchemaReadinessSnapshotMock.mockResolvedValue({
      status: "maintenance",
      policy: "strict",
      gate: "maintenance",
      compatibility: "incompatible",
      expectedVersion: "20260402094000_loyalty_course_completion_guard",
      appliedVersion: "20260402021000_add_user_360_indexes",
      reasons: ["schema_behind_code"],
      checks: {
        database: { ok: true, error: null },
        migrationTable: { ok: true, error: null },
      },
      runbook: { commands: ["npm run deploy:migrate"], docsPath: "/docs/runbook-part-3-4.md" },
    });
    mocks.getEnvReadinessSnapshotMock.mockReturnValue({
      ok: true,
      checkedAt: "2026-04-02T00:00:00.000Z",
      mode: "strict",
      missingRequired: [],
      issues: [],
      requiredKeys: ["DATABASE_URL", "AUTH_JWT_SECRET", "APP_URL"],
    });

    const response = await GET(new Request("http://localhost/api/readiness"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("maintenance");
    expect(data.reasons).toContain("schema_behind_code");
  });

  it("returns 503 when env readiness is enforced and env check fails", async () => {
    vi.stubEnv("ENV_READINESS_ENFORCE", "1");
    mocks.getSchemaReadinessSnapshotMock.mockResolvedValue({
      status: "ready",
      policy: "strict",
      gate: "open",
      compatibility: "compatible",
      expectedVersion: "20260402094000_loyalty_course_completion_guard",
      appliedVersion: "20260402094000_loyalty_course_completion_guard",
      reasons: [],
      checks: {
        database: { ok: true, error: null },
        migrationTable: { ok: true, error: null },
      },
      runbook: { commands: ["npm run deploy:migrate"], docsPath: "/docs/runbook-part-3-4.md" },
    });
    mocks.getEnvReadinessSnapshotMock.mockReturnValue({
      ok: false,
      checkedAt: "2026-04-02T00:00:00.000Z",
      mode: "strict",
      missingRequired: ["AUTH_JWT_SECRET"],
      issues: [{ key: "AUTH_JWT_SECRET", severity: "error", message: "Missing required env" }],
      requiredKeys: ["DATABASE_URL", "AUTH_JWT_SECRET", "APP_URL"],
    });

    const response = await GET(new Request("http://localhost/api/readiness"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.reasons).toContain("env_not_ready");
    expect(data.env.ok).toBe(false);
    expect(data.env.enforce).toBe(true);
  });
});
