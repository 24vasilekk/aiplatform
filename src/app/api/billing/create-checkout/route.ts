import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { grantCourseAccess } from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";
import { DEMO_PAID_COOKIE, DEMO_PAID_COURSES_COOKIE } from "@/lib/auth";

const schema = z.object({
  planId: z.enum(["math_only", "bundle_2", "all_access"]).default("all_access"),
  email: z.email().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные оплаты" }, { status: 400 });
  }

  const { planId } = parsed.data;
  const allCourses = await listAllCourses();

  const planCourseIds =
    planId === "math_only"
      ? ["math-base"]
      : planId === "bundle_2"
        ? ["math-base", "physics-base"]
        : allCourses.map((course) => course.id);

  let savedInDb = true;
  try {
    await Promise.all(
      planCourseIds.map((courseId) => grantCourseAccess(auth.user!.id, courseId, "subscription")),
    );
  } catch {
    savedInDb = false;
  }

  const planLabel =
    planId === "math_only"
      ? "Курс по математике"
      : planId === "bundle_2"
        ? "Пакет 1+1 (математика + физика)"
        : "Доступ ко всем курсам";

  const response = NextResponse.json({
    ok: true,
    message: savedInDb
      ? `Демо-оплата: ${planLabel}. Доступ открыт.`
      : `Демо-оплата: ${planLabel}. Доступ сохранен через cookie (без внешней БД).`,
  });

  if (planId === "all_access") {
    response.cookies.set(DEMO_PAID_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set(DEMO_PAID_COURSES_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  } else {
    response.cookies.set(DEMO_PAID_COOKIE, "0", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set(DEMO_PAID_COURSES_COOKIE, planCourseIds.join(","), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}
