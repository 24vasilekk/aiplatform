import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-auth";
import { createAdminAuditLog, deleteTutorCustomCourse, updateTutorCustomCourse } from "@/lib/db";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  title: z.string().trim().min(3).optional(),
  description: z.string().trim().min(10).optional(),
  subject: z.enum(["math", "physics"]).optional(),
});

async function authorize(request: NextRequest) {
  return requireRoles(request, ["tutor"]);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_course_patch",
    keySuffix: auth.user.id,
    limit: 120,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много обновлений курса. Попробуйте позже.");
  }
  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const { courseId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные курса" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const course = await updateTutorCustomCourse(auth.user.id, courseId, parsed.data);
  if (!course) {
    const response = NextResponse.json({ error: "Курс не найден" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_update_course",
    entityType: "tutor_course",
    entityId: course.id,
    metadata: {
      ownerId: auth.user.id,
      ...parsed.data,
    },
  });

  const response = NextResponse.json({ ok: true, course });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_course_delete",
    keySuffix: auth.user.id,
    limit: 80,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много удалений курса. Попробуйте позже.");
  }

  const { courseId } = await params;
  const ok = await deleteTutorCustomCourse(auth.user.id, courseId);
  if (!ok) {
    const response = NextResponse.json({ error: "Курс не найден" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_delete_course",
    entityType: "tutor_course",
    entityId: courseId,
    metadata: { ownerId: auth.user.id },
  });

  const response = NextResponse.json({ ok: true });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
