import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-auth";
import { createAdminAuditLog, deleteTutorCustomLesson, updateTutorCustomLesson } from "@/lib/db";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().trim().min(5).optional(),
  videoUrl: z.string().trim().url().optional(),
});

async function authorize(request: NextRequest) {
  return requireRoles(request, ["tutor"]);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ lessonId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_lesson_patch",
    keySuffix: auth.user.id,
    limit: 140,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много обновлений уроков. Попробуйте позже.");
  }
  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const { lessonId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные урока" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const lesson = await updateTutorCustomLesson(auth.user.id, lessonId, parsed.data);
  if (!lesson) {
    const response = NextResponse.json({ error: "Урок не найден" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_update_lesson",
    entityType: "tutor_lesson",
    entityId: lesson.id,
    metadata: {
      ownerId: auth.user.id,
      ...parsed.data,
    },
  });

  const response = NextResponse.json({ ok: true, lesson });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ lessonId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_lesson_delete",
    keySuffix: auth.user.id,
    limit: 100,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много удалений уроков. Попробуйте позже.");
  }

  const { lessonId } = await params;
  const ok = await deleteTutorCustomLesson(auth.user.id, lessonId);
  if (!ok) {
    const response = NextResponse.json({ error: "Урок не найден" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_delete_lesson",
    entityType: "tutor_lesson",
    entityId: lessonId,
    metadata: { ownerId: auth.user.id },
  });

  const response = NextResponse.json({ ok: true });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
