import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { saveLessonProgress } from "@/lib/db";

const schema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]).default("in_progress"),
  lastPositionSec: z.number().int().nonnegative().default(0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
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

  return NextResponse.json({ ok: true, lessonId });
}
