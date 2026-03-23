import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createCustomCourse, listCustomCourses } from "@/lib/db";

const schema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(10),
  subject: z.enum(["math", "physics"]),
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

  const courses = await listCustomCourses();
  return NextResponse.json(courses);
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
  return NextResponse.json({ ok: true, course }, { status: 201 });
}
