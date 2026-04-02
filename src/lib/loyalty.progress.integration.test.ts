import { beforeEach, describe, expect, it, vi } from "vitest";

type MockState = {
  account: {
    id: string;
    userId: string;
    pointsBalance: number;
    lifetimeEarnedPoints: number;
    lifetimeRedeemedPoints: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  transactions: Array<{
    id: string;
    loyaltyAccountId: string;
    userId: string;
    direction: "CREDIT" | "DEBIT";
    reason: "COURSE_COMPLETION" | "DISCOUNT_REDEEM" | "DISCOUNT_ROLLBACK" | "EXPIRATION" | "MANUAL_ADJUSTMENT";
    points: number;
    balanceBefore: number;
    balanceAfter: number;
    courseId: string | null;
    paymentIntentId: string | null;
    idempotencyKey: string | null;
    metadata: unknown;
    expiresAt: Date | null;
    createdAt: Date;
  }>;
  buckets: Array<{
    id: string;
    loyaltyAccountId: string;
    userId: string;
    sourceTransactionId: string | null;
    totalPoints: number;
    remainingPoints: number;
    expiresAt: Date;
    createdAt: Date;
  }>;
  progressSnapshot: {
    courses: Array<{ courseId: string; status: "not_started" | "in_progress" | "completed" }>;
  };
};

const mock = vi.hoisted(() => ({
  state: null as MockState | null,
}));

function now() {
  return new Date("2026-04-02T00:00:00.000Z");
}

function createState(): MockState {
  return {
    account: null,
    transactions: [],
    buckets: [],
    progressSnapshot: { courses: [] },
  };
}

function ensureAccount(state: MockState, userId: string) {
  if (!state.account) {
    state.account = {
      id: "la_1",
      userId,
      pointsBalance: 0,
      lifetimeEarnedPoints: 0,
      lifetimeRedeemedPoints: 0,
      createdAt: now(),
      updatedAt: now(),
    };
  }
  return state.account;
}

type PrismaInput = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  create?: Record<string, unknown>;
};

function createPrismaMock() {
  const loyaltyTransaction = {
    findUnique: vi.fn(async (input: PrismaInput) => {
      const state = mock.state!;
      const key = input?.where?.userId_idempotencyKey as
        | { userId: string; idempotencyKey: string }
        | undefined;
      if (!key) return null;
      return (
        state.transactions.find((row) => row.userId === key.userId && row.idempotencyKey === key.idempotencyKey) ?? null
      );
    }),
    findFirst: vi.fn(async (input: PrismaInput) => {
      const state = mock.state!;
      const where = (input?.where ?? {}) as {
        id?: string;
        userId?: string;
        reason?: MockState["transactions"][number]["reason"];
        courseId?: string | null;
      };
      const rows = state.transactions.filter((row) => {
        if (where.id && row.id !== where.id) return false;
        if (where.userId && row.userId !== where.userId) return false;
        if (where.reason && row.reason !== where.reason) return false;
        if (typeof where.courseId !== "undefined" && row.courseId !== where.courseId) return false;
        return true;
      });
      return rows.at(-1) ?? null;
    }),
    create: vi.fn(async (input: PrismaInput) => {
      const state = mock.state!;
      const data = (input.data ?? {}) as {
        loyaltyAccountId: string;
        userId: string;
        direction: MockState["transactions"][number]["direction"];
        reason: MockState["transactions"][number]["reason"];
        points: number;
        balanceBefore: number;
        balanceAfter: number;
        courseId?: string | null;
        paymentIntentId?: string | null;
        idempotencyKey?: string | null;
        metadata?: unknown;
        expiresAt?: Date | null;
      };
      const row = {
        id: `ltx_${state.transactions.length + 1}`,
        loyaltyAccountId: data.loyaltyAccountId,
        userId: data.userId,
        direction: data.direction,
        reason: data.reason,
        points: data.points,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
        courseId: data.courseId ?? null,
        paymentIntentId: data.paymentIntentId ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
        metadata: data.metadata ?? null,
        expiresAt: data.expiresAt ?? null,
        createdAt: now(),
      } as MockState["transactions"][number];
      state.transactions.push(row);
      return row;
    }),
  };

  const loyaltyPointBucket = {
    findMany: vi.fn(async (input: PrismaInput) => {
      const state = mock.state!;
      const where = (input.where ?? {}) as {
        loyaltyAccountId: string;
        expiresAt?: { lte?: Date };
      };
      const accountId = where.loyaltyAccountId;
      const lte = where.expiresAt?.lte as Date | undefined;
      return state.buckets.filter(
        (row) => row.loyaltyAccountId === accountId && row.remainingPoints > 0 && (!lte || row.expiresAt <= lte),
      );
    }),
    update: vi.fn(async (input: PrismaInput) => {
      const state = mock.state!;
      const where = (input.where ?? {}) as { id: string };
      const data = (input.data ?? {}) as { remainingPoints: number };
      const row = state.buckets.find((item) => item.id === where.id);
      if (!row) throw new Error("bucket not found");
      row.remainingPoints = data.remainingPoints;
      return row;
    }),
    create: vi.fn(async (input: PrismaInput) => {
      const state = mock.state!;
      const data = (input.data ?? {}) as {
        loyaltyAccountId: string;
        userId: string;
        sourceTransactionId?: string | null;
        totalPoints: number;
        remainingPoints: number;
        expiresAt: Date;
      };
      const row = {
        id: `lb_${state.buckets.length + 1}`,
        loyaltyAccountId: data.loyaltyAccountId,
        userId: data.userId,
        sourceTransactionId: data.sourceTransactionId ?? null,
        totalPoints: data.totalPoints,
        remainingPoints: data.remainingPoints,
        expiresAt: data.expiresAt,
        createdAt: now(),
      };
      state.buckets.push(row);
      return row;
    }),
  };

  const loyaltyAccount = {
    upsert: vi.fn(async (input: PrismaInput) => {
      const state = mock.state!;
      const where = (input.where ?? {}) as { userId?: string };
      const create = (input.create ?? {}) as { userId: string };
      const userId = where.userId ?? create.userId;
      return ensureAccount(state, userId);
    }),
    findUniqueOrThrow: vi.fn(async () => {
      const state = mock.state!;
      if (!state.account) throw new Error("account not found");
      return state.account;
    }),
    update: vi.fn(async (input: PrismaInput) => {
      const state = mock.state!;
      const where = (input.where ?? {}) as { id?: string; userId?: string };
      const data = (input.data ?? {}) as {
        pointsBalance?: number;
        lifetimeEarnedPoints?: { increment?: number };
        lifetimeRedeemedPoints?: { increment?: number; decrement?: number };
      };
      const fallbackUserId = state.account?.userId ?? where.userId ?? "u1";
      const account = ensureAccount(state, fallbackUserId);
      if (typeof data.pointsBalance === "number") {
        account.pointsBalance = data.pointsBalance;
      }
      if (data.lifetimeEarnedPoints?.increment) {
        account.lifetimeEarnedPoints += data.lifetimeEarnedPoints.increment;
      }
      if (data.lifetimeRedeemedPoints?.increment) {
        account.lifetimeRedeemedPoints += data.lifetimeRedeemedPoints.increment;
      }
      if (data.lifetimeRedeemedPoints?.decrement) {
        account.lifetimeRedeemedPoints -= data.lifetimeRedeemedPoints.decrement;
      }
      account.updatedAt = now();
      return account;
    }),
  };

  const tx = {
    loyaltyAccount,
    loyaltyTransaction,
    loyaltyPointBucket,
  };

  return {
    ...tx,
    $transaction: vi.fn(async (callback: (innerTx: typeof tx) => unknown) => callback(tx)),
  };
}

const prismaMock = vi.hoisted(() => createPrismaMock());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/progress", () => ({
  buildUserProgressSnapshot: vi.fn(async () => {
    const state = mock.state!;
    return {
      userId: "u1",
      generatedAt: now().toISOString(),
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
      courses: state.progressSnapshot.courses.map((course) => ({
        courseId: course.courseId,
        title: course.courseId,
        subject: "math",
        status: course.status,
        percent: course.status === "completed" ? 100 : 0,
        completedLessons: 0,
        totalLessons: 0,
        completedTasks: 0,
        totalTasks: 0,
        startedAt: null,
        completedAt: null,
        lastActivityAt: null,
        lessons: [],
      })),
    };
  }),
}));

import { LOYALTY_RULES, awardCourseCompletionPoints, syncCompletedCourseLoyalty } from "@/lib/loyalty";

describe("loyalty progress accrual integration", () => {
  beforeEach(() => {
    mock.state = createState();
    vi.clearAllMocks();
  });

  it("awards points once per completed course even with different idempotency keys", async () => {
    const first = await awardCourseCompletionPoints({
      userId: "u1",
      courseId: "math-base",
      idempotencyKey: "manual_key_1",
    });
    const second = await awardCourseCompletionPoints({
      userId: "u1",
      courseId: "math-base",
      idempotencyKey: "manual_key_2",
    });

    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(mock.state!.transactions.filter((row) => row.reason === "COURSE_COMPLETION" && row.courseId === "math-base"))
      .toHaveLength(1);
    expect(mock.state!.buckets).toHaveLength(1);
    expect(mock.state!.account?.pointsBalance).toBe(LOYALTY_RULES.pointsPerCourseCompletion);
  });

  it("syncs completed courses idempotently and writes operation journal", async () => {
    mock.state!.progressSnapshot.courses = [
      { courseId: "math-base", status: "completed" },
      { courseId: "physics-base", status: "in_progress" },
      { courseId: "russian-base", status: "completed" },
    ];

    const firstSync = await syncCompletedCourseLoyalty("u1");
    const secondSync = await syncCompletedCourseLoyalty("u1");

    expect(firstSync).toEqual({
      completedCourses: 2,
      awardedCourses: 2,
      totalPointsAwarded: LOYALTY_RULES.pointsPerCourseCompletion * 2,
    });
    expect(secondSync).toEqual({
      completedCourses: 2,
      awardedCourses: 0,
      totalPointsAwarded: 0,
    });

    const journalRows = mock.state!.transactions.filter((row) => row.reason === "COURSE_COMPLETION");
    expect(journalRows).toHaveLength(2);
    expect(journalRows.map((row) => row.courseId).sort()).toEqual(["math-base", "russian-base"]);
  });
});
