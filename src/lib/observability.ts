import { NextResponse } from "next/server";
import { ensureTraceHeaders } from "@/lib/request-trace";

type LogLevel = "debug" | "info" | "warn" | "error";

type RequestContext = {
  requestId: string;
  correlationId: string;
  traceId: string;
  spanId: string;
  method: string;
  path: string;
  userAgent: string | null;
  ip: string | null;
};

type ObserveParams<T extends Response> = {
  request: Request;
  operation: string;
  handler: (ctx: RequestContext) => Promise<T>;
};

type RequestMetricState = {
  startedAt: string;
  total: number;
  active: number;
  completed: number;
  errors: number;
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
  durationMs: {
    sum: number;
    max: number;
    avg: number;
  };
};

type ServiceMetricsSnapshot = {
  service: string;
  env: string;
  timestamp: string;
  process: {
    uptimeSec: number;
    memoryRssBytes: number;
    memoryHeapUsedBytes: number;
    memoryHeapTotalBytes: number;
    cpuUserMicros: number;
    cpuSystemMicros: number;
  };
  requests: RequestMetricState;
};

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getConfiguredLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel) {
  const current = getConfiguredLogLevel();
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[current];
}

function getClientIp(request: Request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? null;
}

function toRequestContext(request: Request): RequestContext {
  const headers = new Headers(request.headers);
  const ids = ensureTraceHeaders(headers);
  const { pathname } = new URL(request.url);
  return {
    requestId: ids.requestId,
    correlationId: ids.correlationId,
    traceId: ids.traceId,
    spanId: ids.spanId,
    method: request.method,
    path: pathname,
    userAgent: request.headers.get("user-agent"),
    ip: getClientIp(request),
  };
}

function safeSerialize(payload: Record<string, unknown>) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({
      level: "error",
      message: "log_serialize_failed",
      timestamp: new Date().toISOString(),
    });
  }
}

export function log(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: process.env.SERVICE_NAME ?? "ege-mvp",
    env: process.env.NODE_ENV ?? "development",
    ...extra,
  };

  const line = safeSerialize(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function getMetricStore() {
  const globalWithMetrics = globalThis as typeof globalThis & {
    __egeServiceMetrics?: {
      startedAt: number;
      total: number;
      active: number;
      completed: number;
      errors: number;
      byMethod: Record<string, number>;
      byStatus: Record<string, number>;
      durationSumMs: number;
      durationMaxMs: number;
    };
  };

  if (!globalWithMetrics.__egeServiceMetrics) {
    globalWithMetrics.__egeServiceMetrics = {
      startedAt: Date.now(),
      total: 0,
      active: 0,
      completed: 0,
      errors: 0,
      byMethod: {},
      byStatus: {},
      durationSumMs: 0,
      durationMaxMs: 0,
    };
  }

  return globalWithMetrics.__egeServiceMetrics;
}

function recordRequestStart(method: string) {
  const store = getMetricStore();
  store.total += 1;
  store.active += 1;
  store.byMethod[method] = (store.byMethod[method] ?? 0) + 1;
}

function recordRequestEnd(status: number, durationMs: number) {
  const store = getMetricStore();
  store.active = Math.max(0, store.active - 1);
  store.completed += 1;
  if (status >= 500) {
    store.errors += 1;
  }
  const statusGroup = `${Math.floor(status / 100)}xx`;
  store.byStatus[statusGroup] = (store.byStatus[statusGroup] ?? 0) + 1;
  store.durationSumMs += durationMs;
  store.durationMaxMs = Math.max(store.durationMaxMs, durationMs);
}

function attachTraceHeaders(response: Response, ctx: RequestContext) {
  response.headers.set("x-request-id", ctx.requestId);
  response.headers.set("x-correlation-id", ctx.correlationId);
  response.headers.set("trace-id", ctx.traceId);
  return response;
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }
  return { message: String(error) };
}

export async function observeRequest<T extends Response>({ request, operation, handler }: ObserveParams<T>) {
  const ctx = toRequestContext(request);
  const startedAt = Date.now();
  recordRequestStart(ctx.method);

  log("info", "request.start", {
    operation,
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    method: ctx.method,
    path: ctx.path,
    ip: ctx.ip,
  });

  try {
    const response = await handler(ctx);
    const durationMs = Date.now() - startedAt;
    recordRequestEnd(response.status, durationMs);

    log("info", "request.finish", {
      operation,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      method: ctx.method,
      path: ctx.path,
      status: response.status,
      durationMs,
    });

    return attachTraceHeaders(response, ctx) as T;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    recordRequestEnd(500, durationMs);

    log("error", "request.error", {
      operation,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      method: ctx.method,
      path: ctx.path,
      status: 500,
      durationMs,
      error: sanitizeError(error),
    });

    try {
      const { reportServerError } = await import("@/lib/error-monitoring");
      await reportServerError({
        route: ctx.path,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        traceId: ctx.traceId,
        message: error instanceof Error ? error.message : "Unhandled server error",
        error,
        details: {
          operation,
          method: ctx.method,
          durationMs,
        },
      });
    } catch {
      // Prevent recursive failures in the fallback error path.
    }

    const response = NextResponse.json(
      {
        error: "Internal server error",
        requestId: ctx.requestId,
      },
      { status: 500 },
    );
    return attachTraceHeaders(response, ctx) as T;
  }
}

export function getServiceMetricsSnapshot(): ServiceMetricsSnapshot {
  const store = getMetricStore();
  const runtimeProcess = (globalThis as typeof globalThis & {
    process?: {
      uptime?: () => number;
      cpuUsage?: () => { user: number; system: number };
      memoryUsage?: () => { rss: number; heapUsed: number; heapTotal: number };
      env?: Record<string, string | undefined>;
    };
  }).process;

  const cpu = runtimeProcess?.cpuUsage?.() ?? { user: 0, system: 0 };
  const memory = runtimeProcess?.memoryUsage?.() ?? { rss: 0, heapUsed: 0, heapTotal: 0 };
  const uptimeSec = Math.max(0, Math.floor(runtimeProcess?.uptime?.() ?? 0));
  const avg = store.completed > 0 ? store.durationSumMs / store.completed : 0;

  return {
    service: process.env.SERVICE_NAME ?? "ege-mvp",
    env: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
    process: {
      uptimeSec,
      memoryRssBytes: memory.rss,
      memoryHeapUsedBytes: memory.heapUsed,
      memoryHeapTotalBytes: memory.heapTotal,
      cpuUserMicros: cpu.user,
      cpuSystemMicros: cpu.system,
    },
    requests: {
      startedAt: new Date(store.startedAt).toISOString(),
      total: store.total,
      active: store.active,
      completed: store.completed,
      errors: store.errors,
      byMethod: { ...store.byMethod },
      byStatus: { ...store.byStatus },
      durationMs: {
        sum: Number(store.durationSumMs.toFixed(2)),
        max: Number(store.durationMaxMs.toFixed(2)),
        avg: Number(avg.toFixed(2)),
      },
    },
  };
}

export function toPrometheusMetrics(snapshot: ServiceMetricsSnapshot) {
  const lines: string[] = [];

  lines.push("# HELP service_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE service_uptime_seconds gauge");
  lines.push(`service_uptime_seconds ${snapshot.process.uptimeSec}`);

  lines.push("# HELP service_requests_total Total HTTP requests observed");
  lines.push("# TYPE service_requests_total counter");
  lines.push(`service_requests_total ${snapshot.requests.total}`);

  lines.push("# HELP service_requests_active Active in-flight HTTP requests");
  lines.push("# TYPE service_requests_active gauge");
  lines.push(`service_requests_active ${snapshot.requests.active}`);

  lines.push("# HELP service_request_errors_total Total HTTP requests finished with 5xx");
  lines.push("# TYPE service_request_errors_total counter");
  lines.push(`service_request_errors_total ${snapshot.requests.errors}`);

  lines.push("# HELP service_request_duration_ms_avg Average HTTP request duration in ms");
  lines.push("# TYPE service_request_duration_ms_avg gauge");
  lines.push(`service_request_duration_ms_avg ${snapshot.requests.durationMs.avg}`);

  for (const [method, count] of Object.entries(snapshot.requests.byMethod)) {
    lines.push(`service_requests_by_method_total{method=\"${method}\"} ${count}`);
  }

  for (const [statusGroup, count] of Object.entries(snapshot.requests.byStatus)) {
    lines.push(`service_requests_by_status_total{status_group=\"${statusGroup}\"} ${count}`);
  }

  return lines.join("\n") + "\n";
}
