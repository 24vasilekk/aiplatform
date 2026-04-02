import { NextResponse } from "next/server";
import { getServiceMetricsSnapshot, observeRequest } from "@/lib/observability";

export async function GET(request: Request) {
  return observeRequest({
    request,
    operation: "health.liveness",
    schemaCheck: "skip",
    handler: async () => {
      const metrics = getServiceMetricsSnapshot();
      return NextResponse.json({
        status: "ok",
        service: metrics.service,
        env: metrics.env,
        timestamp: metrics.timestamp,
        uptimeSec: metrics.process.uptimeSec,
      });
    },
  });
}
