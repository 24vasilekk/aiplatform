import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { grantCourseAccess } from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";
import { DEMO_PAID_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  let savedInDb = true;
  try {
    const courses = await listAllCourses();
    await Promise.all(
      courses.map((course) => grantCourseAccess(auth.user!.id, course.id, "subscription")),
    );
  } catch {
    savedInDb = false;
  }

  const response = NextResponse.json({
    ok: true,
    message: savedInDb
      ? "Демо-оплата прошла успешно. Доступ к курсам открыт."
      : "Демо-оплата активирована через cookie. Для постоянного хранения подключите внешнюю БД.",
  });

  response.cookies.set(DEMO_PAID_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
