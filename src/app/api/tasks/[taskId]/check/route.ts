import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lessons } from "@/lib/mvp-data";
import { saveTaskAttempt } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";

const schema = z.object({
  answer: z.string().trim().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const { taskId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Введите ответ" }, { status: 400 });
  }

  const task = lessons.flatMap((lesson) => lesson.tasks).find((item) => item.id === taskId);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isCorrect = parsed.data.answer === task.answer;

  await saveTaskAttempt({
    userId: auth.user.id,
    taskId,
    answerText: parsed.data.answer,
    isCorrect,
  });

  return NextResponse.json({
    taskId,
    isCorrect,
    solution: task.solution,
  });
}
