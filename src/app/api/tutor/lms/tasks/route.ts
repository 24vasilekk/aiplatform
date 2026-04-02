import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-auth";
import { createAdminAuditLog, createTutorCustomTask, listTutorCustomTasksPaged } from "@/lib/db";
import { applyPrivateCache } from "@/lib/http-cache";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z
  .object({
    lessonId: z.string().trim().min(1),
    type: z.enum(["numeric", "choice"]),
    status: z.enum(["published", "unpublished", "archived"]).default("published"),
    question: z.string().trim().min(5),
    options: z.array(z.string().trim().min(1)).optional(),
    answer: z.string().trim().min(1),
    solution: z.string().trim().min(5),
    difficulty: z.number().int().min(1).max(5).default(2),
    topicTags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
    exemplarSolution: z.string().trim().min(5).max(10000).optional().nullable(),
    evaluationCriteria: z.array(z.string().trim().min(3).max(400)).max(20).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.type === "choice" && (!value.options || value.options.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для выбора нужно минимум 2 варианта",
        path: ["options"],
      });
    }
  });

function parseTake(value: string | null) {
  if (!value) return 500;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 500;
  return Math.max(1, Math.min(parsed, 1200));
}

function parseSkip(value: string | null) {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

async function authorize(request: NextRequest) {
  return requireRoles(request, ["tutor"]);
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_tasks_get",
    keySuffix: auth.user.id,
    limit: 320,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много запросов списка заданий. Попробуйте позже.");
  }

  const params = new URL(request.url).searchParams;
  const take = parseTake(params.get("take"));
  const skip = parseSkip(params.get("skip"));
  const lessonId = params.get("lessonId")?.trim() || undefined;
  const statusRaw = params.get("status");
  const status =
    statusRaw === "published" || statusRaw === "unpublished" || statusRaw === "archived"
      ? statusRaw
      : undefined;
  const tasks = await listTutorCustomTasksPaged(auth.user.id, { lessonId, status, take, skip });

  const response = NextResponse.json({
    items: tasks.rows,
    total: tasks.total,
    take: tasks.take,
    skip: tasks.skip,
  });
  applyPrivateCache(response, { maxAgeSec: 10, staleWhileRevalidateSec: 30 });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_tasks_post",
    keySuffix: auth.user.id,
    limit: 140,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много операций создания заданий. Попробуйте позже.");
  }
  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные задания" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const task = await createTutorCustomTask(auth.user.id, {
    lessonId: parsed.data.lessonId,
    type: parsed.data.type,
    status: parsed.data.status,
    question: parsed.data.question,
    options: parsed.data.type === "choice" ? parsed.data.options ?? [] : null,
    answer: parsed.data.answer,
    solution: parsed.data.solution,
    difficulty: parsed.data.difficulty,
    topicTags: parsed.data.topicTags,
    exemplarSolution: parsed.data.exemplarSolution ?? null,
    evaluationCriteria: parsed.data.evaluationCriteria,
  });
  if (!task) {
    const response = NextResponse.json({ error: "Урок не найден или недоступен" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_create_task",
    entityType: "tutor_task",
    entityId: task.id,
    metadata: {
      ownerId: auth.user.id,
      lessonId: task.lessonId,
      type: task.type,
      status: task.status,
      difficulty: task.difficulty,
    },
  });

  const response = NextResponse.json({ ok: true, task }, { status: 201 });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
