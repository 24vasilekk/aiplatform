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

  const paidByCookie = await hasDemoPaidAccess(course.id);
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
      <h1>{course.title}</h1>
      <p className="text-slate-700">{course.description}</p>

      {courseSections.length === 0 ? (
        <article className="card-soft p-6 text-sm text-slate-700">
          Для этого курса разделы и уроки пока не добавлены.
        </article>
      ) : null}

      {sectionItems.map(({ section, lessons }) => (
        <article key={section.id} className="card-soft p-6">
          <h2>{section.title}</h2>
          <ul className="mt-4 space-y-3">
            {lessons.map((lesson) => {
              return (
                <li
                  key={lesson.id}
                  className="card-soft card-soft-hover flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-2">
                    <p className="font-medium">{lesson.title}</p>
                    <p className="text-sm text-slate-700">{lesson.description}</p>
                  </div>
                  <Link href={`/lessons/${lesson.id}`} className="btn-primary inline-flex self-start sm:self-auto">
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
