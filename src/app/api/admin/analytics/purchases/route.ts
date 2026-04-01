import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { listAdminPayments, type AdminPaymentRecord } from "@/lib/db";
import { resolvePlanCourseIds } from "@/lib/billing";
import { listAllCourses } from "@/lib/course-catalog";

type SortBy = "createdAt" | "amountCents" | "status" | "paidAt";
type SortDir = "asc" | "desc";

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  if (!endOfDay) return date;
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

function parseTake(value: string | null) {
  if (!value) return 100;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(parsed, 500));
}

function parseSkip(value: string | null) {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function parseSortBy(value: string | null): SortBy {
  if (value === "amountCents" || value === "status" || value === "paidAt") return value;
  return "createdAt";
}

function parseSortDir(value: string | null): SortDir {
  return value === "asc" ? "asc" : "desc";
}

function toPlanLabel(planId: string) {
  if (planId === "math_only") return "Курс: Математика";
  if (planId === "bundle_2") return "Пакет 1+1";
  if (planId === "all_access") return "Все курсы";
  return planId;
}

function toCsv(rows: Array<Record<string, string | number | null>>) {
  if (rows.length === 0) {
    return "id,userEmail,planId,planLabel,courseIds,amount,status,provider,date\n";
  }

  const headers = Object.keys(rows[0]);
  const escaped = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escaped(row[header] ?? null)).join(",")),
  ];
  return lines.join("\n");
}

async function attachPlanCourses(rows: AdminPaymentRecord[]) {
  const uniquePlans = Array.from(new Set(rows.map((row) => row.planId)));
  const mapping = new Map<string, string[]>();
  await Promise.all(
    uniquePlans.map(async (planId) => {
      try {
        const courseIds = await resolvePlanCourseIds(planId as "math_only" | "bundle_2" | "all_access");
        mapping.set(planId, courseIds);
      } catch {
        mapping.set(planId, []);
      }
    }),
  );
  return mapping;
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) return auth.error;
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const from = parseDate(params.get("from"), false);
  const to = parseDate(params.get("to"), true);
  const take = parseTake(params.get("take"));
  const skip = parseSkip(params.get("skip"));
  const sortBy = parseSortBy(params.get("sortBy"));
  const sortDir = parseSortDir(params.get("sortDir"));
  const status = params.get("status");
  const userId = params.get("userId")?.trim() || undefined;
  const userEmail = params.get("userEmail")?.trim() || undefined;
  const courseId = params.get("courseId")?.trim() || undefined;
  const format = params.get("format")?.trim() || "json";

  const base = await listAdminPayments({
    from,
    to,
    userId,
    userEmail,
    status:
      status === "created" ||
      status === "requires_action" ||
      status === "processing" ||
      status === "succeeded" ||
      status === "failed" ||
      status === "canceled"
        ? status
        : undefined,
    sortBy,
    sortDir,
    take: courseId ? 500 : take,
    skip: courseId ? 0 : skip,
  });

  const planCourses = await attachPlanCourses(base.rows);
  const allCourses = await listAllCourses();
  const courseTitleById = new Map(allCourses.map((course) => [course.id, course.title] as const));

  const enriched = base.rows
    .map((row) => {
      const courseIds = planCourses.get(row.planId) ?? [];
      return {
        ...row,
        planLabel: toPlanLabel(row.planId),
        courseIds,
        courseTitles: courseIds.map((id) => courseTitleById.get(id) ?? id),
      };
    })
    .filter((row) => !courseId || row.courseIds.includes(courseId));

  const sorted = [...enriched].sort((a, b) => {
    const direction = sortDir === "asc" ? 1 : -1;
    if (sortBy === "amountCents") return (a.amountCents - b.amountCents) * direction;
    if (sortBy === "status") return a.status.localeCompare(b.status) * direction;
    if (sortBy === "paidAt") {
      const av = a.paidAt ?? "";
      const bv = b.paidAt ?? "";
      return av.localeCompare(bv) * direction;
    }
    return a.createdAt.localeCompare(b.createdAt) * direction;
  });

  const page = courseId ? sorted.slice(skip, skip + take) : sorted;

  if (format === "csv") {
    const csv = toCsv(
      page.map((row) => ({
        id: row.id,
        userEmail: row.userEmail,
        userId: row.userId,
        planId: row.planId,
        planLabel: row.planLabel,
        courseIds: row.courseIds.join("|"),
        courseTitles: row.courseTitles.join("|"),
        amount: (row.amountCents / 100).toFixed(2),
        currency: row.currency,
        status: row.status,
        provider: row.provider,
        providerPaymentId: row.providerPaymentId,
        createdAt: row.createdAt,
        paidAt: row.paidAt,
        failedAt: row.failedAt,
        canceledAt: row.canceledAt,
      })),
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename=\"purchases_${new Date().toISOString().slice(0, 10)}.csv\"`,
      },
    });
  }

  return NextResponse.json({
    items: page,
    total: courseId ? sorted.length : base.total,
    take,
    skip,
    sortBy,
    sortDir,
  });
}

