import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { observeRequest } from "@/lib/observability";
import { reportServerError } from "@/lib/error-monitoring";

const schema = z.object({
  message: z.string().trim().min(1).max(2000),
  digest: z.string().trim().max(256).optional(),
  stack: z.string().trim().max(10000).optional(),
  path: z.string().trim().max(1024).optional(),
  componentStack: z.string().trim().max(10000).optional(),
});

export async function POST(request: NextRequest) {
  return observeRequest({
    request,
    operation: "errors.client.report",
    handler: async (ctx) => {
      const parsed = schema.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      await reportServerError({
        route: parsed.data.path || "/client",
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        traceId: ctx.traceId,
        message: `ClientError: ${parsed.data.message}`,
        severity: "warn",
        details: {
          digest: parsed.data.digest ?? null,
          stack: parsed.data.stack ?? null,
          componentStack: parsed.data.componentStack ?? null,
          source: "client-error-boundary",
        },
      });

      return NextResponse.json({ ok: true });
    },
  });
}
