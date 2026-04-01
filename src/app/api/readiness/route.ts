import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { observeRequest } from "@/lib/observability";

export async function GET(request: Request) {
  return observeRequest({
    request,
    operation: "health.readiness",
    handler: async () => {
      const startedAt = Date.now();
      let dbOk = false;
      let dbError: string | null = null;

      try {
        await prisma.$queryRaw`SELECT 1`;
        dbOk = true;
      } catch (error) {
        dbOk = false;
        dbError = error instanceof Error ? error.message : String(error);
      }

      const status = dbOk ? 200 : 503;
      return NextResponse.json(
        {
          status: dbOk ? "ready" : "not_ready",
          checks: {
            database: {
              ok: dbOk,
              latencyMs: Date.now() - startedAt,
              error: dbError,
            },
          },
          timestamp: new Date().toISOString(),
        },
        { status },
      );
    },
  });
}
