import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createAdminAuditLog, createCustomTask, createServiceErrorLog, listCustomTasksPaged } from "@/lib/db";

const schema = z
  .object({
    lessonId: z.string().trim().min(1),
    type: z.enum(["numeric", "choice"]),
    status: z.enum(["published", "unpublished", "archived"]).default("published"),
    question: z.string().trim().min(5),
    options: z.array(z.string().trim().min(1)).optional(),
    answer: z.string().trim().min(1),
    solution: z.string().trim().min(5),
    difficulty: z.number().int().min(1).max(5).default(2),
    topicTags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
    exemplarSolution: z.string().trim().min(5).max(10000).optional().nullable(),
    evaluationCriteria: z.array(z.string().trim().min(3).max(400)).max(20).default([]),
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

function parseTake(value: string | null) {
  if (!value) return 500;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 500;
  return Math.max(1, Math.min(parsed, 1_200));
}

function parseSkip(value: string | null) {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

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

  const take = parseTake(request.nextUrl.searchParams.get("take"));
  const skip = parseSkip(request.nextUrl.searchParams.get("skip"));
  const lessonId = request.nextUrl.searchParams.get("lessonId")?.trim() || undefined;
  const statusRaw = request.nextUrl.searchParams.get("status");
  const status =
    statusRaw === "published" || statusRaw === "unpublished" || statusRaw === "archived"
      ? statusRaw
      : undefined;
  const tasks = await listCustomTasksPaged({ lessonId, status, take, skip });
  return NextResponse.json({
    items: tasks.rows,
    total: tasks.total,
    take: tasks.take,
    skip: tasks.skip,
  });
}

export async function POST(request: NextRequest) {
  const requestPath = new URL(request.url).pathname;
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные задания" }, { status: 400 });
  }

  try {
    const task = await createCustomTask({
      lessonId: parsed.data.lessonId,
      type: parsed.data.type,
      status: parsed.data.status,
      question: parsed.data.question,
      options: parsed.data.type === "choice" ? parsed.data.options ?? [] : null,
      answer: parsed.data.answer,
      solution: parsed.data.solution,
      difficulty: parsed.data.difficulty,
      topicTags: parsed.data.topicTags,
      exemplarSolution: parsed.data.exemplarSolution ?? null,
      evaluationCriteria: parsed.data.evaluationCriteria,
    });

    await createAdminAuditLog({
      adminUserId: auth.user.id,
      action: "create_task",
      entityType: "task",
      entityId: task.id,
      metadata: {
        lessonId: task.lessonId,
        type: task.type,
        status: task.status,
        difficulty: task.difficulty,
      },
    });

    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (error) {
    await createServiceErrorLog({
      route: requestPath,
      message: "Admin task creation failed",
      details: {
        lessonId: parsed.data.lessonId,
        type: parsed.data.type,
        status: parsed.data.status,
      },
      stack: error instanceof Error ? error.stack ?? null : null,
      userId: auth.user.id,
    });
    return NextResponse.json({ error: "Не удалось создать задание" }, { status: 500 });
  }
}
