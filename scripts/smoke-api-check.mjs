import process from "node:process";

const baseUrl = process.env.SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3000";

async function checkJson(pathname, expectedStatus) {
  const url = `${baseUrl}${pathname}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (response.status !== expectedStatus) {
    const text = await response.text();
    throw new Error(`Smoke check failed for ${pathname}: expected ${expectedStatus}, got ${response.status}. Body: ${text}`);
  }

  const data = await response.json().catch(() => null);
  if (!data || typeof data !== "object") {
    throw new Error(`Smoke check failed for ${pathname}: response is not valid JSON`);
  }
  return data;
}

async function main() {
  const health = await checkJson("/api/health", 200);
  if (health.status !== "ok") {
    throw new Error(`Smoke check failed for /api/health: expected status=ok, got ${String(health.status)}`);
  }

  const readiness = await checkJson("/api/readiness", 200);
  if (readiness.status === "maintenance" || readiness.status === "not_ready") {
    throw new Error(
      `Smoke check failed for /api/readiness: service is not ready (${String(readiness.status)})`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: {
          health: health.status,
          readiness: readiness.status,
          compatibility: readiness.compatibility ?? "unknown",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
