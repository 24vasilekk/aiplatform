import { NextResponse } from "next/server";
import { getServiceMetricsSnapshot, observeRequest, toPrometheusMetrics } from "@/lib/observability";

export async function GET(request: Request) {
  return observeRequest({
    request,
    operation: "metrics.get",
    handler: async () => {
      const format = new URL(request.url).searchParams.get("format")?.trim().toLowerCase() ?? "json";
      const snapshot = getServiceMetricsSnapshot();

      if (format === "prom" || format === "prometheus" || format === "text") {
        return new NextResponse(toPrometheusMetrics(snapshot), {
          status: 200,
          headers: {
            "content-type": "text/plain; version=0.0.4; charset=utf-8",
          },
        });
      }

      return NextResponse.json(snapshot);
    },
  });
}
