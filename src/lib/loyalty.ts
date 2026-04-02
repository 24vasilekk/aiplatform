import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildUserProgressSnapshot, type UserProgressSnapshot } from "@/lib/progress";

export const LOYALTY_RULES = {
  pointsPerCourseCompletion: 1200,
  pointsLifetimeDays: 180,
  discountValuePerPointCents: 1,
  maxDiscountPercent: 30,
  minOrderAmountCents: 50_000,
  minPayableAmountCents: 10_000,
  maxPointsPerOrder: 70_000,
} as const;

export type LoyaltyRuleSet = typeof LOYALTY_RULES;

export type LoyaltyTransactionView = {
  id: string;
  direction: "credit" | "debit";
  reason: "course_completion" | "discount_redeem" | "discount_rollback" | "expiration" | "manual_adjustment";
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  courseId: string | null;
  paymentIntentId: string | null;
  idempotencyKey: string | null;
  expiresAt: string | null;
  createdAt: string;
  metadata: unknown;
};

export type LoyaltySnapshot = {
  userId: string;
  pointsBalance: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  nextPointsExpirationAt: string | null;
  nextExpiringPoints: number;
  rules: LoyaltyRuleSet;
  transactions: LoyaltyTransactionView[];
};

export type LoyaltyDiscountQuote = {
  orderAmountCents: number;
  requestedPoints: number | null;
  availablePoints: number;
  maxDiscountCents: number;
  discountCents: number;
  pointsToSpend: number;
  finalAmountCents: number;
  reason: string | null;
  rules: LoyaltyRuleSet;
};

export type LoyaltyRedemptionResult = {
  transactionId: string;
  pointsSpent: number;
  discountCents: number;
  balanceAfter: number;
  deduplicated: boolean;
};

class InsufficientLoyaltyPointsError extends Error {
  constructor() {
    super("INSUFFICIENT_LOYALTY_POINTS");
    this.name = "InsufficientLoyaltyPointsError";
  }
}

export function isInsufficientLoyaltyPointsError(error: unknown) {
  return (
    error instanceof InsufficientLoyaltyPointsError ||
    (error instanceof Error && error.message === "INSUFFICIENT_LOYALTY_POINTS")
  );
}

export function getCompletedCourseIdsForLoyalty(snapshot: Pick<UserProgressSnapshot, "courses">) {
  return Array.from(
    new Set(snapshot.courses.filter((course) => course.status === "completed").map((course) => course.courseId)),
  );
}

type BucketUsage = {
  bucketId: string;
  points: number;
  expiresAt: string;
};

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function asPositiveInt(value: number | null | undefined) {
  return Math.max(0, Math.floor(value ?? 0));
}

function toReasonView(
  reason: "COURSE_COMPLETION" | "DISCOUNT_REDEEM" | "DISCOUNT_ROLLBACK" | "EXPIRATION" | "MANUAL_ADJUSTMENT",
): LoyaltyTransactionView["reason"] {
  if (reason === "COURSE_COMPLETION") return "course_completion";
  if (reason === "DISCOUNT_REDEEM") return "discount_redeem";
  if (reason === "DISCOUNT_ROLLBACK") return "discount_rollback";
  if (reason === "EXPIRATION") return "expiration";
  return "manual_adjustment";
}

function toDirectionView(direction: "CREDIT" | "DEBIT"): LoyaltyTransactionView["direction"] {
  return direction === "DEBIT" ? "debit" : "credit";
}

function toTransactionView(row: {
  id: string;
  direction: "CREDIT" | "DEBIT";
  reason: "COURSE_COMPLETION" | "DISCOUNT_REDEEM" | "DISCOUNT_ROLLBACK" | "EXPIRATION" | "MANUAL_ADJUSTMENT";
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  courseId: string | null;
  paymentIntentId: string | null;
  idempotencyKey: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  metadata: unknown;
}): LoyaltyTransactionView {
  return {
    id: row.id,
    direction: toDirectionView(row.direction),
    reason: toReasonView(row.reason),
    points: row.points,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    courseId: row.courseId,
    paymentIntentId: row.paymentIntentId,
    idempotencyKey: row.idempotencyKey,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    metadata: row.metadata ?? null,
  };
}

async function ensureLoyaltyAccount(tx: Prisma.TransactionClient, userId: string) {
  return tx.loyaltyAccount.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      pointsBalance: 0,
      lifetimeEarnedPoints: 0,
      lifetimeRedeemedPoints: 0,
    },
  });
}

function parseBucketUsage(metadata: Prisma.JsonValue | null | undefined): BucketUsage[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const raw = (metadata as Record<string, unknown>).consumedBuckets;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): BucketUsage | null => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      if (typeof entry.bucketId !== "string") return null;
      const points = asPositiveInt(typeof entry.points === "number" ? entry.points : null);
      if (!points) return null;
      if (typeof entry.expiresAt !== "string") return null;
      return {
        bucketId: entry.bucketId,
        points,
        expiresAt: entry.expiresAt,
      };
    })
    .filter((item): item is BucketUsage => Boolean(item));
}

function buildQuote(input: {
  orderAmountCents: number;
  availablePoints: number;
  requestedPoints?: number | null;
}): LoyaltyDiscountQuote {
  const orderAmountCents = asPositiveInt(input.orderAmountCents);
  const availablePoints = asPositiveInt(input.availablePoints);
  const requestedPoints =
    input.requestedPoints === null || input.requestedPoints === undefined
      ? null
      : asPositiveInt(input.requestedPoints);

  if (orderAmountCents < LOYALTY_RULES.minOrderAmountCents) {
    return {
      orderAmountCents,
      requestedPoints,
      availablePoints,
      maxDiscountCents: 0,
      discountCents: 0,
      pointsToSpend: 0,
      finalAmountCents: orderAmountCents,
      reason: "ORDER_BELOW_MIN_AMOUNT",
      rules: LOYALTY_RULES,
    };
  }

  if (availablePoints <= 0) {
    return {
      orderAmountCents,
      requestedPoints,
      availablePoints,
      maxDiscountCents: 0,
      discountCents: 0,
      pointsToSpend: 0,
      finalAmountCents: orderAmountCents,
      reason: "NO_POINTS_AVAILABLE",
      rules: LOYALTY_RULES,
    };
  }

  const maxByPercent = Math.floor(orderAmountCents * (LOYALTY_RULES.maxDiscountPercent / 100));
  const maxByFloor = Math.max(0, orderAmountCents - LOYALTY_RULES.minPayableAmountCents);
  const maxByPoints = Math.floor(availablePoints * LOYALTY_RULES.discountValuePerPointCents);
  const maxByOrder = Math.floor(LOYALTY_RULES.maxPointsPerOrder * LOYALTY_RULES.discountValuePerPointCents);
  const maxDiscountCents = Math.max(0, Math.min(maxByPercent, maxByFloor, maxByPoints, maxByOrder));

  if (maxDiscountCents <= 0) {
    return {
      orderAmountCents,
      requestedPoints,
      availablePoints,
      maxDiscountCents: 0,
      discountCents: 0,
      pointsToSpend: 0,
      finalAmountCents: orderAmountCents,
      reason: "DISCOUNT_LIMIT_REACHED",
      rules: LOYALTY_RULES,
    };
  }

  const requestedDiscount =
    requestedPoints === null
      ? maxDiscountCents
      : Math.floor(requestedPoints * LOYALTY_RULES.discountValuePerPointCents);

  const discountCents = Math.max(0, Math.min(requestedDiscount, maxDiscountCents));
  const pointsToSpend = Math.ceil(discountCents / LOYALTY_RULES.discountValuePerPointCents);

  return {
    orderAmountCents,
    requestedPoints,
    availablePoints,
    maxDiscountCents,
    discountCents,
    pointsToSpend,
    finalAmountCents: orderAmountCents - discountCents,
    reason: discountCents > 0 ? null : "DISCOUNT_LIMIT_REACHED",
    rules: LOYALTY_RULES,
  };
}

async function expirePointsInTx(tx: Prisma.TransactionClient, account: { id: string; userId: string; pointsBalance: number }) {
  const now = new Date();
  const buckets = await tx.loyaltyPointBucket.findMany({
    where: {
      loyaltyAccountId: account.id,
      remainingPoints: { gt: 0 },
      expiresAt: { lte: now },
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  });

  const expiredPointsRaw = buckets.reduce((sum, item) => sum + item.remainingPoints, 0);
  if (expiredPointsRaw <= 0) {
    return { expiredPoints: 0, balanceAfter: account.pointsBalance };
  }

  for (const bucket of buckets) {
    await tx.loyaltyPointBucket.update({
      where: { id: bucket.id },
      data: { remainingPoints: 0 },
    });
  }

  const expiredPoints = Math.min(account.pointsBalance, expiredPointsRaw);
  const balanceAfter = Math.max(0, account.pointsBalance - expiredPoints);

  if (expiredPoints > 0) {
    await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        userId: account.userId,
        direction: "DEBIT",
        reason: "EXPIRATION",
        points: expiredPoints,
        balanceBefore: account.pointsBalance,
        balanceAfter,
        metadata: {
          expiredAt: now.toISOString(),
          bucketCount: buckets.length,
        } satisfies Prisma.InputJsonValue,
      },
    });

    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        pointsBalance: balanceAfter,
      },
    });
  }

  return { expiredPoints, balanceAfter };
}

export async function expireLoyaltyPoints(userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const account = await ensureLoyaltyAccount(tx, userId);
    return expirePointsInTx(tx, account);
  });

  return result.expiredPoints;
}

export async function awardCourseCompletionPoints(input: { userId: string; courseId: string; idempotencyKey?: string }) {
  const points = LOYALTY_RULES.pointsPerCourseCompletion;
  const idempotencyKey = input.idempotencyKey?.trim() || `course_completion:${input.courseId}`;
  const expiresAt = addDays(new Date(), LOYALTY_RULES.pointsLifetimeDays);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const account = await ensureLoyaltyAccount(tx, input.userId);
      const { balanceAfter: balanceAfterExpire } = await expirePointsInTx(tx, account);

      const latestAccount =
        balanceAfterExpire === account.pointsBalance
          ? account
          : await tx.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } });

      const existing = await tx.loyaltyTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey,
          },
        },
      });
      if (existing) {
        return {
          transaction: existing,
          deduplicated: true,
        };
      }

      const existingByCourse = await tx.loyaltyTransaction.findFirst({
        where: {
          userId: input.userId,
          reason: "COURSE_COMPLETION",
          courseId: input.courseId,
        },
        orderBy: { createdAt: "desc" },
      });
      if (existingByCourse) {
        return {
          transaction: existingByCourse,
          deduplicated: true,
        };
      }

      const balanceBefore = latestAccount.pointsBalance;
      const balanceAfter = balanceBefore + points;

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: latestAccount.id,
          userId: input.userId,
          direction: "CREDIT",
          reason: "COURSE_COMPLETION",
          points,
          balanceBefore,
          balanceAfter,
          courseId: input.courseId,
          idempotencyKey,
          expiresAt,
          metadata: {
            courseId: input.courseId,
            rulesVersion: "v1",
          } satisfies Prisma.InputJsonValue,
        },
      });

      await tx.loyaltyPointBucket.create({
        data: {
          loyaltyAccountId: latestAccount.id,
          userId: input.userId,
          sourceTransactionId: transaction.id,
          totalPoints: points,
          remainingPoints: points,
          expiresAt,
        },
      });

      await tx.loyaltyAccount.update({
        where: { id: latestAccount.id },
        data: {
          pointsBalance: balanceAfter,
          lifetimeEarnedPoints: { increment: points },
        },
      });

      return {
        transaction,
        deduplicated: false,
      };
    });

    return {
      pointsAwarded: result.transaction.points,
      deduplicated: result.deduplicated,
      transactionId: result.transaction.id,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.loyaltyTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey,
          },
        },
      });
      if (existing) {
        return {
          pointsAwarded: existing.points,
          deduplicated: true,
          transactionId: existing.id,
        };
      }

      const existingByCourse = await prisma.loyaltyTransaction.findFirst({
        where: {
          userId: input.userId,
          reason: "COURSE_COMPLETION",
          courseId: input.courseId,
        },
        orderBy: { createdAt: "desc" },
      });
      if (existingByCourse) {
        return {
          pointsAwarded: existingByCourse.points,
          deduplicated: true,
          transactionId: existingByCourse.id,
        };
      }
    }
    throw error;
  }
}

export async function syncCompletedCourseLoyalty(userId: string) {
  const progressSnapshot = await buildUserProgressSnapshot(userId);
  const completedCourseIds = getCompletedCourseIdsForLoyalty(progressSnapshot);

  let awardedCourses = 0;
  let totalPointsAwarded = 0;

  for (const courseId of completedCourseIds) {
    const result = await awardCourseCompletionPoints({
      userId,
      courseId,
      idempotencyKey: `course_completion:${courseId}`,
    });
    if (!result.deduplicated) {
      awardedCourses += 1;
      totalPointsAwarded += result.pointsAwarded;
    }
  }

  return {
    completedCourses: completedCourseIds.length,
    awardedCourses,
    totalPointsAwarded,
  };
}

export async function getLoyaltyDiscountQuote(input: {
  userId: string;
  orderAmountCents: number;
  requestedPoints?: number | null;
}) {
  await expireLoyaltyPoints(input.userId);
  const account = await prisma.loyaltyAccount.upsert({
    where: { userId: input.userId },
    update: {},
    create: { userId: input.userId },
  });

  return buildQuote({
    orderAmountCents: input.orderAmountCents,
    availablePoints: account.pointsBalance,
    requestedPoints: input.requestedPoints,
  });
}

export async function redeemLoyaltyDiscount(input: {
  userId: string;
  orderAmountCents: number;
  requestedPoints?: number | null;
  paymentIntentId: string;
  planId: string;
  idempotencyKey: string;
}): Promise<LoyaltyRedemptionResult | null> {
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new Error("INVALID_IDEMPOTENCY_KEY");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const account = await ensureLoyaltyAccount(tx, input.userId);
      const { balanceAfter: balanceAfterExpire } = await expirePointsInTx(tx, account);
      const latestAccount =
        balanceAfterExpire === account.pointsBalance
          ? account
          : await tx.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } });

      const existing = await tx.loyaltyTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey,
          },
        },
      });
      if (existing && existing.reason === "DISCOUNT_REDEEM") {
        return {
          transactionId: existing.id,
          pointsSpent: existing.points,
          discountCents: Math.floor(existing.points * LOYALTY_RULES.discountValuePerPointCents),
          balanceAfter: existing.balanceAfter,
          deduplicated: true,
        };
      }

      const quote = buildQuote({
        orderAmountCents: input.orderAmountCents,
        availablePoints: latestAccount.pointsBalance,
        requestedPoints: input.requestedPoints,
      });

      if (quote.pointsToSpend <= 0) {
        return null;
      }

      let pointsLeft = quote.pointsToSpend;
      const buckets = await tx.loyaltyPointBucket.findMany({
        where: {
          loyaltyAccountId: latestAccount.id,
          remainingPoints: { gt: 0 },
          expiresAt: { gt: new Date() },
        },
        orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
      });

      const consumedBuckets: BucketUsage[] = [];
      for (const bucket of buckets) {
        if (pointsLeft <= 0) break;
        const consume = Math.min(pointsLeft, bucket.remainingPoints);
        if (consume <= 0) continue;

        await tx.loyaltyPointBucket.update({
          where: { id: bucket.id },
          data: {
            remainingPoints: bucket.remainingPoints - consume,
          },
        });
        consumedBuckets.push({
          bucketId: bucket.id,
          points: consume,
          expiresAt: bucket.expiresAt.toISOString(),
        });
        pointsLeft -= consume;
      }

      if (pointsLeft > 0) {
        throw new Error("LOYALTY_POINTS_RACE_CONDITION");
      }

      const pointsSpent = quote.pointsToSpend;
      const balanceBefore = latestAccount.pointsBalance;
      const balanceAfter = Math.max(0, balanceBefore - pointsSpent);

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: latestAccount.id,
          userId: input.userId,
          direction: "DEBIT",
          reason: "DISCOUNT_REDEEM",
          points: pointsSpent,
          balanceBefore,
          balanceAfter,
          paymentIntentId: input.paymentIntentId,
          idempotencyKey,
          metadata: {
            planId: input.planId,
            paymentIntentId: input.paymentIntentId,
            orderAmountCents: input.orderAmountCents,
            discountCents: quote.discountCents,
            consumedBuckets,
          } satisfies Prisma.InputJsonValue,
        },
      });

      await tx.loyaltyAccount.update({
        where: { id: latestAccount.id },
        data: {
          pointsBalance: balanceAfter,
          lifetimeRedeemedPoints: { increment: pointsSpent },
        },
      });

      return {
        transactionId: transaction.id,
        pointsSpent,
        discountCents: quote.discountCents,
        balanceAfter,
        deduplicated: false,
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.loyaltyTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey,
          },
        },
      });
      if (existing && existing.reason === "DISCOUNT_REDEEM") {
        return {
          transactionId: existing.id,
          pointsSpent: existing.points,
          discountCents: Math.floor(existing.points * LOYALTY_RULES.discountValuePerPointCents),
          balanceAfter: existing.balanceAfter,
          deduplicated: true,
        };
      }
    }
    throw error;
  }
}

export async function rollbackLoyaltyRedemption(input: {
  userId: string;
  redemptionTransactionId: string;
  idempotencyKey: string;
  reason?: string;
}) {
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new Error("INVALID_IDEMPOTENCY_KEY");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const account = await ensureLoyaltyAccount(tx, input.userId);
      const existing = await tx.loyaltyTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey,
          },
        },
      });
      if (existing && existing.reason === "DISCOUNT_ROLLBACK") {
        return {
          transactionId: existing.id,
          pointsRestored: existing.points,
          deduplicated: true,
        };
      }

      const redemption = await tx.loyaltyTransaction.findFirst({
        where: {
          id: input.redemptionTransactionId,
          userId: input.userId,
          reason: "DISCOUNT_REDEEM",
        },
      });

      if (!redemption) {
        return {
          transactionId: null,
          pointsRestored: 0,
          deduplicated: true,
        };
      }

      const consumedBuckets = parseBucketUsage(redemption.metadata);
      for (const consumed of consumedBuckets) {
        const expiresAt = new Date(consumed.expiresAt);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
          continue;
        }

        await tx.loyaltyPointBucket.create({
          data: {
            loyaltyAccountId: account.id,
            userId: input.userId,
            totalPoints: consumed.points,
            remainingPoints: consumed.points,
            expiresAt,
          },
        });
      }

      const balanceBefore = account.pointsBalance;
      const pointsRestored = redemption.points;
      const balanceAfter = balanceBefore + pointsRestored;
      const rollback = await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          userId: input.userId,
          direction: "CREDIT",
          reason: "DISCOUNT_ROLLBACK",
          points: pointsRestored,
          balanceBefore,
          balanceAfter,
          paymentIntentId: redemption.paymentIntentId,
          idempotencyKey,
          metadata: {
            reason: input.reason ?? "ROLLBACK",
            redemptionTransactionId: redemption.id,
            consumedBuckets,
          } satisfies Prisma.InputJsonValue,
        },
      });

      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: balanceAfter,
          lifetimeRedeemedPoints: { decrement: pointsRestored },
        },
      });

      return {
        transactionId: rollback.id,
        pointsRestored,
        deduplicated: false,
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.loyaltyTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey,
          },
        },
      });
      if (existing && existing.reason === "DISCOUNT_ROLLBACK") {
        return {
          transactionId: existing.id,
          pointsRestored: existing.points,
          deduplicated: true,
        };
      }
    }
    throw error;
  }
}

export async function getLoyaltySnapshot(userId: string, take = 20): Promise<LoyaltySnapshot> {
  await expireLoyaltyPoints(userId);
  const [account, transactions, nextBucket] = await Promise.all([
    prisma.loyaltyAccount.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }),
    prisma.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(Math.floor(take || 20), 200)),
    }),
    prisma.loyaltyPointBucket.findFirst({
      where: {
        userId,
        remainingPoints: { gt: 0 },
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return {
    userId,
    pointsBalance: account.pointsBalance,
    lifetimeEarnedPoints: account.lifetimeEarnedPoints,
    lifetimeRedeemedPoints: account.lifetimeRedeemedPoints,
    nextPointsExpirationAt: nextBucket?.expiresAt.toISOString() ?? null,
    nextExpiringPoints: nextBucket?.remainingPoints ?? 0,
    rules: LOYALTY_RULES,
    transactions: transactions.map(toTransactionView),
  };
}

export async function adjustLoyaltyPointsByAdmin(input: {
  userId: string;
  direction: "credit" | "debit";
  points: number;
  idempotencyKey: string;
  adminUserId: string;
  reason?: string | null;
}) {
  const points = asPositiveInt(input.points);
  if (points <= 0) {
    throw new Error("INVALID_LOYALTY_POINTS");
  }
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new Error("INVALID_IDEMPOTENCY_KEY");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const account = await ensureLoyaltyAccount(tx, input.userId);
      const { balanceAfter: balanceAfterExpire } = await expirePointsInTx(tx, account);
      const latestAccount =
        balanceAfterExpire === account.pointsBalance
          ? account
          : await tx.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } });

      const existing = await tx.loyaltyTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey,
          },
        },
      });
      if (existing) {
        return {
          transactionId: existing.id,
          direction: toDirectionView(existing.direction),
          points: existing.points,
          balanceAfter: existing.balanceAfter,
          deduplicated: true,
        };
      }

      const isDebit = input.direction === "debit";
      const balanceBefore = latestAccount.pointsBalance;
      if (isDebit && balanceBefore < points) {
        throw new InsufficientLoyaltyPointsError();
      }
      const balanceAfter = isDebit ? balanceBefore - points : balanceBefore + points;

      if (isDebit) {
        let remaining = points;
        const buckets = await tx.loyaltyPointBucket.findMany({
          where: {
            loyaltyAccountId: latestAccount.id,
            remainingPoints: { gt: 0 },
            expiresAt: { gt: new Date() },
          },
          orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
        });
        for (const bucket of buckets) {
          if (remaining <= 0) break;
          const consume = Math.min(remaining, bucket.remainingPoints);
          if (consume <= 0) continue;
          await tx.loyaltyPointBucket.update({
            where: { id: bucket.id },
            data: {
              remainingPoints: bucket.remainingPoints - consume,
            },
          });
          remaining -= consume;
        }
        if (remaining > 0) {
          throw new InsufficientLoyaltyPointsError();
        }
      }

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: latestAccount.id,
          userId: input.userId,
          direction: isDebit ? "DEBIT" : "CREDIT",
          reason: "MANUAL_ADJUSTMENT",
          points,
          balanceBefore,
          balanceAfter,
          idempotencyKey,
          metadata: {
            adminUserId: input.adminUserId,
            reason: input.reason ?? null,
          } satisfies Prisma.InputJsonValue,
          expiresAt: isDebit ? null : addDays(new Date(), LOYALTY_RULES.pointsLifetimeDays),
        },
      });

      if (!isDebit) {
        await tx.loyaltyPointBucket.create({
          data: {
            loyaltyAccountId: latestAccount.id,
            userId: input.userId,
            sourceTransactionId: transaction.id,
            totalPoints: points,
            remainingPoints: points,
            expiresAt: addDays(new Date(), LOYALTY_RULES.pointsLifetimeDays),
          },
        });
      }

      await tx.loyaltyAccount.update({
        where: { id: latestAccount.id },
        data: {
          pointsBalance: balanceAfter,
          lifetimeEarnedPoints: isDebit ? undefined : { increment: points },
          lifetimeRedeemedPoints: isDebit ? { increment: points } : undefined,
        },
      });

      return {
        transactionId: transaction.id,
        direction: input.direction,
        points,
        balanceAfter,
        deduplicated: false,
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.loyaltyTransaction.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey,
          },
        },
      });
      if (existing) {
        return {
          transactionId: existing.id,
          direction: toDirectionView(existing.direction),
          points: existing.points,
          balanceAfter: existing.balanceAfter,
          deduplicated: true,
        };
      }
    }
    throw error;
  }
}
