import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getWalletSnapshot } from "@/lib/db";
import { observeRequest } from "@/lib/observability";

function parseTake(value: string | null) {
  if (!value) return 30;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(parsed, 200));
}

export async function GET(request: NextRequest) {
  return observeRequest({
    request,
    operation: "wallet.get",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) {
        return auth.error;
      }

      const take = parseTake(request.nextUrl.searchParams.get("take"));
      const snapshot = await getWalletSnapshot(auth.user.id, take);

      return NextResponse.json(snapshot);
    },
  });
}
