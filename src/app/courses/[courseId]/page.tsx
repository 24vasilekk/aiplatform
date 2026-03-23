import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, hasDemoPaidAccess } from "@/lib/auth";
import { hasCourseAccess } from "@/lib/db";
import {
  getCatalogCourseById,
  listLessonsBySectionId,
  listSectionsByCourseId,
} from "@/lib/course-catalog";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { courseId } = await params;
  const course = await getCatalogCourseById(courseId);

  if (!course) {
    notFound();
  }

  const paidByCookie = await hasDemoPaidAccess();
  const access =
    user.role === "admin" ? true : paidByCookie || (await hasCourseAccess(user.id, course.id));
  if (!access && user.role !== "admin") {
    redirect("/pricing");
  }

  const courseSections = await listSectionsByCourseId(course.id);
  const sectionItems = await Promise.all(
    courseSections.map(async (section) => ({
      section,
      lessons: await listLessonsBySectionId(section.id),
    })),
  );

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{course.title}</h1>
      <p className="text-slate-600">{course.description}</p>

      {courseSections.length === 0 ? (
        <article className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Для этого курса разделы и уроки пока не добавлены.
        </article>
      ) : null}

      {sectionItems.map(({ section, lessons }) => (
        <article key={section.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">{section.title}</h2>
          <ul className="space-y-2">
            {lessons.map((lesson) => {
              return (
                <li
                  key={lesson.id}
                  className="flex flex-col gap-2 rounded-md border border-slate-100 p-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{lesson.title}</p>
                    <p className="text-sm text-slate-600">{lesson.description}</p>
                  </div>
                  <Link href={`/lessons/${lesson.id}`} className="btn-primary inline-block self-start sm:self-auto">
                    Открыть урок
                  </Link>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </section>
  );
}
