import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { listUsersPaged } from "@/lib/db";

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

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const take = parseTake(request.nextUrl.searchParams.get("take"));
  const skip = parseSkip(request.nextUrl.searchParams.get("skip"));
  const query = request.nextUrl.searchParams.get("q")?.trim() || undefined;

  const users = await listUsersPaged({
    role: "student",
    query,
    take,
    skip,
  });

  return NextResponse.json(
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
}
