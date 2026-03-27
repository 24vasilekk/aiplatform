import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminCourseManager } from "@/components/admin-course-manager";
import {
  listCustomCourses,
  listCustomLessons,
  listCustomSections,
  listCustomTasks,
  listUsers,
} from "@/lib/db";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
        Доступ запрещен. Войдите под админом (email <code>admin@ege.local</code>).
      </section>
    );
  }

  const customCourses = await listCustomCourses();
  const customSections = await listCustomSections();
  const customLessons = await listCustomLessons();
  const customTasks = await listCustomTasks();
  const users = await listUsers();

  return (
    <section className="space-y-4">
      <h1>Админ-панель (MVP)</h1>
      <AdminCourseManager
        initialCourses={customCourses}
        initialSections={customSections}
        initialLessons={customLessons}
        initialTasks={customTasks}
        initialUsers={users.map((item) => ({ id: item.id, email: item.email, role: item.role, createdAt: item.createdAt }))}
      />
    </section>
  );
}
