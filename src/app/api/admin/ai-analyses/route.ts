import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { listAiSolutionAnalysesPaged } from "@/lib/db";

function sanitizeQuery(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = sanitizeQuery(searchParams.get("userId"));
  const taskId = sanitizeQuery(searchParams.get("taskId"));
  const lessonId = sanitizeQuery(searchParams.get("lessonId"));
  const mode = sanitizeQuery(searchParams.get("mode"));
  const status = sanitizeQuery(searchParams.get("status"));
  const takeRaw = Number(searchParams.get("take") ?? "50");
  const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(Math.floor(takeRaw), 200)) : 50;
  const skipRaw = Number(searchParams.get("skip") ?? "0");
  const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(Math.floor(skipRaw), 10_000)) : 0;

  const analyses = await listAiSolutionAnalysesPaged({
    userId,
    taskId,
    lessonId,
    mode: mode === "default" || mode === "beginner" || mode === "similar_task" ? mode : undefined,
    status:
      status === "queued" || status === "running" || status === "completed" || status === "failed"
        ? status
        : undefined,
    take,
    skip,
  });

  return NextResponse.json({
    items: analyses.rows,
    total: analyses.total,
    take: analyses.take,
    skip: analyses.skip,
  });
}
