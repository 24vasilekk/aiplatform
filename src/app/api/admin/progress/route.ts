import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { listUsersPaged } from "@/lib/db";
import { buildUserProgressSnapshot } from "@/lib/progress";

function parseTake(value: string | null) {
  if (!value) return 20;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(parsed, 100));
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = request.nextUrl.searchParams.get("userId")?.trim() || null;
  if (userId) {
    const snapshot = await buildUserProgressSnapshot(userId);
    return NextResponse.json({ snapshots: [snapshot], take: 1 });
  }

  const take = parseTake(request.nextUrl.searchParams.get("take"));
  const users = await listUsersPaged({
    role: "student",
    take,
    skip: 0,
  });

  const snapshots = await Promise.all(users.rows.map((user) => buildUserProgressSnapshot(user.id)));
  return NextResponse.json({
    snapshots: snapshots.map((snapshot, index) => ({
      ...snapshot,
      user: {
        id: users.rows[index].id,
        email: users.rows[index].email,
        createdAt: users.rows[index].createdAt,
      },
    })),
    take,
    total: users.total,
  });
}
