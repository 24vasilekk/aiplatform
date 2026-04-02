import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-auth";
import { createAdminAuditLog, createTutorCustomCourse, listTutorCustomCoursesPaged } from "@/lib/db";
import { applyPrivateCache } from "@/lib/http-cache";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(10),
  subject: z.enum(["math", "physics"]),
});

function parseTake(value: string | null) {
  if (!value) return 200;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 200;
  return Math.max(1, Math.min(parsed, 500));
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
  if (auth.error || !auth.user) {
    return auth.error;
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_courses_get",
    keySuffix: auth.user.id,
    limit: 240,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много запросов списка курсов. Попробуйте позже.");
  }

  const params = new URL(request.url).searchParams;
  const take = parseTake(params.get("take"));
  const skip = parseSkip(params.get("skip"));
  const courses = await listTutorCustomCoursesPaged(auth.user.id, { take, skip });

  const response = NextResponse.json({
    items: courses.rows,
    total: courses.total,
    take: courses.take,
    skip: courses.skip,
  });
  applyPrivateCache(response, { maxAgeSec: 10, staleWhileRevalidateSec: 30 });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_courses_post",
    keySuffix: auth.user.id,
    limit: 80,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много операций создания курсов. Попробуйте позже.");
  }
  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные курса" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const course = await createTutorCustomCourse(auth.user.id, parsed.data);
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_create_course",
    entityType: "tutor_course",
    entityId: course.id,
    metadata: {
      ownerId: auth.user.id,
      subject: course.subject,
      title: course.title,
    },
  });

  const response = NextResponse.json({ ok: true, course }, { status: 201 });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
