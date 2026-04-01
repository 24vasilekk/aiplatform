import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureTraceHeaders } from "./src/lib/request-trace";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const ids = ensureTraceHeaders(requestHeaders);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-request-id", ids.requestId);
  response.headers.set("x-correlation-id", ids.correlationId);
  response.headers.set("trace-id", ids.traceId);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
