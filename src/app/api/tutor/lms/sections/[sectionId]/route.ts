import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-auth";
import { createAdminAuditLog, deleteTutorCustomSection, updateTutorCustomSection } from "@/lib/db";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  title: z.string().trim().min(2),
});

async function authorize(request: NextRequest) {
  return requireRoles(request, ["tutor"]);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_section_patch",
    keySuffix: auth.user.id,
    limit: 140,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много обновлений разделов. Попробуйте позже.");
  }
  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const { sectionId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные раздела" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const section = await updateTutorCustomSection(auth.user.id, sectionId, parsed.data);
  if (!section) {
    const response = NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_update_section",
    entityType: "tutor_section",
    entityId: section.id,
    metadata: {
      ownerId: auth.user.id,
      title: section.title,
    },
  });

  const response = NextResponse.json({ ok: true, section });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "tutor_lms_section_delete",
    keySuffix: auth.user.id,
    limit: 90,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много удалений разделов. Попробуйте позже.");
  }

  const { sectionId } = await params;
  const ok = await deleteTutorCustomSection(auth.user.id, sectionId);
  if (!ok) {
    const response = NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "tutor_lms_delete_section",
    entityType: "tutor_section",
    entityId: sectionId,
    metadata: { ownerId: auth.user.id },
  });

  const response = NextResponse.json({ ok: true });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
