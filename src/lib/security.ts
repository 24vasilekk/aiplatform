import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  key: string;
  namespace: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
};

type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
};

function getStore() {
  const globalWithStore = globalThis as typeof globalThis & {
    __egeRateLimitStore?: Map<string, RateLimitEntry>;
  };

  if (!globalWithStore.__egeRateLimitStore) {
    globalWithStore.__egeRateLimitStore = new Map<string, RateLimitEntry>();
  }

  return globalWithStore.__egeRateLimitStore;
}

export function getClientIpFromHeaders(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const candidate = forwardedFor
      .split(",")
      .map((item) => item.trim())
      .find(Boolean);
    if (candidate) return candidate;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  return "unknown";
}

export function consumeRateLimit(input: RateLimitInput): RateLimitResult {
  const now = input.nowMs ?? Date.now();
  const windowMs = Math.max(1_000, input.windowMs);
  const limit = Math.max(1, input.limit);
  const key = `${input.namespace}:${input.key}`;
  const store = getStore();

  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      ok: true,
      limit,
      remaining: limit - 1,
      resetAt,
      retryAfterSec: Math.ceil(windowMs / 1_000),
    };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1_000)),
    };
  }

  const nextCount = existing.count + 1;
  store.set(key, { ...existing, count: nextCount });
  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - nextCount),
    resetAt: existing.resetAt,
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1_000)),
  };
}

export function applyRateLimitHeaders(response: NextResponse, result: RateLimitResult) {
  response.headers.set("x-ratelimit-limit", String(result.limit));
  response.headers.set("x-ratelimit-remaining", String(result.remaining));
  response.headers.set("x-ratelimit-reset", String(Math.ceil(result.resetAt / 1_000)));
  if (!result.ok) {
    response.headers.set("retry-after", String(result.retryAfterSec));
  }
}

export function createRateLimitResponse(result: RateLimitResult, message = "Слишком много запросов") {
  const response = NextResponse.json(
    { error: message, code: "rate_limited", retryAfterSec: result.retryAfterSec },
    { status: 429 },
  );
  applyRateLimitHeaders(response, result);
  return response;
}

export function hasJsonContentType(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json");
}

export function rateLimitByRequest(input: {
  request: Request;
  namespace: string;
  keySuffix?: string | null;
  limit: number;
  windowMs: number;
}) {
  const ip = getClientIpFromHeaders(input.request.headers);
  const key = input.keySuffix ? `${ip}:${input.keySuffix}` : ip;
  return consumeRateLimit({
    namespace: input.namespace,
    key,
    limit: input.limit,
    windowMs: input.windowMs,
  });
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function sanitizeRedirectPath(candidate: string | null | undefined) {
  if (!candidate) return null;
  const value = candidate.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("\r") || value.includes("\n")) return null;
  if (value.startsWith("/api/auth/")) return null;
  return value;
}
