import { NextResponse } from "next/server";
import { listTutorListings } from "@/lib/tutor-market";
import { applyPublicCache } from "@/lib/http-cache";

export async function GET() {
  try {
    const tutors = await listTutorListings();
    const response = NextResponse.json({ tutors });
    applyPublicCache(response, {
      maxAgeSec: 60,
      sMaxAgeSec: 300,
      staleWhileRevalidateSec: 600,
    });
    return response;
  } catch {
    const response = NextResponse.json({ tutors: [] });
    applyPublicCache(response, {
      maxAgeSec: 30,
      sMaxAgeSec: 120,
      staleWhileRevalidateSec: 300,
    });
    return response;
  }
}
