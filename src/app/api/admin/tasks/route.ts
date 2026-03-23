import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createCustomTask, listCustomTasks } from "@/lib/db";

const schema = z
  .object({
    lessonId: z.string().trim().min(1),
    type: z.enum(["numeric", "choice"]),
    question: z.string().trim().min(5),
    options: z.array(z.string().trim().min(1)).optional(),
    answer: z.string().trim().min(1),
    solution: z.string().trim().min(5),
  })
  .superRefine((value, ctx) => {
    if (value.type === "choice" && (!value.options || value.options.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для выбора нужно минимум 2 варианта",
        path: ["options"],
      });
    }
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

  const tasks = await listCustomTasks();
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные задания" }, { status: 400 });
  }

  const task = await createCustomTask({
    lessonId: parsed.data.lessonId,
    type: parsed.data.type,
    question: parsed.data.question,
    options: parsed.data.type === "choice" ? parsed.data.options ?? [] : null,
    answer: parsed.data.answer,
    solution: parsed.data.solution,
  });

  return NextResponse.json({ ok: true, task }, { status: 201 });
}
