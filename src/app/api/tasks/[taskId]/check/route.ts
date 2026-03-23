import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lessons } from "@/lib/mvp-data";
import { findCustomTaskById, saveTaskAttempt } from "@/lib/db";
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
  const customTask = task ? null : await findCustomTaskById(taskId);
  const resolvedTask = task ?? customTask;

  if (!resolvedTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const normalizedAnswer = parsed.data.answer.trim().toLowerCase();
  const normalizedExpected = resolvedTask.answer.trim().toLowerCase();
  const isCorrect = normalizedAnswer === normalizedExpected;

  try {
    await saveTaskAttempt({
      userId: auth.user.id,
      taskId,
      answerText: parsed.data.answer,
      isCorrect,
    });
  } catch {
    // Allow response even if persistence is unavailable (e.g., read-only serverless fs).
  }

  return NextResponse.json({
    taskId,
    isCorrect,
    solution: resolvedTask.solution,
  });
}
