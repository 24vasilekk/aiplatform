import { NextResponse } from "next/server";
import { getEnvReadinessSnapshot } from "@/lib/env-readiness";
import { observeRequest } from "@/lib/observability";
import { getSchemaReadinessSnapshot } from "@/lib/schema-readiness";

function isTruthy(raw: string | undefined) {
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export async function GET(request: Request) {
  return observeRequest({
    request,
    operation: "health.readiness",
    schemaCheck: "skip",
    handler: async () => {
      const snapshot = await getSchemaReadinessSnapshot({ force: true });
      const envMode = process.env.ENV_READINESS_MODE?.trim().toLowerCase() === "warn" ? "warn" : "strict";
      const envReadiness = getEnvReadinessSnapshot({ mode: envMode });
      const enforceEnv = process.env.ENV_READINESS_ENFORCE === undefined
        ? isTruthy(process.env.NODE_ENV === "production" ? "1" : "0")
        : isTruthy(process.env.ENV_READINESS_ENFORCE);
      const schemaDown = snapshot.status === "maintenance" || snapshot.status === "not_ready";
      const envDown = enforceEnv && !envReadiness.ok;
      const status = schemaDown || envDown ? 503 : 200;
      const mergedStatus = schemaDown
        ? snapshot.status
        : envDown
          ? "degraded"
          : snapshot.status;
      const reasons = [...snapshot.reasons];
      if (envDown) {
        reasons.push("env_not_ready");
      }

      return NextResponse.json(
        {
          status: mergedStatus,
          policy: snapshot.policy,
          gate: snapshot.gate,
          compatibility: snapshot.compatibility,
          expectedVersion: snapshot.expectedVersion,
          appliedVersion: snapshot.appliedVersion,
          reasons,
          checks: snapshot.checks,
          env: {
            ...envReadiness,
            enforce: enforceEnv,
          },
          runbook: snapshot.runbook,
          timestamp: new Date().toISOString(),
        },
        { status },
      );
    },
  });
}
