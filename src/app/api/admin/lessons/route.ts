import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createCustomLesson, listCustomLessons } from "@/lib/db";

const schema = z.object({
  sectionId: z.string().trim().min(1),
  title: z.string().trim().min(2),
  description: z.string().trim().min(5),
  videoUrl: z.string().trim().url(),
});

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

  const lessons = await listCustomLessons();
  return NextResponse.json(lessons);
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные урока" }, { status: 400 });
  }

  const lesson = await createCustomLesson(parsed.data);
  return NextResponse.json({ ok: true, lesson }, { status: 201 });
}
