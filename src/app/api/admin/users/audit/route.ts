import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  findUserById,
  getWalletSnapshot,
  listAiSolutionAnalyses,
  listAnalyticsEvents,
  listCourseAccess,
  listUsersPaged,
  listAdminPayments,
  type AnalyticsEventName,
} from "@/lib/db";
import { buildUserProgressSnapshot } from "@/lib/progress";
import { listAllCourses } from "@/lib/course-catalog";

const EVENT_NAMES = [
  "login_success",
  "login_failed",
  "registration_success",
  "blog_post_view",
  "blog_post_share",
  "site_page_view",
  "dashboard_view",
  "course_page_view",
  "lesson_page_view",
  "pricing_page_view",
  "lesson_progress_updated",
  "task_checked",
  "ai_chat_message",
  "ai_solution_analyzed",
  "checkout_created",
  "payment_succeeded",
  "payment_failed",
  "payment_canceled",
] as const satisfies ReadonlyArray<AnalyticsEventName>;

function parseTake(value: string | null, fallback: number, max: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
}

function parseSkip(value: string | null, fallback = 0, max = 20_000) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(parsed, max));
}

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  if (!endOfDay) return date;
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

function parseEventName(value: string | null): AnalyticsEventName | undefined {
  if (!value || value === "all") return undefined;
  return EVENT_NAMES.find((eventName) => eventName === value);
}

function normalizeQuery(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "";
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const params = request.nextUrl.searchParams;
  const query = normalizeQuery(params.get("q"));
  const userId = normalizeQuery(params.get("userId"));
  const from = parseDate(params.get("from"), false);
  const to = parseDate(params.get("to"), true);
  const eventName = parseEventName(params.get("eventName"));
  const eventsTake = parseTake(params.get("eventsTake"), 50, 200);
  const paymentsTake = parseTake(params.get("paymentsTake"), 50, 200);
  const walletTake = parseTake(params.get("walletTake"), 50, 200);
  const aiTake = parseTake(params.get("aiTake"), 30, 100);
  const usersTake = parseTake(params.get("usersTake"), 100, 200);
  const usersSkip = parseSkip(params.get("usersSkip"), 0, 10_000);

  const pagedUsers = await listUsersPaged({
    query: query || undefined,
    take: usersTake,
    skip: usersSkip,
  });
  const users = pagedUsers.rows.map((item) => ({
    id: item.id,
    email: item.email,
    role: item.role,
    createdAt: item.createdAt,
  }));

  const selectedUserId = userId || (users.length === 1 ? users[0].id : "");
  if (!selectedUserId) {
    return NextResponse.json({
      users,
      usersTotal: pagedUsers.total,
      usersTake: pagedUsers.take,
      usersSkip: pagedUsers.skip,
      selectedUserId: null,
      audit: null,
    });
  }

  const selectedUser = await findUserById(selectedUserId);
  if (!selectedUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [payments, accesses, progress, aiAnalyses, activityEvents, courses, walletSnapshot] = await Promise.all([
    listAdminPayments({
      userId: selectedUser.id,
      sortBy: "createdAt",
      sortDir: "desc",
      take: paymentsTake,
    }),
    listCourseAccess(selectedUser.id),
    buildUserProgressSnapshot(selectedUser.id),
    listAiSolutionAnalyses({ userId: selectedUser.id, take: aiTake }),
    listAnalyticsEvents({
      userId: selectedUser.id,
      eventName,
      from,
      to,
      take: eventsTake,
    }),
    listAllCourses(),
    getWalletSnapshot(selectedUser.id, walletTake),
  ]);

  const courseTitleById = new Map(courses.map((course) => [course.id, course.title] as const));

  return NextResponse.json({
    users,
    usersTotal: pagedUsers.total,
    usersTake: pagedUsers.take,
    usersSkip: pagedUsers.skip,
    selectedUserId: selectedUser.id,
    audit: {
      user: {
        id: selectedUser.id,
        email: selectedUser.email,
        role: selectedUser.role,
        createdAt: selectedUser.createdAt,
      },
      accesses: accesses.map((access) => ({
        ...access,
        courseTitle: courseTitleById.get(access.courseId) ?? access.courseId,
      })),
      progress,
      payments: {
        items: payments.rows,
        total: payments.total,
      },
      aiAnalyses: {
        items: aiAnalyses,
        total: aiAnalyses.length,
      },
      wallet: {
        wallet: walletSnapshot.wallet,
        transactions: {
          items: walletSnapshot.transactions,
          total: walletSnapshot.totalTransactions,
        },
      },
      activityEvents: {
        items: activityEvents.rows,
        total: activityEvents.total,
      },
    },
  });
}
