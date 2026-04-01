import { NextResponse } from "next/server";

export function applyPublicCache(
  response: NextResponse,
  input: { maxAgeSec: number; sMaxAgeSec?: number; staleWhileRevalidateSec?: number },
) {
  const directives = [
    "public",
    `max-age=${Math.max(0, Math.floor(input.maxAgeSec))}`,
  ];
  if (typeof input.sMaxAgeSec === "number") {
    directives.push(`s-maxage=${Math.max(0, Math.floor(input.sMaxAgeSec))}`);
  }
  if (typeof input.staleWhileRevalidateSec === "number") {
    directives.push(
      `stale-while-revalidate=${Math.max(0, Math.floor(input.staleWhileRevalidateSec))}`,
    );
  }
  response.headers.set("cache-control", directives.join(", "));
}

export function applyPrivateCache(
  response: NextResponse,
  input: { maxAgeSec: number; staleWhileRevalidateSec?: number },
) {
  const directives = [
    "private",
    `max-age=${Math.max(0, Math.floor(input.maxAgeSec))}`,
  ];
  if (typeof input.staleWhileRevalidateSec === "number") {
    directives.push(
      `stale-while-revalidate=${Math.max(0, Math.floor(input.staleWhileRevalidateSec))}`,
    );
  }
  response.headers.set("cache-control", directives.join(", "));
}

