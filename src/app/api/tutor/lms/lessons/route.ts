import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-auth";
import { createAdminAuditLog, createTutorCustomLesson, listTutorCustomLessonsPaged } from "@/lib/db";
import { applyPrivateCache } from "@/lib/http-cache";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  sectionId: z.string().trim().min(1),
  title: z.string().trim().min(2),
  description: z.string().trim().min(5),
  videoUrl: z.string().trim().url(),
});

function parseTake(value: string | null) {
  if (!value) return 400;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 400;
  return Math.max(1, Math.min(parsed, 1000));
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
    namespace: "tutor_lms_lessons_get",
    keySuffix: auth.user.id,
    limit: 300,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много запросов списка уроков. Попробуйте позже.");
  }

  const params = new URL(request.url).searchParams;
  const take = parseTake(params.get("take"));
  const skip = parseSkip(params.get("skip"));
  const sectionId = params.get("sectionId")?.trim() || undefined;
  const lessons = await listTutorCustomLessonsPaged(auth.user.id, { sectionId, take, skip });

  const response = NextResponse.json({
    items: lessons.rows,
    total: lessons.total,
    take: lessons.take,
    skip: lessons.skip,
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
    namespace: "tutor_lms_lessons_post",
    keySuffix: auth.user.id,
    limit: 100,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много операций создания уроков. Попробуйте позже.");
  }
  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные урока" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const lesson = await createTutorCustomLesson(auth.user.id, parsed.data);
  if (!lesson) {
    const response = NextResponse.json({ error: "Раздел не найден или недоступен" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_create_lesson",
    entityType: "tutor_lesson",
    entityId: lesson.id,
    metadata: {
      ownerId: auth.user.id,
      sectionId: lesson.sectionId,
      title: lesson.title,
    },
  });

  const response = NextResponse.json({ ok: true, lesson }, { status: 201 });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
