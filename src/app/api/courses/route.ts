import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { hasCourseAccess } from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";

export async function GET(request: NextRequest) {
  const { user } = await requireUser(request);
  const courses = await listAllCourses();

  const data = await Promise.all(
    courses.map(async (course) => ({
      ...course,
      hasAccess: user ? await hasCourseAccess(user.id, course.id) : false,
    })),
  );

  return NextResponse.json(data);
}
