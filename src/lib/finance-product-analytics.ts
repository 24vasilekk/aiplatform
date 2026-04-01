import { listAllCourses } from "@/lib/course-catalog";
import {
  getLearningAnalyticsSnapshot,
  getPaymentStatusCounts,
  listSucceededPaymentsForAnalytics,
  type PaymentStatusCountsRecord,
} from "@/lib/db";
import { resolvePlanCourseIds } from "@/lib/billing";

type TopCourseFinance = {
  courseId: string;
  title: string;
  purchases: number;
  revenueCents: number;
};

export type FinanceProductDashboard = {
  periodDays: number;
  revenueCents: number;
  paymentConversionPercent: number;
  activeStudents: number;
  dau: number;
  wau: number;
  retentionD1Percent: number;
  retentionD7Percent: number;
  paymentStatus: PaymentStatusCountsRecord;
  topCourses: TopCourseFinance[];
};

export async function getFinanceProductDashboard(days = 30): Promise<FinanceProductDashboard> {
  const safeDays = Math.max(1, Math.min(Math.floor(days), 365));
  const [snapshot, paymentStatus, payments, allCourses] = await Promise.all([
    getLearningAnalyticsSnapshot(safeDays),
    getPaymentStatusCounts(safeDays),
    listSucceededPaymentsForAnalytics(safeDays),
    listAllCourses(),
  ]);

  const courseTitleById = new Map(allCourses.map((course) => [course.id, course.title] as const));
  const topCourseMap = new Map<string, TopCourseFinance>();
  const planCache = new Map<string, string[]>();

  for (const payment of payments) {
    let courseIds = planCache.get(payment.planId);
    if (!courseIds) {
      try {
        courseIds = await resolvePlanCourseIds(payment.planId as "math_only" | "bundle_2" | "all_access");
      } catch {
        courseIds = [];
      }
      planCache.set(payment.planId, courseIds);
    }

    if (courseIds.length === 0) continue;
    const share = Math.floor(payment.amountCents / courseIds.length);
    for (const courseId of courseIds) {
      const current = topCourseMap.get(courseId) ?? {
        courseId,
        title: courseTitleById.get(courseId) ?? courseId,
        purchases: 0,
        revenueCents: 0,
      };
      current.purchases += 1;
      current.revenueCents += share;
      topCourseMap.set(courseId, current);
    }
  }

  const topCourses = Array.from(topCourseMap.values())
    .sort((a, b) => {
      if (b.revenueCents !== a.revenueCents) return b.revenueCents - a.revenueCents;
      return b.purchases - a.purchases;
    })
    .slice(0, 5);

  return {
    periodDays: safeDays,
    revenueCents: snapshot.revenueCents,
    paymentConversionPercent: snapshot.paymentConversionPercent,
    activeStudents: snapshot.activeUsers,
    dau: snapshot.dau,
    wau: snapshot.wau,
    retentionD1Percent: snapshot.retentionD1Percent,
    retentionD7Percent: snapshot.retentionD7Percent,
    paymentStatus,
    topCourses,
  };
}

