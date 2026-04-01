import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  createServiceErrorLog,
} from "@/lib/db";
import { applyPrivateCache } from "@/lib/http-cache";
import { ReadOps } from "@/lib/read-ops";
import { WriteOps } from "@/lib/write-ops";

function parseDays(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 90));
}

export async function GET(request: NextRequest) {
  const requestPath = new URL(request.url).pathname;
  const auth = await requireUser(request);
  if (auth.error || !auth.user) return auth.error;
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = parseDays(request.nextUrl.searchParams.get("days"), 30);

  try {
    const [snapshot, existingSeries] = await Promise.all([
      ReadOps.getLearningAnalyticsSnapshot(days),
      ReadOps.listDailyMetricAggregates(days),
    ]);

    let series = existingSeries;
    let enqueuedRecompute = false;

    if (existingSeries.length < days) {
      await WriteOps.enqueueDailyMetricsRecomputeJob({
        days,
        idempotencyKey: `daily_metrics:${days}:${new Date().toISOString().slice(0, 10)}`,
      });
      enqueuedRecompute = true;
      series = existingSeries;
    }

    const response = NextResponse.json({ snapshot, series, days, enqueuedRecompute });
    response.headers.set("vary", "cookie");
    applyPrivateCache(response, {
      maxAgeSec: 20,
      staleWhileRevalidateSec: 60,
    });
    return response;
  } catch (error) {
    await createServiceErrorLog({
      route: requestPath,
      message: "Failed to build admin analytics summary",
      details: { days },
      stack: error instanceof Error ? error.stack ?? null : null,
      userId: auth.user.id,
    });
    return NextResponse.json({ error: "Не удалось собрать аналитику" }, { status: 500 });
  }
}
