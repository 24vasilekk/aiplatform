import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";
import {
  createAdminAuditLog,
  findAdminAuditLogByIdempotencyKey,
  findUserById,
  grantCourseAccess,
  listCourseAccess,
} from "@/lib/db";

const schema = z.object({
  userId: z.string().trim().min(3),
  courseId: z.string().trim().min(2),
  accessType: z.enum(["trial", "subscription", "purchase"]).default("subscription"),
  expiresAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const rateLimit = rateLimitByRequest({
    request,
    namespace: "admin_users_access_post",
    keySuffix: auth.user.id,
    limit: 120,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много операций выдачи доступа. Попробуйте позже.");
  }
  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные доступа" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const idempotencyKey =
    parsed.data.idempotencyKey ??
    request.headers.get("x-idempotency-key")?.trim() ??
    `admin_access_${auth.user.id}_${crypto.randomUUID()}`;

  const dedupe = await findAdminAuditLogByIdempotencyKey({
    action: "grant_course_access",
    entityType: "course_access",
    entityId: `${parsed.data.userId}:${parsed.data.courseId}`,
    idempotencyKey,
  });
  if (dedupe) {
    const accesses = await listCourseAccess(parsed.data.userId);
    const access = accesses.find((item) => item.courseId === parsed.data.courseId) ?? null;
    const response = NextResponse.json({ ok: true, deduplicated: true, access });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const user = await findUserById(parsed.data.userId);
  if (!user) {
    const response = NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  if (expiresAt && !Number.isFinite(expiresAt.getTime())) {
    const response = NextResponse.json({ error: "Неверная дата истечения" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await grantCourseAccess(
    parsed.data.userId,
    parsed.data.courseId,
    parsed.data.accessType,
    expiresAt,
  );
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "grant_course_access",
    entityType: "course_access",
    entityId: `${parsed.data.userId}:${parsed.data.courseId}`,
    metadata: {
      userId: parsed.data.userId,
      courseId: parsed.data.courseId,
      accessType: parsed.data.accessType,
      expiresAt: expiresAt?.toISOString() ?? null,
      idempotencyKey,
    },
  });

  const accesses = await listCourseAccess(parsed.data.userId);
  const access = accesses.find((item) => item.courseId === parsed.data.courseId) ?? null;
  const response = NextResponse.json({
    ok: true,
    deduplicated: false,
    access,
  });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
