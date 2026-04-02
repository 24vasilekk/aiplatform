import { NextResponse } from "next/server";
import { getEnvReadinessSnapshot } from "@/lib/env-readiness";
import { getServiceMetricsSnapshot, observeRequest, toPrometheusMetrics } from "@/lib/observability";
import { getSchemaReadinessSnapshot } from "@/lib/schema-readiness";

function readinessStatusToGauge(status: string) {
  if (status === "ready") return 1;
  if (status === "degraded") return 0.5;
  return 0;
}

export async function GET(request: Request) {
  return observeRequest({
    request,
    operation: "metrics.get",
    handler: async () => {
      const format = new URL(request.url).searchParams.get("format")?.trim().toLowerCase() ?? "json";
      const snapshot = getServiceMetricsSnapshot();
      const [schemaReadiness, envReadiness] = await Promise.all([
        getSchemaReadinessSnapshot(),
        Promise.resolve(getEnvReadinessSnapshot({ mode: "warn" })),
      ]);

      if (format === "prom" || format === "prometheus" || format === "text") {
        const readinessGauge = readinessStatusToGauge(schemaReadiness.status);
        const envGauge = envReadiness.ok ? 1 : 0;
        const promPayload = [
          toPrometheusMetrics(snapshot).trimEnd(),
          "# HELP service_schema_readiness Readiness status derived from schema compatibility",
          "# TYPE service_schema_readiness gauge",
          `service_schema_readiness ${readinessGauge}`,
          "# HELP service_env_readiness Environment readiness check result",
          "# TYPE service_env_readiness gauge",
          `service_env_readiness ${envGauge}`,
          "",
        ].join("\n");
        return new NextResponse(promPayload, {
          status: 200,
          headers: {
            "content-type": "text/plain; version=0.0.4; charset=utf-8",
          },
        });
      }

      return NextResponse.json({
        ...snapshot,
        readiness: {
          schema: schemaReadiness,
          env: envReadiness,
        },
      });
    },
  });
}
