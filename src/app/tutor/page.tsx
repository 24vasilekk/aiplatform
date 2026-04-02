import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  listTutorCustomCoursesPaged,
  listTutorCustomLessonsPaged,
  listTutorCustomSectionsPaged,
  listTutorCustomTasksPaged,
} from "@/lib/db";
import { TutorLmsManager } from "@/components/tutor-lms-manager";

export default async function TutorPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.role !== "tutor") {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
        Доступ только для роли tutor.
      </section>
    );
  }

  const courses = await listTutorCustomCoursesPaged(user.id, { take: 500, skip: 0 });
  const sections = await listTutorCustomSectionsPaged(user.id, { take: 700, skip: 0 });
  const lessons = await listTutorCustomLessonsPaged(user.id, { take: 1000, skip: 0 });
  const tasks = await listTutorCustomTasksPaged(user.id, { take: 1200, skip: 0 });

  return (
    <TutorLmsManager
      initialCourses={courses.rows}
      initialSections={sections.rows}
      initialLessons={lessons.rows}
      initialTasks={tasks.rows}
    />
  );
}
