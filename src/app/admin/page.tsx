import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getCurrentUser } from "@/lib/auth";
import {
  listCustomCoursesPaged,
  listCustomLessonsPaged,
  listCustomSectionsPaged,
  listCustomTasksPaged,
  listUsersPaged,
  listPosts,
} from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";

const AdminAnalyticsWidget = dynamic(
  () => import("@/components/admin-analytics-widget").then((mod) => mod.AdminAnalyticsWidget),
);
const AdminFinanceProductDashboard = dynamic(
  () =>
    import("@/components/admin-finance-product-dashboard").then((mod) => mod.AdminFinanceProductDashboard),
);
const AdminPurchasesAnalytics = dynamic(
  () => import("@/components/admin-purchases-analytics").then((mod) => mod.AdminPurchasesAnalytics),
);
const AdminErrorMonitor = dynamic(
  () => import("@/components/admin-error-monitor").then((mod) => mod.AdminErrorMonitor),
);
const AdminWalletManager = dynamic(
  () => import("@/components/admin-wallet-manager").then((mod) => mod.AdminWalletManager),
);
const AdminCourseManager = dynamic(
  () => import("@/components/admin-course-manager").then((mod) => mod.AdminCourseManager),
);
const AdminBlogManager = dynamic(
  () => import("@/components/admin-blog-manager").then((mod) => mod.AdminBlogManager),
);
const AdminTutorManager = dynamic(
  () => import("@/components/admin-tutor-manager").then((mod) => mod.AdminTutorManager),
);

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

  const customCourses = await listCustomCoursesPaged({ take: 500, skip: 0 });
  const customSections = await listCustomSectionsPaged({ take: 700, skip: 0 });
  const customLessons = await listCustomLessonsPaged({ take: 1_000, skip: 0 });
  const customTasks = await listCustomTasksPaged({ take: 1_200, skip: 0 });
  const users = await listUsersPaged({ role: "student", take: 300, skip: 0 });
  const posts = await listPosts();
  const catalogCourses = await listAllCourses();

  return (
    <section className="space-y-4">
      <h1>Админ-панель (MVP)</h1>
      <AdminAnalyticsWidget />
      <AdminFinanceProductDashboard days={30} />
      <AdminPurchasesAnalytics
        courseOptions={catalogCourses.map((course) => ({ id: course.id, title: course.title }))}
      />
      <AdminErrorMonitor />
      <AdminWalletManager />
      <AdminCourseManager
        initialCourses={customCourses.rows}
        initialSections={customSections.rows}
        initialLessons={customLessons.rows}
        initialTasks={customTasks.rows}
        initialUsers={users.rows.map((item) => ({ id: item.id, email: item.email, role: item.role, createdAt: item.createdAt }))}
      />
      <AdminBlogManager initialPosts={posts} />
      <AdminTutorManager />
    </section>
  );
}
