import { NextResponse } from "next/server";
import { listTutorListings } from "@/lib/tutor-market";

export async function GET() {
  try {
    const tutors = await listTutorListings();
    return NextResponse.json({ tutors });
  } catch {
    return NextResponse.json({ tutors: [] });
  }
}
