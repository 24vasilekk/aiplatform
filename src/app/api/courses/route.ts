import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { hasCourseAccess } from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";
import { DEMO_PAID_COOKIE, DEMO_PAID_COURSES_COOKIE } from "@/lib/auth";
import { applyPrivateCache } from "@/lib/http-cache";

export async function GET(request: NextRequest) {
  const { user } = await requireUser(request);
  const courses = await listAllCourses();
  const paidByCookie = request.cookies.get(DEMO_PAID_COOKIE)?.value === "1";
  const paidCoursesByCookie = (request.cookies.get(DEMO_PAID_COURSES_COOKIE)?.value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const data = await Promise.all(
    courses.map(async (course) => ({
      ...course,
      hasAccess:
        paidByCookie ||
        paidCoursesByCookie.includes(course.id) ||
        (user ? await hasCourseAccess(user.id, course.id) : false),
    })),
  );

  const response = NextResponse.json(data);
  response.headers.set("vary", "cookie");
  applyPrivateCache(response, {
    maxAgeSec: 30,
    staleWhileRevalidateSec: 120,
  });
  return response;
}
