import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { buildUserProgressSnapshot } from "@/lib/progress";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const snapshot = await buildUserProgressSnapshot(auth.user.id);
  return NextResponse.json(snapshot);
}

