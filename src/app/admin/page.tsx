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
  () => import("@/components/admin-finance-product-dashboard").then((mod) => mod.AdminFinanceProductDashboard),
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
const AdminLoyaltyManager = dynamic(
  () => import("@/components/admin-loyalty-manager").then((mod) => mod.AdminLoyaltyManager),
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

  let customCourses: PagedResult<CustomCourseRecord> = { rows: [], total: 0, take: 120, skip: 0 };
  let customSections: PagedResult<CustomSectionRecord> = { rows: [], total: 0, take: 180, skip: 0 };
  let customLessons: PagedResult<CustomLessonRecord> = { rows: [], total: 0, take: 240, skip: 0 };
  let customTasks: PagedResult<CustomTaskRecord> = { rows: [], total: 0, take: 320, skip: 0 };
  let users: PagedResult<UserRecord> = { rows: [], total: 0, take: 100, skip: 0 };
  let posts: PostRecord[] = [];

  const settled = await Promise.allSettled([
    listCustomCoursesPaged({ take: 120, skip: 0 }),
    listCustomSectionsPaged({ take: 180, skip: 0 }),
    listCustomLessonsPaged({ take: 240, skip: 0 }),
    listCustomTasksPaged({ take: 320, skip: 0 }),
    listUsersPaged({ take: 100, skip: 0 }),
    listPosts(),
  ] as const);

  if (settled[0].status === "fulfilled") customCourses = settled[0].value;
  else degradedMode = true;
  if (settled[1].status === "fulfilled") customSections = settled[1].value;
  else degradedMode = true;
  if (settled[2].status === "fulfilled") customLessons = settled[2].value;
  else degradedMode = true;
  if (settled[3].status === "fulfilled") customTasks = settled[3].value;
  else degradedMode = true;
  if (settled[4].status === "fulfilled") users = settled[4].value;
  else degradedMode = true;
  if (settled[5].status === "fulfilled") posts = settled[5].value;
  else degradedMode = true;
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
      <AdminLoyaltyManager />
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
