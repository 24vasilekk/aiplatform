import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createAdminAuditLog, createCustomCourse, listCustomCoursesPaged } from "@/lib/db";

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
  const courses = await listCustomCoursesPaged({ take, skip });
  return NextResponse.json({
    items: courses.rows,
    total: courses.total,
    take: courses.take,
    skip: courses.skip,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные курса" }, { status: 400 });
  }

  const course = await createCustomCourse(parsed.data);
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "create_course",
    entityType: "course",
    entityId: course.id,
    metadata: {
      subject: course.subject,
      title: course.title,
    },
  });
  return NextResponse.json({ ok: true, course }, { status: 201 });
}
