import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTutorOrAdmin } from "@/lib/api-auth";
import { createTutorListing, listTutorListings } from "@/lib/tutor-market";
import { createAdminAuditLog } from "@/lib/db";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  name: z.string().trim().min(2),
  subject: z.enum(["math", "physics"]),
  pricePerHour: z.number().int().min(500).max(20000),
  rating: z.number().min(1).max(5),
  about: z.string().trim().min(10).max(800),
  city: z.string().trim().min(2).max(80),
  experienceYears: z.number().int().min(0).max(60),
});

export async function GET(request: NextRequest) {
  const auth = await requireTutorOrAdmin(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "admin_tutors_get",
    keySuffix: auth.user.id,
    limit: 220,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много запросов списка репетиторов. Попробуйте позже.");
  }

  const tutors = await listTutorListings();
  const response = NextResponse.json({ tutors });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

export async function POST(request: NextRequest) {
  const auth = await requireTutorOrAdmin(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "admin_tutors_post",
    keySuffix: auth.user.id,
    limit: 80,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много операций создания анкеты репетитора. Попробуйте позже.");
  }
  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные объявления" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const tutor = await createTutorListing(parsed.data);
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: auth.user.role === "admin" ? "create_tutor_listing" : "create_tutor_listing_by_tutor",
    entityType: "tutor_listing",
    entityId: tutor.id,
    metadata: {
      subject: tutor.subject,
      city: tutor.city,
      pricePerHour: tutor.pricePerHour,
    },
  });
  const response = NextResponse.json({ tutor }, { status: 201 });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
