import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createAdminAuditLog, createCustomSection, listCustomSectionsPaged } from "@/lib/db";

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
  const courseId = request.nextUrl.searchParams.get("courseId")?.trim() || undefined;
  const sections = await listCustomSectionsPaged({ courseId, take, skip });
  return NextResponse.json({
    items: sections.rows,
    total: sections.total,
    take: sections.take,
    skip: sections.skip,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные раздела" }, { status: 400 });
  }

  const section = await createCustomSection(parsed.data);
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "create_section",
    entityType: "section",
    entityId: section.id,
    metadata: {
      courseId: section.courseId,
      title: section.title,
    },
  });
  return NextResponse.json({ ok: true, section }, { status: 201 });
}
