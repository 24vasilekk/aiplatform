import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-auth";
import { createAdminAuditLog, createTutorCustomSection, listTutorCustomSectionsPaged } from "@/lib/db";
import { applyPrivateCache } from "@/lib/http-cache";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  courseId: z.string().trim().min(1),
  title: z.string().trim().min(2),
});

function parseTake(value: string | null) {
  if (!value) return 300;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 300;
  return Math.max(1, Math.min(parsed, 700));
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
    namespace: "tutor_lms_sections_get",
    keySuffix: auth.user.id,
    limit: 260,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много запросов списка разделов. Попробуйте позже.");
  }

  const params = new URL(request.url).searchParams;
  const take = parseTake(params.get("take"));
  const skip = parseSkip(params.get("skip"));
  const courseId = params.get("courseId")?.trim() || undefined;
  const sections = await listTutorCustomSectionsPaged(auth.user.id, { courseId, take, skip });

  const response = NextResponse.json({
    items: sections.rows,
    total: sections.total,
    take: sections.take,
    skip: sections.skip,
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
    namespace: "tutor_lms_sections_post",
    keySuffix: auth.user.id,
    limit: 100,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много операций создания разделов. Попробуйте позже.");
  }
  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные раздела" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const section = await createTutorCustomSection(auth.user.id, parsed.data);
  if (!section) {
    const response = NextResponse.json({ error: "Курс не найден или недоступен" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_create_section",
    entityType: "tutor_section",
    entityId: section.id,
    metadata: {
      ownerId: auth.user.id,
      courseId: section.courseId,
      title: section.title,
    },
  });

  const response = NextResponse.json({ ok: true, section }, { status: 201 });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
