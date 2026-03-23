import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { hasCourseAccess } from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";
import { DEMO_PAID_COOKIE } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user } = await requireUser(request);
  const courses = await listAllCourses();
  const paidByCookie = request.cookies.get(DEMO_PAID_COOKIE)?.value === "1";

  const data = await Promise.all(
    courses.map(async (course) => ({
      ...course,
      hasAccess: paidByCookie || (user ? await hasCourseAccess(user.id, course.id) : false),
    })),
  );

  return NextResponse.json(data);
}
