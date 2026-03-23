import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { deleteCustomCourse, updateCustomCourse } from "@/lib/db";

const schema = z.object({
  title: z.string().trim().min(3).optional(),
  description: z.string().trim().min(10).optional(),
  subject: z.enum(["math", "physics"]).optional(),
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
  { params }: { params: Promise<{ courseId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const { courseId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные курса" }, { status: 400 });
  }

  const course = await updateCustomCourse(courseId, parsed.data);
  if (!course) {
    return NextResponse.json({ error: "Курс не найден" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, course });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const { courseId } = await params;
  const ok = await deleteCustomCourse(courseId);

  if (!ok) {
    return NextResponse.json({ error: "Курс не найден" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
