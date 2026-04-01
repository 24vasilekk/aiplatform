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
  type CustomCourseRecord,
  type CustomLessonRecord,
  type CustomSectionRecord,
  type CustomTaskRecord,
  type PagedResult,
  type PostRecord,
  type UserRecord,
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

  let degradedMode = false;

  let customCourses: PagedResult<CustomCourseRecord> = { rows: [], total: 0, take: 500, skip: 0 };
  let customSections: PagedResult<CustomSectionRecord> = { rows: [], total: 0, take: 700, skip: 0 };
  let customLessons: PagedResult<CustomLessonRecord> = { rows: [], total: 0, take: 1_000, skip: 0 };
  let customTasks: PagedResult<CustomTaskRecord> = { rows: [], total: 0, take: 1_200, skip: 0 };
  let users: PagedResult<UserRecord> = { rows: [], total: 0, take: 300, skip: 0 };
  let posts: PostRecord[] = [];

  try {
    customCourses = await listCustomCoursesPaged({ take: 500, skip: 0 });
  } catch {
    degradedMode = true;
  }
  try {
    customSections = await listCustomSectionsPaged({ take: 700, skip: 0 });
  } catch {
    degradedMode = true;
  }
  try {
    customLessons = await listCustomLessonsPaged({ take: 1_000, skip: 0 });
  } catch {
    degradedMode = true;
  }
  try {
    customTasks = await listCustomTasksPaged({ take: 1_200, skip: 0 });
  } catch {
    degradedMode = true;
  }
  try {
    users = await listUsersPaged({ role: "student", take: 300, skip: 0 });
  } catch {
    degradedMode = true;
  }
  try {
    posts = await listPosts();
  } catch {
    degradedMode = true;
  }
  const catalogCourses = await listAllCourses();

  return (
    <section className="space-y-4">
      <h1>Админ-панель (MVP)</h1>
      {degradedMode ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Часть admin-виджетов работает в fallback-режиме. Проверьте применение миграций БД.
        </p>
      ) : null}
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
