"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentProps } from "react";
import { WalletPanel } from "@/components/wallet-panel";
import { LoyaltyPanel } from "@/components/loyalty-panel";

type WalletSnapshot = ComponentProps<typeof WalletPanel>["initialSnapshot"];
type LoyaltySnapshot = ComponentProps<typeof LoyaltyPanel>["initialSnapshot"];
type LoyaltyQuotes = ComponentProps<typeof LoyaltyPanel>["initialQuotes"];

type CourseCard = {
  id: string;
  subject: string;
  title: string;
  description: string;
  hasAccess: boolean;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
};

type Props = {
  userEmail: string;
  degradedMode: boolean;
  progressPercent: number;
  progressLessonsLabel: string;
  walletSnapshot: WalletSnapshot;
  loyaltySnapshot: LoyaltySnapshot;
  loyaltyQuotes: LoyaltyQuotes;
  courses: CourseCard[];
};

type Panel = "wallet" | "loyalty" | "courses" | null;

function togglePanel(current: Panel, next: Exclude<Panel, null>) {
  return current === next ? null : next;
}

export function StudentDashboardOverview({
  userEmail,
  degradedMode,
  progressPercent,
  progressLessonsLabel,
  walletSnapshot,
  loyaltySnapshot,
  loyaltyQuotes,
  courses,
}: Props) {
  const [activePanel, setActivePanel] = useState<Panel>(null);

  const coursesStats = useMemo(() => {
    const total = courses.length;
    const opened = courses.filter((course) => course.hasAccess).length;
    return {
      total,
      opened,
      locked: Math.max(0, total - opened),
    };
  }, [courses]);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1>Личный кабинет</h1>
        <p className="text-sm text-slate-700">Пользователь: {userEmail}</p>
        {degradedMode ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Часть данных временно недоступна. Обычно это значит, что миграции БД еще не применены.
          </p>
        ) : null}
        <p className="text-sm text-slate-700">Прогресс: {progressPercent}% ({progressLessonsLabel})</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <article
          className={`card-soft flex h-full min-h-[190px] cursor-pointer flex-col justify-between p-5 transition ${
            activePanel === "wallet" ? "ring-2 ring-sky-300" : ""
          } md:col-span-1`}
          onClick={() => setActivePanel((current) => togglePanel(current, "wallet"))}
        >
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-sky-700">Баланс</p>
            <p className="text-2xl font-semibold text-slate-900">
              {(walletSnapshot.wallet.balanceCents / 100).toFixed(0)} ₽
            </p>
            <p className="text-sm text-slate-700">Операций: {walletSnapshot.totalTransactions}</p>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            {activePanel === "wallet" ? "Нажмите, чтобы скрыть детали" : "Нажмите, чтобы открыть кошелек"}
          </p>
        </article>

        <article
          className={`card-soft flex h-full min-h-[190px] cursor-pointer flex-col justify-between p-5 transition ${
            activePanel === "loyalty" ? "ring-2 ring-sky-300" : ""
          } md:col-span-1`}
          onClick={() => setActivePanel((current) => togglePanel(current, "loyalty"))}
        >
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-sky-700">Лояльность</p>
            <p className="text-2xl font-semibold text-slate-900">{loyaltySnapshot.pointsBalance} баллов</p>
            <p className="text-sm text-slate-700">
              Списано: {loyaltySnapshot.lifetimeRedeemedPoints} · Начислено: {loyaltySnapshot.lifetimeEarnedPoints}
            </p>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            {activePanel === "loyalty" ? "Нажмите, чтобы скрыть детали" : "Нажмите, чтобы открыть лояльность"}
          </p>
        </article>

        <article
          className={`card-soft flex min-h-[190px] cursor-pointer flex-col justify-between gap-3 p-5 transition ${
            activePanel === "courses" ? "ring-2 ring-sky-300" : ""
          } md:col-span-2`}
          onClick={() => setActivePanel((current) => togglePanel(current, "courses"))}
        >
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-sky-700">Курсы и оплата</p>
            <h2 className="text-xl font-semibold text-slate-900">Ваши программы и доступ</h2>
            <p className="text-sm text-slate-700">
              Открыто: {coursesStats.opened} из {coursesStats.total} · Закрыто: {coursesStats.locked}
            </p>
          </div>
          <p className="text-sm text-slate-600">
            {activePanel === "courses"
              ? "Нажмите, чтобы скрыть курсы и оплату"
              : "Нажмите, чтобы открыть курсы и варианты оплаты"}
          </p>
        </article>
      </div>

      {activePanel === "wallet" ? <WalletPanel initialSnapshot={walletSnapshot} /> : null}
      {activePanel === "loyalty" ? (
        <LoyaltyPanel initialSnapshot={loyaltySnapshot} initialQuotes={loyaltyQuotes} />
      ) : null}
      {activePanel === "courses" ? (
        <section className="space-y-4">
          <article className="panel-accent flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Курсы и доступ</h2>
              <p className="text-sm text-slate-700">
                Выберите курс ниже или откройте страницу оплаты для покупки доступа.
              </p>
            </div>
            <Link href="/pricing" className="btn-primary inline-flex w-fit">
              Открыть оплату
            </Link>
          </article>

          <div id="courses-list" className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <article key={course.id} className="card-soft card-soft-hover flex h-full flex-col p-6">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-sky-700">{course.subject}</p>
                  <h2>{course.title}</h2>
                  <p className="text-sm text-slate-700">{course.description}</p>
                </div>
                <p className="mt-4 text-sm">
                  Прогресс: {course.progressPercent}% ({course.completedLessons}/{course.totalLessons} уроков)
                </p>
                <div className="mt-auto pt-6">
                  {course.hasAccess ? (
                    <Link href={`/courses/${course.id}`} className="btn-primary inline-flex w-fit">
                      Открыть курс
                    </Link>
                  ) : (
                    <Link href="/pricing" className="btn-ghost inline-flex w-fit">
                      Открыть доступ
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
