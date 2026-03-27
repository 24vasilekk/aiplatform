import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getDemoPaidAccessSnapshot } from "@/lib/auth";
import { hasCourseAccess, listProgress } from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const progress = await listProgress(user.id);
  const paidSnapshot = await getDemoPaidAccessSnapshot();

  const courses = await listAllCourses();
  const items = await Promise.all(
    courses.map(async (course) => ({
      ...course,
      hasAccess:
        paidSnapshot.all ||
        paidSnapshot.courseIds.includes(course.id) ||
        (await hasCourseAccess(user.id, course.id)),
    })),
  );

  return (
    <section className="space-y-4">
      <h1>Личный кабинет</h1>
      <p className="text-sm text-slate-700">Пользователь: {user.email}</p>
      <p className="text-sm text-slate-700">Просмотрено уроков: {progress.filter((item) => item.status === "completed").length}</p>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((course) => (
          <article key={course.id} className="card-soft card-soft-hover flex h-full flex-col p-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-sky-700">{course.subject}</p>
              <h2>{course.title}</h2>
              <p className="text-sm text-slate-700">{course.description}</p>
            </div>
            <p className="mt-4 text-sm">Прогресс: {course.progress}%</p>
            {course.hasAccess ? (
              <Link href={`/courses/${course.id}`} className="btn-primary mt-auto inline-flex w-fit">
                Открыть курс
              </Link>
            ) : (
              <Link href="/pricing" className="btn-ghost mt-auto inline-flex w-fit">
                Открыть доступ
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
