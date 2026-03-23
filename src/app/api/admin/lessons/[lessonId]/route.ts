import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { deleteCustomLesson, updateCustomLesson } from "@/lib/db";

const schema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().trim().min(5).optional(),
  videoUrl: z.string().trim().url().optional(),
});

async function authorize(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return { error: auth.error };
  }

  if (auth.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { error: null };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const { lessonId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные урока" }, { status: 400 });
  }

  const lesson = await updateCustomLesson(lessonId, parsed.data);
  if (!lesson) {
    return NextResponse.json({ error: "Урок не найден" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lesson });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const { lessonId } = await params;
  const ok = await deleteCustomLesson(lessonId);

  if (!ok) {
    return NextResponse.json({ error: "Урок не найден" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
