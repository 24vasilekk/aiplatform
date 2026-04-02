import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

function isTruthy(raw) {
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function getPolicy() {
  return process.env.SCHEMA_READINESS_POLICY?.trim().toLowerCase() === "warn" ? "warn" : "strict";
}

function rank(version) {
  const prefix = String(version ?? "").match(/^(\d{14})/)?.[1];
  if (!prefix) return null;
  const parsed = Number.parseInt(prefix, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getExpectedVersion() {
  const explicit = process.env.SCHEMA_VERSION?.trim();
  if (explicit) return { value: explicit, source: "explicit" };

  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  try {
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    const names = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return { value: names[names.length - 1] ?? null, source: "migrations_dir" };
  } catch {
    return { value: null, source: "none" };
  }
}

async function main() {
  const policy = getPolicy();
  const readinessEnabled = process.env.SCHEMA_READINESS_ENABLED === undefined
    ? true
    : isTruthy(process.env.SCHEMA_READINESS_ENABLED);
  const forceMaintenance = isTruthy(process.env.APP_MAINTENANCE_MODE);

  const prisma = new PrismaClient();
  const output = {
    ok: false,
    policy,
    readinessEnabled,
    forceMaintenance,
    expectedVersion: null,
    expectedSource: "none",
    appliedVersion: null,
    compatibility: "unknown",
    reasons: [],
  };

  const expected = await getExpectedVersion();
  output.expectedVersion = expected.value;
  output.expectedSource = expected.source;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    output.reasons.push("database_unreachable");
    output.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT migration_name
       FROM "_prisma_migrations"
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
       ORDER BY finished_at DESC
       LIMIT 1`,
    );
    output.appliedVersion = rows?.[0]?.migration_name ?? null;
  } catch (error) {
    output.reasons.push("migrations_table_unavailable");
    output.error = error instanceof Error ? error.message : String(error);
  } finally {
    await prisma.$disconnect();
  }

  if (!readinessEnabled) {
    output.compatibility = "unknown";
    output.ok = true;
  } else if (!output.expectedVersion) {
    output.compatibility = "unknown";
    output.reasons.push("expected_schema_version_unresolved");
    output.ok = policy === "warn";
  } else if (!output.appliedVersion) {
    output.compatibility = "incompatible";
    output.reasons.push("applied_schema_version_unresolved");
    output.ok = policy === "warn";
  } else if (output.expectedVersion === output.appliedVersion) {
    output.compatibility = "compatible";
    output.ok = true;
  } else {
    output.compatibility = "incompatible";
    const expectedRank = rank(output.expectedVersion);
    const appliedRank = rank(output.appliedVersion);
    output.reasons.push(expectedRank !== null && appliedRank !== null && appliedRank < expectedRank ? "schema_behind_code" : "schema_version_mismatch");
    output.ok = policy === "warn";
  }

  if (forceMaintenance) {
    output.ok = false;
    output.reasons.push("maintenance_mode_forced");
  }

  console.log(JSON.stringify(output, null, 2));
  process.exit(output.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
