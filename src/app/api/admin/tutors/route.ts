import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createTutorListing, listTutorListings } from "@/lib/tutor-market";

const schema = z.object({
  name: z.string().trim().min(2),
  subject: z.enum(["math", "physics"]),
  pricePerHour: z.number().int().min(500).max(20000),
  rating: z.number().min(1).max(5),
  about: z.string().trim().min(10).max(800),
  city: z.string().trim().min(2).max(80),
  experienceYears: z.number().int().min(0).max(60),
});

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tutors = await listTutorListings();
  return NextResponse.json({ tutors });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные объявления" }, { status: 400 });
  }

  const tutor = await createTutorListing(parsed.data);
  return NextResponse.json({ tutor }, { status: 201 });
}
