import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lessons } from "@/lib/mvp-data";
import { createAnalyticsEvent, findCustomTaskById, saveTaskAttempt } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";
import { syncCompletedCourseLoyalty } from "@/lib/loyalty";

const schema = z.object({
  answer: z.string().trim().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const requestPath = new URL(request.url).pathname;
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const { taskId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Введите ответ" }, { status: 400 });
  }

  const staticLesson = lessons.find((lesson) => lesson.tasks.some((item) => item.id === taskId));
  const task = staticLesson?.tasks.find((item) => item.id === taskId) ?? null;
  const customTask = task ? null : await findCustomTaskById(taskId);
  const resolvedTask = task ?? customTask;
  const resolvedLessonId = staticLesson?.id ?? customTask?.lessonId ?? null;

  if (!resolvedTask || !resolvedLessonId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (customTask && customTask.status !== "published" && auth.user.role !== "admin") {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const normalizedAnswer = parsed.data.answer.trim().toLowerCase();
  const normalizedExpected = resolvedTask.answer.trim().toLowerCase();
  const isCorrect = normalizedAnswer === normalizedExpected;

  try {
    await saveTaskAttempt({
      userId: auth.user.id,
      taskId,
      lessonId: resolvedLessonId,
      answerText: parsed.data.answer,
      isCorrect,
    });
    await createAnalyticsEvent({
      eventName: "task_checked",
      userId: auth.user.id,
      path: requestPath,
      payload: {
        taskId,
        lessonId: resolvedLessonId,
        isCorrect,
      },
    });
    await syncCompletedCourseLoyalty(auth.user.id);
  } catch {
    // Allow response even if persistence is unavailable (e.g., read-only serverless fs).
  }

  return NextResponse.json({
    taskId,
    isCorrect,
    solution: resolvedTask.solution,
  });
}
