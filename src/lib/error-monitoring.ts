import { createServiceErrorLog } from "@/lib/db";

export type ErrorSeverity = "warn" | "error" | "fatal";

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }
  return {
    name: "UnknownError",
    message: String(error),
    stack: null,
  };
}

function shouldAlert(severity: ErrorSeverity) {
  return severity === "error" || severity === "fatal";
}

async function notifyCriticalFailure(input: {
  severity: ErrorSeverity;
  route?: string;
  message: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  details?: Record<string, unknown>;
}) {
  if (!shouldAlert(input.severity)) return;

  const webhookUrl = process.env.CRITICAL_ALERT_WEBHOOK_URL?.trim() || "";
  const payload = {
    service: process.env.SERVICE_NAME ?? "ege-mvp",
    env: process.env.NODE_ENV ?? "development",
    severity: input.severity,
    route: input.route ?? null,
    message: input.message,
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    traceId: input.traceId ?? null,
    timestamp: new Date().toISOString(),
    details: input.details ?? null,
  };

  if (!webhookUrl) {
    console.error(JSON.stringify({ type: "critical_alert", ...payload }));
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    console.error(JSON.stringify({ type: "critical_alert_failed", ...payload }));
  }
}

export async function reportServerError(input: {
  route?: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  userId?: string;
  message: string;
  error?: unknown;
  severity?: ErrorSeverity;
  details?: Record<string, unknown>;
}) {
  const severity = input.severity ?? "error";
  const normalized = normalizeError(input.error);

  await createServiceErrorLog({
    route: input.route,
    requestId: input.requestId,
    userId: input.userId,
    level: severity,
    message: input.message || normalized.message,
    stack: normalized.stack,
    details: {
      correlationId: input.correlationId ?? null,
      traceId: input.traceId ?? null,
      errorName: normalized.name,
      errorMessage: normalized.message,
      ...(input.details ?? {}),
    },
  });

  await notifyCriticalFailure({
    severity,
    route: input.route,
    message: input.message || normalized.message,
    requestId: input.requestId,
    correlationId: input.correlationId,
    traceId: input.traceId,
    details: {
      errorName: normalized.name,
      ...(input.details ?? {}),
    },
  });
}
