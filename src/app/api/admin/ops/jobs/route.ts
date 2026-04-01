import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import {
  createAdminAuditLog,
  createServiceErrorLog,
} from "@/lib/db";
import { ReadOps } from "@/lib/read-ops";
import { WriteOps } from "@/lib/write-ops";

const postSchema = z.object({
  action: z.enum(["enqueue_daily_metrics", "enqueue_dataset_processing", "run_pending"]),
  days: z.number().int().min(1).max(90).optional(),
  fileId: z.string().trim().min(3).optional(),
  limit: z.number().int().min(1).max(10).optional(),
  idempotencyKey: z.string().trim().min(6).max(160).optional(),
});

function parseTake(value: string | null) {
  if (!value) return 30;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(parsed, 100));
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) return auth.error;
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const take = parseTake(request.nextUrl.searchParams.get("take"));
  const jobs = await ReadOps.listJobs({
    status:
      status === "pending" || status === "processing" || status === "succeeded" || status === "failed"
        ? status
        : undefined,
    take,
  });
  return NextResponse.json({ jobs, take });
}

export async function POST(request: NextRequest) {
  const requestPath = new URL(request.url).pathname;
  const auth = await requireUser(request);
  if (auth.error || !auth.user) return auth.error;
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверный запрос по операциям" }, { status: 400 });
  }
  const headerIdempotency = request.headers.get("x-idempotency-key")?.trim() || undefined;

  try {
    if (parsed.data.action === "run_pending") {
      const execution = await WriteOps.executePendingJobs(parsed.data.limit ?? 3);
      await createAdminAuditLog({
        adminUserId: auth.user.id,
        action: "ops_run_pending_jobs",
        entityType: "job_queue",
        metadata: { limit: parsed.data.limit ?? 3, executed: execution.length },
      });
      return NextResponse.json({ ok: true, execution });
    }

    if (parsed.data.action === "enqueue_dataset_processing") {
      if (!parsed.data.fileId) {
        return NextResponse.json({ error: "Требуется fileId для enqueue_dataset_processing" }, { status: 400 });
      }

      const file = await WriteOps.findDatasetFileById(parsed.data.fileId);
      if (!file) {
        return NextResponse.json({ error: "Dataset file not found" }, { status: 404 });
      }

      const job = await WriteOps.enqueueDatasetFileProcessingJob({
        fileId: parsed.data.fileId,
        idempotencyKey: parsed.data.idempotencyKey ?? headerIdempotency,
      });
      await createAdminAuditLog({
        adminUserId: auth.user.id,
        action: "ops_enqueue_dataset_processing",
        entityType: "job_queue",
        entityId: job.id,
        metadata: { fileId: parsed.data.fileId },
      });
      return NextResponse.json({ ok: true, job });
    }

    const days = parsed.data.days ?? 30;
    const job = await WriteOps.enqueueDailyMetricsRecomputeJob({
      days,
      idempotencyKey:
        parsed.data.idempotencyKey ?? headerIdempotency ?? `daily_metrics:${days}:${toIsoDateToken(new Date())}`,
    });
    await createAdminAuditLog({
      adminUserId: auth.user.id,
      action: "ops_enqueue_daily_metrics",
      entityType: "job_queue",
      entityId: job.id,
      metadata: { days },
    });
    return NextResponse.json({ ok: true, job });
  } catch (error) {
    await createServiceErrorLog({
      route: requestPath,
      message: "Admin ops job request failed",
      details: { action: parsed.data.action },
      stack: error instanceof Error ? error.stack ?? null : null,
      userId: auth.user.id,
    });
    return NextResponse.json({ error: "Не удалось выполнить операцию" }, { status: 500 });
  }
}

function toIsoDateToken(date: Date) {
  return date.toISOString().slice(0, 10);
}
