function generateHex(bytes: number) {
  const alphabet = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < bytes * 2; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function parseTraceparent(traceparent: string | null) {
  if (!traceparent) return null;
  const parts = traceparent.trim().split("-");
  if (parts.length < 4) return null;
  const traceId = parts[1];
  if (!/^[0-9a-f]{32}$/.test(traceId)) return null;
  return traceId;
}

export function ensureTraceHeaders(headers: Headers) {
  const requestId = headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const correlationId = headers.get("x-correlation-id")?.trim() || requestId;

  const existingTraceparent = headers.get("traceparent");
  const traceId = parseTraceparent(existingTraceparent) ?? generateHex(16);
  const spanId = generateHex(8);
  const traceparent = `00-${traceId}-${spanId}-01`;

  headers.set("x-request-id", requestId);
  headers.set("x-correlation-id", correlationId);
  headers.set("traceparent", traceparent);

  return {
    requestId,
    correlationId,
    traceId,
    spanId,
    traceparent,
  };
}
