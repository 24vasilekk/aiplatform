import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { bulkUpdateCustomTaskStatus, createAdminAuditLog } from "@/lib/db";

const schema = z.object({
  taskIds: z.array(z.string().trim().min(1)).min(1).max(300),
  action: z.enum(["publish", "unpublish", "archive"]),
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

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные массового действия" }, { status: 400 });
  }

  const status =
    parsed.data.action === "archive"
      ? "archived"
      : parsed.data.action === "unpublish"
        ? "unpublished"
        : "published";

  const result = await bulkUpdateCustomTaskStatus({
    taskIds: Array.from(new Set(parsed.data.taskIds)),
    status,
  });
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "bulk_update_task_status",
    entityType: "task",
    metadata: {
      action: parsed.data.action,
      status,
      updated: result.count,
      taskCount: parsed.data.taskIds.length,
    },
  });

  return NextResponse.json({
    ok: true,
    updated: result.count,
    status,
  });
}
