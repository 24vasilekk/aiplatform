import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createAnalyticsEvent, saveLessonProgress } from "@/lib/db";
import { syncCompletedCourseLoyalty } from "@/lib/loyalty";

const schema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]).default("in_progress"),
  lastPositionSec: z.number().int().nonnegative().default(0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const requestPath = new URL(request.url).pathname;
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const { lessonId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await saveLessonProgress({
    userId: auth.user.id,
    lessonId,
    status: parsed.data.status,
    lastPositionSec: parsed.data.lastPositionSec,
  });

  await createAnalyticsEvent({
    eventName: "lesson_progress_updated",
    userId: auth.user.id,
    path: requestPath,
    payload: {
      lessonId,
      status: parsed.data.status,
      lastPositionSec: parsed.data.lastPositionSec,
    },
  });

  try {
    await syncCompletedCourseLoyalty(auth.user.id);
  } catch {
    // Loyalty synchronization should not block progress API.
  }

  return NextResponse.json({ ok: true, lessonId });
}
