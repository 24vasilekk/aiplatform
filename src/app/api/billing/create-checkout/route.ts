import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { grantCourseAccess } from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  try {
    const courses = await listAllCourses();
    await Promise.all(
      courses.map((course) => grantCourseAccess(auth.user!.id, course.id, "subscription")),
    );

    return NextResponse.json({
      ok: true,
      message: "Демо-оплата прошла успешно. Доступ к курсам открыт.",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Не удалось сохранить оплату в текущем окружении. Для Vercel нужна внешняя БД (Neon/Supabase/Postgres).",
      },
      { status: 500 },
    );
  }
}
