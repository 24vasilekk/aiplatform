import { notFound, redirect } from "next/navigation";
import { getCurrentUser, hasDemoPaidAccess } from "@/lib/auth";
import { hasCourseAccess } from "@/lib/db";
import { LessonWorkspace } from "@/components/lesson-workspace";
import { getCatalogLessonById, getCourseIdByLessonId } from "@/lib/course-catalog";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { lessonId } = await params;
  const lesson = await getCatalogLessonById(lessonId);

  if (!lesson) {
    notFound();
  }

  const courseId = await getCourseIdByLessonId(lessonId);
  if (!courseId) {
    notFound();
  }

  const paidByCookie = await hasDemoPaidAccess(courseId);
  const access = user.role === "admin" ? true : paidByCookie || (await hasCourseAccess(user.id, courseId));
  if (!access && user.role !== "admin") {
    redirect("/pricing");
  }

  return (
    <section className="space-y-3">
      <article className="space-y-3">
        <h1>{lesson.title}</h1>
        <p className="text-slate-700">{lesson.description}</p>
        <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-black">
          <iframe
            src={lesson.videoUrl}
            title={lesson.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <LessonWorkspace lessonId={lesson.id} tasks={lesson.tasks} />
      </article>
    </section>
  );
}
