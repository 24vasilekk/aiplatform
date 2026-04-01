import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { observeRequest } from "@/lib/observability";
import { ReadOps } from "@/lib/read-ops";

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

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  if (!endOfDay) return date;
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

export async function GET(request: NextRequest) {
  return observeRequest({
    request,
    operation: "admin.errors.list",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) return auth.error;
      if (auth.user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const params = request.nextUrl.searchParams;
      const rows = await ReadOps.listServiceErrorLogs({
        level:
          params.get("level") === "debug" ||
          params.get("level") === "info" ||
          params.get("level") === "warn" ||
          params.get("level") === "error" ||
          params.get("level") === "fatal"
            ? (params.get("level") as "debug" | "info" | "warn" | "error" | "fatal")
            : undefined,
        route: params.get("route")?.trim() || undefined,
        requestId: params.get("requestId")?.trim() || undefined,
        userId: params.get("userId")?.trim() || undefined,
        from: parseDate(params.get("from"), false),
        to: parseDate(params.get("to"), true),
        take: parseTake(params.get("take")),
        skip: parseSkip(params.get("skip")),
      });

      return NextResponse.json({
        items: rows.rows,
        total: rows.total,
      });
    },
  });
}
