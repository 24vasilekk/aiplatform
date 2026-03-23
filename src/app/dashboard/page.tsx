import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasDemoPaidAccess } from "@/lib/auth";
import { hasCourseAccess, listProgress } from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const progress = await listProgress(user.id);
  const paidByCookie = await hasDemoPaidAccess();

  const courses = await listAllCourses();
  const items = await Promise.all(
    courses.map(async (course) => ({
      ...course,
      hasAccess: paidByCookie || (await hasCourseAccess(user.id, course.id)),
    })),
  );

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Личный кабинет</h1>
      <p className="text-sm text-slate-600">Пользователь: {user.email}</p>
      <p className="text-sm text-slate-600">Просмотрено уроков: {progress.filter((item) => item.status === "completed").length}</p>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((course) => (
          <article key={course.id} className="rounded-xl border border-sky-200 bg-white p-4 shadow-[0_2px_10px_rgba(14,165,233,0.08)]">
            <p className="text-xs uppercase tracking-wide text-sky-700">{course.subject}</p>
            <h2 className="text-lg font-semibold">{course.title}</h2>
            <p className="mb-3 text-sm text-slate-600">{course.description}</p>
            <p className="mb-3 text-sm">Прогресс: {course.progress}%</p>
            {course.hasAccess ? (
              <Link href={`/courses/${course.id}`} className="btn-primary inline-block">
                Открыть курс
              </Link>
            ) : (
              <Link href="/pricing" className="btn-ghost inline-block">
                Открыть доступ
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
