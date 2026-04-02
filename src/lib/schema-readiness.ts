import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type SchemaPolicy = "strict" | "warn";
type SchemaGate = "open" | "maintenance";
type Compatibility = "compatible" | "incompatible" | "unknown";

export type SchemaReadinessSnapshot = {
  status: "ready" | "degraded" | "maintenance" | "not_ready";
  policy: SchemaPolicy;
  gate: SchemaGate;
  compatibility: Compatibility;
  source: "explicit" | "migrations_dir" | "none";
  expectedVersion: string | null;
  appliedVersion: string | null;
  checkedAt: string;
  reasons: string[];
  checks: {
    database: {
      ok: boolean;
      error: string | null;
    };
    migrationTable: {
      ok: boolean;
      error: string | null;
    };
  };
  runbook: {
    commands: string[];
    docsPath: string;
  };
};

type CacheEntry = {
  expiresAt: number;
  value: SchemaReadinessSnapshot;
};

const RUNBOOK_COMMANDS = [
  "npm run prisma:generate",
  "npm run prisma:migrate:deploy",
  "npm run schema:check",
  "npm run build:vercel:fallback",
];

const RUNBOOK_DOCS_PATH = "/docs/runbook-part-3-4.md";
const DEFAULT_CACHE_TTL_MS = 15_000;

declare global {
  var __schemaReadinessCache: CacheEntry | undefined;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizePolicy(raw: string | undefined): SchemaPolicy {
  return raw?.trim().toLowerCase() === "warn" ? "warn" : "strict";
}

function isTruthy(raw: string | undefined) {
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function extractVersionRank(value: string | null) {
  if (!value) return null;
  const prefix = value.match(/^(\d{14})/)?.[1];
  if (!prefix) return null;
  const rank = Number.parseInt(prefix, 10);
  if (!Number.isFinite(rank)) return null;
  return rank;
}

async function resolveExpectedSchemaVersion(): Promise<{ version: string | null; source: SchemaReadinessSnapshot["source"] }> {
  const explicit = process.env.SCHEMA_VERSION?.trim();
  if (explicit) {
    return { version: explicit, source: "explicit" };
  }

  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  try {
    const entries = await readdir(migrationsDir, { withFileTypes: true });
    const names = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (names.length === 0) {
      return { version: null, source: "none" };
    }
    return { version: names[names.length - 1], source: "migrations_dir" };
  } catch {
    return { version: null, source: "none" };
  }
}

async function fetchLatestAppliedMigration() {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT migration_name
       FROM "_prisma_migrations"
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
       ORDER BY finished_at DESC
       LIMIT 1`,
    );
    return {
      appliedVersion: rows[0]?.migration_name ?? null,
      migrationTableOk: true,
      migrationError: null as string | null,
    };
  } catch (error) {
    return {
      appliedVersion: null,
      migrationTableOk: false,
      migrationError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function computeSnapshot(): Promise<SchemaReadinessSnapshot> {
  const checkedAt = new Date().toISOString();
  const reasons: string[] = [];
  const policy = normalizePolicy(process.env.SCHEMA_READINESS_POLICY);
  const forceMaintenance = isTruthy(process.env.APP_MAINTENANCE_MODE);
  const readinessEnabled = process.env.SCHEMA_READINESS_ENABLED === undefined
    ? process.env.NODE_ENV !== "test"
    : isTruthy(process.env.SCHEMA_READINESS_ENABLED);

  if (!readinessEnabled && !forceMaintenance) {
    return {
      status: "ready",
      policy,
      gate: "open",
      compatibility: "unknown",
      source: "none",
      expectedVersion: null,
      appliedVersion: null,
      checkedAt,
      reasons: ["schema_check_disabled"],
      checks: {
        database: { ok: true, error: null },
        migrationTable: { ok: true, error: null },
      },
      runbook: {
        commands: RUNBOOK_COMMANDS,
        docsPath: RUNBOOK_DOCS_PATH,
      },
    };
  }

  let dbOk = false;
  let dbError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (error) {
    dbOk = false;
    dbError = error instanceof Error ? error.message : String(error);
    reasons.push("database_unreachable");
  }

  const expected = await resolveExpectedSchemaVersion();
  const applied = dbOk ? await fetchLatestAppliedMigration() : {
    appliedVersion: null,
    migrationTableOk: false,
    migrationError: "database_unreachable",
  };

  let compatibility: Compatibility = "unknown";
  if (!readinessEnabled) {
    compatibility = "unknown";
    reasons.push("schema_check_disabled");
  } else if (!dbOk) {
    compatibility = "unknown";
  } else if (!expected.version) {
    compatibility = "unknown";
    reasons.push("expected_schema_version_unresolved");
  } else if (!applied.appliedVersion) {
    compatibility = "incompatible";
    reasons.push(applied.migrationTableOk ? "migrations_empty" : "migrations_table_unavailable");
  } else if (applied.appliedVersion === expected.version) {
    compatibility = "compatible";
  } else {
    const expectedRank = extractVersionRank(expected.version);
    const appliedRank = extractVersionRank(applied.appliedVersion);
    if (expectedRank !== null && appliedRank !== null && appliedRank < expectedRank) {
      compatibility = "incompatible";
      reasons.push("schema_behind_code");
    } else {
      compatibility = "incompatible";
      reasons.push("schema_version_mismatch");
    }
  }

  const shouldMaintenance =
    forceMaintenance ||
    (readinessEnabled && policy === "strict" && compatibility === "incompatible") ||
    !dbOk;

  if (forceMaintenance) {
    reasons.push("maintenance_mode_forced");
  }

  const status: SchemaReadinessSnapshot["status"] = !dbOk
    ? "not_ready"
    : shouldMaintenance
      ? "maintenance"
      : compatibility === "compatible"
        ? "ready"
        : "degraded";

  return {
    status,
    policy,
    gate: shouldMaintenance ? "maintenance" : "open",
    compatibility,
    source: expected.source,
    expectedVersion: expected.version,
    appliedVersion: applied.appliedVersion,
    checkedAt,
    reasons,
    checks: {
      database: { ok: dbOk, error: dbError },
      migrationTable: { ok: applied.migrationTableOk, error: applied.migrationError },
    },
    runbook: {
      commands: RUNBOOK_COMMANDS,
      docsPath: RUNBOOK_DOCS_PATH,
    },
  };
}

export async function getSchemaReadinessSnapshot(options?: { force?: boolean }) {
  const ttlMs = parsePositiveInt(process.env.SCHEMA_READINESS_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS);
  const now = Date.now();
  if (!options?.force && global.__schemaReadinessCache && global.__schemaReadinessCache.expiresAt > now) {
    return global.__schemaReadinessCache.value;
  }

  const value = await computeSnapshot();
  global.__schemaReadinessCache = {
    value,
    expiresAt: now + ttlMs,
  };
  return value;
}

function isRouteExemptFromMaintenance(pathname: string) {
  return pathname === "/api/health" || pathname === "/api/readiness" || pathname === "/health" || pathname === "/readiness";
}

export function shouldServeMaintenance(snapshot: SchemaReadinessSnapshot, pathname: string) {
  if (isRouteExemptFromMaintenance(pathname)) return false;
  return snapshot.gate === "maintenance";
}

export function createSchemaMaintenanceApiResponse(snapshot: SchemaReadinessSnapshot) {
  return NextResponse.json(
    {
      error: "Service temporarily unavailable: schema is not compatible with current application version.",
      code: "SCHEMA_NOT_READY",
      schema: {
        status: snapshot.status,
        policy: snapshot.policy,
        compatibility: snapshot.compatibility,
        expectedVersion: snapshot.expectedVersion,
        appliedVersion: snapshot.appliedVersion,
        reasons: snapshot.reasons,
      },
      runbook: snapshot.runbook,
    },
    {
      status: 503,
      headers: {
        "retry-after": "30",
      },
    },
  );
}
