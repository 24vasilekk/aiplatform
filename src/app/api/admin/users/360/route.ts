import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { applyRateLimitHeaders, createRateLimitResponse, rateLimitByRequest } from "@/lib/security";
import { applyPrivateCache } from "@/lib/http-cache";
import {
  findUserById,
  getWalletByUserId,
  listAiSolutionAnalysesPaged,
  listAdminPayments,
  listAnalyticsEvents,
  listCourseAccessPaged,
  listUsersPaged,
  listWalletTransactions,
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

const SELECTOR_CACHE_TTL_MS = 15_000;
const COURSE_TITLES_CACHE_TTL_MS = 60_000;

type SelectorCacheValue = Awaited<ReturnType<typeof listUsersPaged>>;

type TimedResult<T> = {
  value: T;
  durationMs: number;
};

type User360Section = "payments" | "accesses" | "progress" | "ai" | "events" | "wallet";

function getAdminUsers360CacheStore() {
  const scope = globalThis as typeof globalThis & {
    __adminUsers360SelectorCache?: Map<string, { expiresAt: number; value: SelectorCacheValue }>;
    __adminUsers360CourseTitlesCache?: { expiresAt: number; value: Map<string, string> };
  };
  if (!scope.__adminUsers360SelectorCache) {
    scope.__adminUsers360SelectorCache = new Map();
  }
  return scope;
}

async function timed<T>(label: string, metrics: Record<string, number>, action: () => Promise<T>): Promise<TimedResult<T>> {
  const startedAt = Date.now();
  const value = await action();
  const durationMs = Math.max(0, Date.now() - startedAt);
  metrics[label] = durationMs;
  return { value, durationMs };
}

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

function parseSortDir(value: string | null, fallback: "asc" | "desc" = "desc") {
  return value === "asc" || value === "desc" ? value : fallback;
}

function normalizeQuery(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "";
}

function parseEventTypes(input: string | null): AnalyticsEventName[] | undefined {
  if (!input || input.trim() === "" || input.trim() === "all") return undefined;
  const requested = input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const valid = requested.filter((item): item is AnalyticsEventName =>
    EVENT_NAMES.some((eventName) => eventName === item),
  );
  return valid.length > 0 ? valid : undefined;
}

function parseSections(input: string | null): Set<User360Section> | null {
  if (!input) return null;
  const values = input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (values.length === 0) return null;
  const allowed: User360Section[] = ["payments", "accesses", "progress", "ai", "events", "wallet"];
  const set = new Set<User360Section>();
  for (const value of values) {
    if (allowed.includes(value as User360Section)) {
      set.add(value as User360Section);
    }
  }
  return set.size > 0 ? set : null;
}

export async function GET(request: NextRequest) {
  const requestStartedAt = Date.now();
  const timingsMs: Record<string, number> = {};
  const auth = await requireAdmin(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "admin_users_360_get",
    keySuffix: auth.user.id,
    limit: 300,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много запросов User 360. Попробуйте позже.");
  }

  const params = new URL(request.url).searchParams;
  const profile = params.get("profile") === "1";
  const sectionsFilter = parseSections(params.get("sections"));
  const shouldLoadAllSections = !sectionsFilter || sectionsFilter.size === 0;
  const shouldLoad = (section: User360Section) => shouldLoadAllSections || sectionsFilter?.has(section);

  const query = normalizeQuery(params.get("q"));
  const userId = normalizeQuery(params.get("userId"));

  const from = parseDate(params.get("from"), false);
  const to = parseDate(params.get("to"), true);
  const eventTypes = parseEventTypes(params.get("eventTypes") ?? params.get("eventType"));

  const usersTake = parseTake(params.get("usersTake"), 100, 200);
  const usersSkip = parseSkip(params.get("usersSkip"), 0, 10_000);

  const paymentsTake = parseTake(params.get("paymentsTake"), 20, 100);
  const paymentsSkip = parseSkip(params.get("paymentsSkip"), 0, 10_000);
  const paymentsSortByRaw = params.get("paymentsSortBy");
  const paymentsSortBy =
    paymentsSortByRaw === "createdAt" ||
    paymentsSortByRaw === "amountCents" ||
    paymentsSortByRaw === "status" ||
    paymentsSortByRaw === "paidAt"
      ? paymentsSortByRaw
      : "createdAt";
  const paymentsSortDir = parseSortDir(params.get("paymentsSortDir"), "desc");

  const accessesTake = parseTake(params.get("accessesTake"), 20, 100);
  const accessesSkip = parseSkip(params.get("accessesSkip"), 0, 10_000);
  const accessesSortByRaw = params.get("accessesSortBy");
  const accessesSortBy = accessesSortByRaw === "expiresAt" ? "expiresAt" : "createdAt";
  const accessesSortDir = parseSortDir(params.get("accessesSortDir"), "desc");

  const aiTake = parseTake(params.get("aiTake"), 20, 80);
  const aiSkip = parseSkip(params.get("aiSkip"), 0, 10_000);
  const aiSortByRaw = params.get("aiSortBy");
  const aiSortBy = aiSortByRaw === "latencyMs" || aiSortByRaw === "status" ? aiSortByRaw : "createdAt";
  const aiSortDir = parseSortDir(params.get("aiSortDir"), "desc");

  const eventsTake = parseTake(params.get("eventsTake"), 30, 120);
  const eventsSkip = parseSkip(params.get("eventsSkip"), 0, 10_000);
  const eventsSortDir = parseSortDir(params.get("eventsSortDir"), "desc");

  const walletTake = parseTake(params.get("walletTake"), 30, 120);
  const walletSkip = parseSkip(params.get("walletSkip"), 0, 10_000);
  const walletSortDir = parseSortDir(params.get("walletSortDir"), "desc");

  const selectorCacheKey = `${auth.user.id}|${query}|${usersTake}|${usersSkip}`;
  const cacheStore = getAdminUsers360CacheStore();
  const selectorCached = cacheStore.__adminUsers360SelectorCache?.get(selectorCacheKey);
  let usersPaged: SelectorCacheValue;
  if (selectorCached && selectorCached.expiresAt > Date.now()) {
    usersPaged = selectorCached.value;
    timingsMs.selectorUsersMs = 0;
  } else {
    const usersTimed = await timed("selectorUsersMs", timingsMs, () =>
      listUsersPaged({
        query: query || undefined,
        take: usersTake,
        skip: usersSkip,
      }),
    );
    usersPaged = usersTimed.value;
    cacheStore.__adminUsers360SelectorCache?.set(selectorCacheKey, {
      value: usersPaged,
      expiresAt: Date.now() + SELECTOR_CACHE_TTL_MS,
    });
  }

  const users = usersPaged.rows.map((item) => ({
    id: item.id,
    email: item.email,
    role: item.role,
    createdAt: item.createdAt,
  }));

  const selectedUserId = userId || (users.length === 1 ? users[0].id : "");
  if (!selectedUserId) {
    const response = NextResponse.json({
      selector: {
        users,
        total: usersPaged.total,
        take: usersPaged.take,
        skip: usersPaged.skip,
        selectedUserId: null,
      },
      filters: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
        eventTypes: eventTypes ?? [],
      },
      sections: null,
      meta: profile
        ? {
            timingsMs: {
              ...timingsMs,
              totalMs: Math.max(0, Date.now() - requestStartedAt),
            },
          }
        : undefined,
    });
    applyPrivateCache(response, { maxAgeSec: 15, staleWhileRevalidateSec: 45 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const selectedUserTimed = await timed("selectedUserMs", timingsMs, () => findUserById(selectedUserId));
  const selectedUser = selectedUserTimed.value;
  if (!selectedUser) {
    const response = NextResponse.json({ error: "User not found" }, { status: 404 });
    applyPrivateCache(response, { maxAgeSec: 5, staleWhileRevalidateSec: 10 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const courseTitlesCached = cacheStore.__adminUsers360CourseTitlesCache;
  let courseTitleById: Map<string, string>;
  if (courseTitlesCached && courseTitlesCached.expiresAt > Date.now()) {
    courseTitleById = courseTitlesCached.value;
    timingsMs.courseTitlesMs = 0;
  } else {
    const coursesTimed = await timed("courseTitlesMs", timingsMs, async () => {
      const courses = await listAllCourses();
      return new Map(courses.map((course) => [course.id, course.title] as const));
    });
    courseTitleById = coursesTimed.value;
    cacheStore.__adminUsers360CourseTitlesCache = {
      value: courseTitleById,
      expiresAt: Date.now() + COURSE_TITLES_CACHE_TTL_MS,
    };
  }

  const progressPromise = shouldLoad("progress")
    ? timed("progressMs", timingsMs, () => buildUserProgressSnapshot(selectedUser.id)).then((item) => item.value)
    : Promise.resolve(null);
  const paymentsPromise = shouldLoad("payments")
    ? timed("paymentsMs", timingsMs, () =>
        listAdminPayments({
          userId: selectedUser.id,
          from,
          to,
          sortBy: paymentsSortBy,
          sortDir: paymentsSortDir,
          take: paymentsTake,
          skip: paymentsSkip,
        }),
      ).then((item) => item.value)
    : Promise.resolve({ rows: [], total: 0 });
  const accessesPromise = shouldLoad("accesses")
    ? timed("accessesMs", timingsMs, () =>
        listCourseAccessPaged({
          userId: selectedUser.id,
          from,
          to,
          sortBy: accessesSortBy,
          sortDir: accessesSortDir,
          take: accessesTake,
          skip: accessesSkip,
        }),
      ).then((item) => item.value)
    : Promise.resolve({ rows: [], total: 0, take: accessesTake, skip: accessesSkip });
  const aiPromise = shouldLoad("ai")
    ? timed("aiMs", timingsMs, () =>
        listAiSolutionAnalysesPaged({
          userId: selectedUser.id,
          from,
          to,
          sortBy: aiSortBy,
          sortDir: aiSortDir,
          take: aiTake,
          skip: aiSkip,
        }),
      ).then((item) => item.value)
    : Promise.resolve({ rows: [], total: 0, take: aiTake, skip: aiSkip });
  const eventsPromise = shouldLoad("events")
    ? timed("eventsMs", timingsMs, () =>
        listAnalyticsEvents({
          userId: selectedUser.id,
          eventNames: eventTypes,
          from,
          to,
          sortDir: eventsSortDir,
          take: eventsTake,
          skip: eventsSkip,
        }),
      ).then((item) => item.value)
    : Promise.resolve({ rows: [], total: 0 });
  const walletPromise = shouldLoad("wallet")
    ? Promise.all([
        timed("walletMs", timingsMs, () => getWalletByUserId(selectedUser.id)).then((item) => item.value),
        timed("walletTransactionsMs", timingsMs, () =>
          listWalletTransactions({
            userId: selectedUser.id,
            sortDir: walletSortDir,
            take: walletTake,
            skip: walletSkip,
          }),
        ).then((item) => item.value),
      ])
    : Promise.resolve([null, { rows: [], total: 0 } as Awaited<ReturnType<typeof listWalletTransactions>>]);

  const [progress, payments, accesses, aiAnalyses, events, [wallet, walletTransactions]] = await Promise.all([
    progressPromise,
    paymentsPromise,
    accessesPromise,
    aiPromise,
    eventsPromise,
    walletPromise,
  ]);
  const walletTransactionsSafe = walletTransactions ?? { rows: [], total: 0 };

  const response = NextResponse.json({
    selector: {
      users,
      total: usersPaged.total,
      take: usersPaged.take,
      skip: usersPaged.skip,
      selectedUserId: selectedUser.id,
    },
    filters: {
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
      eventTypes: eventTypes ?? [],
    },
    sections: {
      profile: {
        id: selectedUser.id,
        email: selectedUser.email,
        role: selectedUser.role,
        createdAt: selectedUser.createdAt,
      },
      progress:
        progress ??
        ({
          userId: selectedUser.id,
          generatedAt: new Date().toISOString(),
          summary: {
            percent: 0,
            status: "not_started",
            completedCourses: 0,
            totalCourses: 0,
            completedLessons: 0,
            totalLessons: 0,
            completedTasks: 0,
            totalTasks: 0,
            startedAt: null,
            completedAt: null,
            lastActivityAt: null,
          },
          courses: [],
        } as const),
      payments: {
        items: payments.rows,
        total: payments.total,
        take: paymentsTake,
        skip: paymentsSkip,
        sortBy: paymentsSortBy,
        sortDir: paymentsSortDir,
      },
      accesses: {
        items: accesses.rows.map((item) => ({
          ...item,
          courseTitle: courseTitleById.get(item.courseId) ?? item.courseId,
        })),
        total: accesses.total,
        take: accesses.take,
        skip: accesses.skip,
        sortBy: accessesSortBy,
        sortDir: accessesSortDir,
      },
      aiAnalyses: {
        items: aiAnalyses.rows,
        total: aiAnalyses.total,
        take: aiAnalyses.take,
        skip: aiAnalyses.skip,
        sortBy: aiSortBy,
        sortDir: aiSortDir,
      },
      events: {
        items: events.rows,
        total: events.total,
        take: eventsTake,
        skip: eventsSkip,
        sortDir: eventsSortDir,
      },
      wallet: {
        wallet,
        transactions: {
          items: walletTransactionsSafe.rows,
          total: walletTransactionsSafe.total,
          take: walletTake,
          skip: walletSkip,
          sortDir: walletSortDir,
        },
      },
    },
    meta: profile
      ? {
          timingsMs: {
            ...timingsMs,
            totalMs: Math.max(0, Date.now() - requestStartedAt),
          },
          loadedSections: shouldLoadAllSections
            ? ["payments", "accesses", "progress", "ai", "events", "wallet"]
            : Array.from(sectionsFilter ?? []),
        }
      : undefined,
  });
  applyPrivateCache(response, { maxAgeSec: 15, staleWhileRevalidateSec: 45 });
  response.headers.set(
    "server-timing",
    Object.entries(timingsMs)
      .map(([name, value]) => `${name};dur=${Math.max(0, Math.floor(value))}`)
      .join(", "),
  );
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
