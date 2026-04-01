import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { analyzeExpandedSolutionMvp } from "@/lib/ai-solution-analysis";
import { createAiSolutionAnalysis, createAnalyticsEvent, createServiceErrorLog } from "@/lib/db";
import {
  aiAnalysisInputSchema,
  type AiAnalysisError,
  type AiAnalysisFailedResponse,
} from "@/types/ai-solution-analysis";
import { applyRateLimitHeaders, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

function validationErrorResponse(details: string): NextResponse<AiAnalysisFailedResponse> {
  return NextResponse.json(
    {
      ok: false,
      status: "failed",
      error: {
        code: "validation_error",
        message: "Неверный формат запроса для AI-анализа.",
        retryable: false,
        details,
      },
    },
    { status: 400 },
  );
}

function unauthorizedResponse(): NextResponse<AiAnalysisFailedResponse> {
  return NextResponse.json(
    {
      ok: false,
      status: "failed",
      error: {
        code: "unauthorized",
        message: "Требуется авторизация.",
        retryable: false,
      },
    },
    { status: 401 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return unauthorizedResponse();
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "ai-solution-analyze",
    keySuffix: auth.user.id,
    limit: 30,
    windowMs: 10 * 60 * 1_000,
  });
  if (!rateLimit.ok) {
    const payload: AiAnalysisFailedResponse = {
      ok: false,
      status: "failed",
      error: {
        code: "rate_limited",
        message: "Слишком много AI-запросов. Попробуйте позже.",
        retryable: true,
        details: `retryAfterSec=${rateLimit.retryAfterSec}`,
      },
    };
    const response = NextResponse.json(payload, { status: 429 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  if (!hasJsonContentType(request)) {
    const payload: AiAnalysisFailedResponse = {
      ok: false,
      status: "failed",
      error: {
        code: "validation_error",
        message: "Неверный формат запроса для AI-анализа.",
        retryable: false,
        details: "Content-Type must be application/json.",
      },
    };
    const response = NextResponse.json(payload, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const requestId = crypto.randomUUID();
  const startedAt = new Date();
  const requestPath = new URL(request.url).pathname;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const response = validationErrorResponse("JSON body is required.");
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = aiAnalysisInputSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const details = issue ? `${issue.path.join(".") || "root"}: ${issue.message}` : "Validation failed.";
    const response = validationErrorResponse(details);
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const input = parsed.data;
  console.info("[ai.solution.analyze] started", {
    requestId,
    userId: auth.user.id,
    lessonId: input.lessonId ?? null,
    taskId: input.taskId ?? null,
    mode: input.mode,
    questionChars: input.questionText.length,
    solutionChars: input.studentSolutionText.length,
    criteriaCount: input.officialCriteria.length,
  });

  try {
    const { result, model } = await analyzeExpandedSolutionMvp(input);
    const finishedAt = new Date();
    const latencyMs = finishedAt.getTime() - startedAt.getTime();
    const saved = await createAiSolutionAnalysis({
      userId: auth.user.id,
      lessonId: input.lessonId,
      taskId: input.taskId,
      mode: input.mode,
      status: "completed",
      inputPayload: input,
      resultPayload: result,
      model,
      latencyMs,
      completedAt: finishedAt,
    });

    console.info("[ai.solution.analyze] completed", {
      requestId,
      userId: auth.user.id,
      recordId: saved.id,
      verdict: result.verdict,
      scorePercent: result.scorePercent,
      latencyMs,
      model,
    });

    await createAnalyticsEvent({
      eventName: "ai_solution_analyzed",
      userId: auth.user.id,
      path: requestPath,
      payload: {
        status: "completed",
        mode: input.mode,
        taskId: input.taskId ?? null,
        lessonId: input.lessonId ?? null,
        scorePercent: result.scorePercent,
        latencyMs,
      },
    });

    const response = NextResponse.json(
      {
        ok: true,
        status: "completed",
        data: {
          id: saved.id,
          status: "completed",
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
          completedAt: saved.completedAt ?? finishedAt.toISOString(),
          lessonId: saved.lessonId ?? undefined,
          taskId: saved.taskId ?? undefined,
          mode: saved.mode,
          model: saved.model ?? undefined,
          latencyMs: saved.latencyMs ?? latencyMs,
          result,
        },
      },
      { status: 200 },
    );
    applyRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error) {
    const finishedAt = new Date();
    const latencyMs = finishedAt.getTime() - startedAt.getTime();
    const details = error instanceof Error ? error.message : "Unknown error";
    const errorPayload: AiAnalysisError = {
      code: "internal_error",
      message: "Не удалось выполнить AI-анализ решения.",
      retryable: true,
      details,
    };

    let savedId: string | null = null;
    try {
      const saved = await createAiSolutionAnalysis({
        userId: auth.user.id,
        lessonId: input.lessonId,
        taskId: input.taskId,
        mode: input.mode,
        status: "failed",
        inputPayload: input,
        errorPayload,
        latencyMs,
      });
      savedId = saved.id;
    } catch {
      // Keep response resilient even if DB persistence failed.
    }

    console.error("[ai.solution.analyze] failed", {
      requestId,
      userId: auth.user.id,
      recordId: savedId,
      latencyMs,
      details,
    });

    await createAnalyticsEvent({
      eventName: "ai_solution_analyzed",
      userId: auth.user.id,
      path: requestPath,
      payload: {
        status: "failed",
        mode: input.mode,
        taskId: input.taskId ?? null,
        lessonId: input.lessonId ?? null,
        latencyMs,
      },
    });
    await createServiceErrorLog({
      route: requestPath,
      message: "AI solution analyze failed",
      details: {
        requestId,
        userId: auth.user.id,
        taskId: input.taskId ?? null,
        lessonId: input.lessonId ?? null,
        mode: input.mode,
      },
      stack: error instanceof Error ? error.stack ?? null : null,
      requestId,
      userId: auth.user.id,
      level: "error",
    });

    const response = NextResponse.json(
      {
        ok: false,
        status: "failed",
        error: errorPayload,
        data: {
          id: savedId ?? requestId,
          status: "failed",
          createdAt: startedAt.toISOString(),
          updatedAt: finishedAt.toISOString(),
        },
      },
      { status: 500 },
    );
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }
}
