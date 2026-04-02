import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-auth";
import { createAdminAuditLog, deleteTutorCustomTask, updateTutorCustomTask } from "@/lib/db";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z
  .object({
    lessonId: z.string().trim().min(1).optional(),
    type: z.enum(["numeric", "choice"]).optional(),
    status: z.enum(["published", "unpublished", "archived"]).optional(),
    question: z.string().trim().min(5).optional(),
    options: z.array(z.string().trim().min(1)).optional().nullable(),
    answer: z.string().trim().min(1).optional(),
    solution: z.string().trim().min(5).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    topicTags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    exemplarSolution: z.string().trim().min(5).max(10000).optional().nullable(),
    evaluationCriteria: z.array(z.string().trim().min(3).max(400)).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "choice" && value.options === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для смены типа на choice передайте минимум 2 варианта",
        path: ["options"],
      });
    }
    if (value.type === "choice" && value.options !== undefined && (value.options === null || value.options.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для выбора нужно минимум 2 варианта",
        path: ["options"],
      });
    }
    if (value.type === undefined && value.options && value.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для выбора нужно минимум 2 варианта",
        path: ["options"],
      });
    }
  });

async function authorize(request: NextRequest) {
  return requireRoles(request, ["tutor"]);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_task_patch",
    keySuffix: auth.user.id,
    limit: 180,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много обновлений заданий. Попробуйте позже.");
  }
  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const { taskId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные задания" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const nextData = {
    ...parsed.data,
    options:
      parsed.data.type === "numeric"
        ? null
        : parsed.data.options === undefined
          ? undefined
          : parsed.data.options,
  };

  const task = await updateTutorCustomTask(auth.user.id, taskId, nextData);
  if (!task) {
    const response = NextResponse.json({ error: "Задание не найдено" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_update_task",
    entityType: "tutor_task",
    entityId: task.id,
    metadata: {
      ownerId: auth.user.id,
      ...nextData,
    },
  });

  const response = NextResponse.json({ ok: true, task });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_task_delete",
    keySuffix: auth.user.id,
    limit: 120,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много удалений заданий. Попробуйте позже.");
  }

  const { taskId } = await params;
  const ok = await deleteTutorCustomTask(auth.user.id, taskId);
  if (!ok) {
    const response = NextResponse.json({ error: "Задание не найдено" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_delete_task",
    entityType: "tutor_task",
    entityId: taskId,
    metadata: { ownerId: auth.user.id },
  });

  const response = NextResponse.json({ ok: true });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
