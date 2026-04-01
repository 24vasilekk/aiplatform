import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createAdminAuditLog, createCustomLesson, createServiceErrorLog, listCustomLessonsPaged } from "@/lib/db";

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
  return Math.max(1, Math.min(parsed, 1_000));
}

function parseSkip(value: string | null) {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

async function authorize(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return { error: auth.error, user: null };
  }

  if (auth.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), user: null };
  }

  return { error: null, user: auth.user };
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const take = parseTake(request.nextUrl.searchParams.get("take"));
  const skip = parseSkip(request.nextUrl.searchParams.get("skip"));
  const sectionId = request.nextUrl.searchParams.get("sectionId")?.trim() || undefined;
  const lessons = await listCustomLessonsPaged({ sectionId, take, skip });
  return NextResponse.json({
    items: lessons.rows,
    total: lessons.total,
    take: lessons.take,
    skip: lessons.skip,
  });
}

export async function POST(request: NextRequest) {
  const requestPath = new URL(request.url).pathname;
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные урока" }, { status: 400 });
  }

  try {
    const lesson = await createCustomLesson(parsed.data);
    await createAdminAuditLog({
      adminUserId: auth.user.id,
      action: "create_lesson",
      entityType: "lesson",
      entityId: lesson.id,
      metadata: {
        sectionId: lesson.sectionId,
        title: lesson.title,
      },
    });
    return NextResponse.json({ ok: true, lesson }, { status: 201 });
  } catch (error) {
    await createServiceErrorLog({
      route: requestPath,
      message: "Admin lesson creation failed",
      details: parsed.data,
      stack: error instanceof Error ? error.stack ?? null : null,
      userId: auth.user.id,
    });
    return NextResponse.json({ error: "Не удалось создать урок" }, { status: 500 });
  }
}
