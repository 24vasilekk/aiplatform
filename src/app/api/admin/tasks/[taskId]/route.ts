import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createAdminAuditLog, deleteCustomTask, updateCustomTask } from "@/lib/db";

const schema = z
  .object({
    lessonId: z.string().trim().min(1).optional(),
    type: z.enum(["numeric", "choice"]).optional(),
    status: z.enum(["published", "unpublished", "archived"]).optional(),
    question: z.string().trim().min(5).optional(),
    options: z.array(z.string().trim().min(1)).optional().nullable(),
    answer: z.string().trim().min(1).optional(),
    solution: z.string().trim().min(5).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    topicTags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    exemplarSolution: z.string().trim().min(5).max(10000).optional().nullable(),
    evaluationCriteria: z.array(z.string().trim().min(3).max(400)).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "choice" && value.options && value.options.length < 2) {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;

  const { taskId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные задания" }, { status: 400 });
  }

  const nextData = {
    ...parsed.data,
    options:
      parsed.data.type === "numeric"
        ? null
        : parsed.data.options === undefined
          ? undefined
          : parsed.data.options,
  };

  const task = await updateCustomTask(taskId, nextData);
  if (!task) {
    return NextResponse.json({ error: "Задание не найдено" }, { status: 404 });
  }
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "update_task",
    entityType: "task",
    entityId: task.id,
    metadata: nextData,
  });

  return NextResponse.json({ ok: true, task });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;

  const { taskId } = await params;
  const ok = await deleteCustomTask(taskId);

  if (!ok) {
    return NextResponse.json({ error: "Задание не найдено" }, { status: 404 });
  }
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "delete_task",
    entityType: "task",
    entityId: taskId,
  });

  return NextResponse.json({ ok: true });
}
