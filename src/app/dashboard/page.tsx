import { redirect } from "next/navigation";
import { getCurrentUser, getDemoPaidAccessSnapshot, type DemoPaidAccessSnapshot } from "@/lib/auth";
import { getWalletSnapshot, hasCourseAccess, type WalletSnapshotRecord } from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";
import { buildUserProgressSnapshot, type UserProgressSnapshot } from "@/lib/progress";
import { getLoyaltyDiscountQuote, getLoyaltySnapshot, type LoyaltySnapshot } from "@/lib/loyalty";
import { StudentDashboardOverview } from "@/components/student-dashboard-overview";

export default async function DashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    redirect("/login");
  }

  let degradedMode = false;

  const fallbackProgress: UserProgressSnapshot = {
    userId: user.id,
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
  };

  let progress = fallbackProgress;
  try {
    progress = await buildUserProgressSnapshot(user.id);
  } catch {
    degradedMode = true;
  }

  let walletSnapshot: WalletSnapshotRecord = {
    wallet: {
      id: `wallet-fallback-${user.id}`,
      userId: user.id,
      balanceCents: 0,
      currency: "RUB",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    transactions: [],
    totalTransactions: 0,
  };
  try {
    walletSnapshot = await getWalletSnapshot(user.id, 20);
  } catch {
    degradedMode = true;
  }

  const fallbackLoyaltySnapshot: LoyaltySnapshot = {
    userId: user.id,
    pointsBalance: 0,
    lifetimeEarnedPoints: 0,
    lifetimeRedeemedPoints: 0,
    nextPointsExpirationAt: null,
    nextExpiringPoints: 0,
    rules: {
      pointsPerCourseCompletion: 1200,
      pointsLifetimeDays: 180,
      discountValuePerPointCents: 1,
      maxDiscountPercent: 30,
      minOrderAmountCents: 50_000,
      minPayableAmountCents: 10_000,
      maxPointsPerOrder: 70_000,
    },
    transactions: [],
  };

  let loyaltySnapshot = fallbackLoyaltySnapshot;
  let loyaltyQuotes: {
    math_only: Awaited<ReturnType<typeof getLoyaltyDiscountQuote>>;
    bundle_2: Awaited<ReturnType<typeof getLoyaltyDiscountQuote>>;
    all_access: Awaited<ReturnType<typeof getLoyaltyDiscountQuote>>;
  };
  try {
    loyaltySnapshot = await getLoyaltySnapshot(user.id, 30);
    const [mathOnly, bundle2, allAccess] = await Promise.all([
      getLoyaltyDiscountQuote({ userId: user.id, orderAmountCents: 99_000 }),
      getLoyaltyDiscountQuote({ userId: user.id, orderAmountCents: 158_400 }),
      getLoyaltyDiscountQuote({ userId: user.id, orderAmountCents: 149_000 }),
    ]);
    loyaltyQuotes = {
      math_only: mathOnly,
      bundle_2: bundle2,
      all_access: allAccess,
    };
  } catch {
    degradedMode = true;
    loyaltySnapshot = fallbackLoyaltySnapshot;
    loyaltyQuotes = {
      math_only: await getLoyaltyDiscountQuote({ userId: user.id, orderAmountCents: 99_000 }).catch(() => ({
        orderAmountCents: 99_000,
        requestedPoints: null,
        availablePoints: 0,
        maxDiscountCents: 0,
        discountCents: 0,
        pointsToSpend: 0,
        finalAmountCents: 99_000,
        reason: "NO_POINTS_AVAILABLE",
        rules: fallbackLoyaltySnapshot.rules,
      })),
      bundle_2: await getLoyaltyDiscountQuote({ userId: user.id, orderAmountCents: 158_400 }).catch(() => ({
        orderAmountCents: 158_400,
        requestedPoints: null,
        availablePoints: 0,
        maxDiscountCents: 0,
        discountCents: 0,
        pointsToSpend: 0,
        finalAmountCents: 158_400,
        reason: "NO_POINTS_AVAILABLE",
        rules: fallbackLoyaltySnapshot.rules,
      })),
      all_access: await getLoyaltyDiscountQuote({ userId: user.id, orderAmountCents: 149_000 }).catch(() => ({
        orderAmountCents: 149_000,
        requestedPoints: null,
        availablePoints: 0,
        maxDiscountCents: 0,
        discountCents: 0,
        pointsToSpend: 0,
        finalAmountCents: 149_000,
        reason: "NO_POINTS_AVAILABLE",
        rules: fallbackLoyaltySnapshot.rules,
      })),
    };
  }

  const paidSnapshot: DemoPaidAccessSnapshot = await getDemoPaidAccessSnapshot().catch(() => ({
    all: false,
    courseIds: [],
  }));

  let courses: Awaited<ReturnType<typeof listAllCourses>> = [];
  try {
    courses = await listAllCourses();
  } catch {
    degradedMode = true;
    courses = [];
  }
  const itemsWithFallback = await Promise.all(
    courses.map(async (course) => {
      if (paidSnapshot.all || paidSnapshot.courseIds.includes(course.id)) {
        return { item: { ...course, hasAccess: true }, usedFallback: false };
      }
      try {
        const access = await hasCourseAccess(user.id, course.id);
        return { item: { ...course, hasAccess: access }, usedFallback: false };
      } catch {
        return { item: { ...course, hasAccess: false }, usedFallback: true };
      }
    }),
  );
  if (itemsWithFallback.some((row) => row.usedFallback)) {
    degradedMode = true;
  }
  const items = itemsWithFallback.map((row) => row.item);
  const courseProgressById = new Map(progress.courses.map((course) => [course.courseId, course] as const));
  const courseCards = items.map((course) => {
    const courseProgress = courseProgressById.get(course.id);
    return {
      id: course.id,
      subject: course.subject,
      title: course.title,
      description: course.description,
      hasAccess: course.hasAccess,
      progressPercent: courseProgress?.percent ?? course.progress,
      completedLessons: courseProgress?.completedLessons ?? 0,
      totalLessons: courseProgress?.totalLessons ?? 0,
    };
  });

  return (
    <StudentDashboardOverview
      userEmail={user.email}
      degradedMode={degradedMode}
      progressPercent={progress.summary.percent}
      progressLessonsLabel={`${progress.summary.completedLessons}/${progress.summary.totalLessons} уроков`}
      walletSnapshot={walletSnapshot}
      loyaltySnapshot={loyaltySnapshot}
      loyaltyQuotes={loyaltyQuotes}
      courses={courseCards}
    />
  );
}
