import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { applyPrivateCache } from "@/lib/http-cache";
import {
  createAdminAuditLog,
  findAdminAuditLogByIdempotencyKey,
  findUserById,
  listUsersPaged,
  updateUserRole,
} from "@/lib/db";

function parseTake(value: string | null) {
  if (!value) return 100;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(parsed, 500));
}

function parseSkip(value: string | null) {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

const roleMutationSchema = z.object({
  userId: z.string().trim().min(3),
  role: z.enum(["student", "tutor"]),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const params = new URL(request.url).searchParams;
  const take = parseTake(params.get("take"));
  const skip = parseSkip(params.get("skip"));
  const query = params.get("q")?.trim() || undefined;
  const roleFilter = params.get("role");
  const role = roleFilter === "student" || roleFilter === "tutor" || roleFilter === "admin" ? roleFilter : undefined;

  const users = await listUsersPaged({
    role,
    query,
    take,
    skip,
  });

  const response = NextResponse.json(
    {
      items: users.rows.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      })),
      total: users.total,
      take: users.take,
      skip: users.skip,
    },
  );
  applyPrivateCache(response, { maxAgeSec: 10, staleWhileRevalidateSec: 30 });
  return response;
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const parsed = roleMutationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные роли" }, { status: 400 });
  }

  const idempotencyKey =
    parsed.data.idempotencyKey ??
    request.headers.get("x-idempotency-key")?.trim() ??
    `admin_user_role_${auth.user.id}_${crypto.randomUUID()}`;

  const existingOperation = await findAdminAuditLogByIdempotencyKey({
    action: "set_user_role",
    entityType: "user_role",
    entityId: parsed.data.userId,
    idempotencyKey,
  });
  if (existingOperation) {
    const current = await findUserById(parsed.data.userId);
    return NextResponse.json({
      ok: true,
      deduplicated: true,
      user: current ? { id: current.id, email: current.email, role: current.role, createdAt: current.createdAt } : null,
    });
  }

  const current = await findUserById(parsed.data.userId);
  if (!current) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (current.role === "admin") {
    return NextResponse.json({ error: "Нельзя менять роль администратора" }, { status: 400 });
  }

  const updated = current.role === parsed.data.role ? current : await updateUserRole(parsed.data.userId, parsed.data.role);

  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "set_user_role",
    entityType: "user_role",
    entityId: parsed.data.userId,
    metadata: {
      previousRole: current.role,
      newRole: parsed.data.role,
      idempotencyKey,
      deduplicatedByState: current.role === parsed.data.role,
    },
  });

  return NextResponse.json({
    ok: true,
    deduplicated: current.role === parsed.data.role,
    user: {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
    },
  });
}
