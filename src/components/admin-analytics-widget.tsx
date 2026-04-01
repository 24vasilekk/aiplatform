import {
  ensureDailyMetricAggregates,
  getBlogPostViewCount,
  getLearningAnalyticsSnapshot,
  getRegistrationChannelStats,
  type DailyMetricAggregateRecord,
  type LearningAnalyticsSnapshotRecord,
  type RegistrationChannelStats,
} from "@/lib/db";

type PeriodStats = {
  label: string;
  registrations: RegistrationChannelStats;
  blogViews: number;
  learning: LearningAnalyticsSnapshotRecord;
};

function StatCard({ period }: { period: PeriodStats }) {
  return (
    <article className="card-soft p-5">
      <h3 className="mb-3 text-base font-semibold text-slate-900">{period.label}</h3>
      <div className="grid gap-2 text-sm text-slate-700">
        <p>
          Регистрации всего: <strong className="text-slate-900">{period.registrations.total}</strong>
        </p>
        <p>
          Email: <strong className="text-slate-900">{period.registrations.email}</strong>
        </p>
        <p>
          Google: <strong className="text-slate-900">{period.registrations.google}</strong>
        </p>
        <p>
          Telegram: <strong className="text-slate-900">{period.registrations.telegram}</strong>
        </p>
        <p className="pt-2">
          Просмотры блога: <strong className="text-slate-900">{period.blogViews}</strong>
        </p>
        <p className="pt-2">
          Активные ученики: <strong className="text-slate-900">{period.learning.activeUsers}</strong>
        </p>
        <p>
          DAU / WAU:{" "}
          <strong className="text-slate-900">
            {period.learning.dau} / {period.learning.wau}
          </strong>
        </p>
        <p>
          Прогресс уроков:{" "}
          <strong className="text-slate-900">
            {period.learning.lessonCompletions}/{period.learning.lessonProgressUpdates}
          </strong>
        </p>
        <p>
          Проверки заданий:{" "}
          <strong className="text-slate-900">
            {period.learning.taskCorrectAttempts}/{period.learning.taskAttempts}
          </strong>
        </p>
        <p>
          Сообщения в AI-чате: <strong className="text-slate-900">{period.learning.aiChatMessages}</strong>
        </p>
        <p>
          AI-анализы решений: <strong className="text-slate-900">{period.learning.aiSolutionAnalyses}</strong>
        </p>
        <p>
          Оплаты:{" "}
          <strong className="text-slate-900">
            {period.learning.paymentSuccesses} ({period.learning.paymentConversionPercent}%)
          </strong>
        </p>
        <p>
          Retention D1 / D7:{" "}
          <strong className="text-slate-900">
            {period.learning.retentionD1Percent}% / {period.learning.retentionD7Percent}%
          </strong>
        </p>
      </div>
    </article>
  );
}

function DailySeriesTable({ rows }: { rows: DailyMetricAggregateRecord[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">Дневные агрегаты пока недоступны. Запустите ops job.</p>;
  }

  const tail = rows.slice(-7).reverse();
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th className="px-3 py-2 font-medium">День (UTC)</th>
            <th className="px-3 py-2 font-medium">DAU</th>
            <th className="px-3 py-2 font-medium">WAU</th>
            <th className="px-3 py-2 font-medium">Рег.</th>
            <th className="px-3 py-2 font-medium">D1/D7</th>
            <th className="px-3 py-2 font-medium">Оплаты</th>
            <th className="px-3 py-2 font-medium">Выручка</th>
          </tr>
        </thead>
        <tbody>
          {tail.map((row) => (
            <tr key={row.day} className="border-t border-slate-100 text-slate-700">
              <td className="px-3 py-2">{row.day.slice(0, 10)}</td>
              <td className="px-3 py-2">{row.dau}</td>
              <td className="px-3 py-2">{row.wau}</td>
              <td className="px-3 py-2">{row.registrations}</td>
              <td className="px-3 py-2">
                {row.retainedD1}/{row.retainedD7}
              </td>
              <td className="px-3 py-2">
                {row.paidUsers} ({row.paymentConversion}%)
              </td>
              <td className="px-3 py-2">{(row.revenueCents / 100).toFixed(0)} ₽</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function AdminAnalyticsWidget() {
  let degradedMode = false;
  const emptyRegistrations: RegistrationChannelStats = { total: 0, email: 0, google: 0, telegram: 0 };
  const emptyLearning = (days: number): LearningAnalyticsSnapshotRecord => ({
    periodDays: days,
    registrations: 0,
    activeUsers: 0,
    dau: 0,
    wau: 0,
    lessonProgressUpdates: 0,
    lessonCompletions: 0,
    taskAttempts: 0,
    taskCorrectAttempts: 0,
    aiChatMessages: 0,
    aiSolutionAnalyses: 0,
    paymentSuccesses: 0,
    revenueCents: 0,
    paymentConversionPercent: 0,
    retentionD1Percent: 0,
    retentionD7Percent: 0,
  });

  let reg7 = emptyRegistrations;
  let reg30 = emptyRegistrations;
  let views7 = 0;
  let views30 = 0;
  let learn7 = emptyLearning(7);
  let learn30 = emptyLearning(30);
  let series30: DailyMetricAggregateRecord[] = [];

  try {
    reg7 = await getRegistrationChannelStats(7);
  } catch {
    degradedMode = true;
  }
  try {
    reg30 = await getRegistrationChannelStats(30);
  } catch {
    degradedMode = true;
  }
  try {
    views7 = await getBlogPostViewCount(7);
  } catch {
    degradedMode = true;
  }
  try {
    views30 = await getBlogPostViewCount(30);
  } catch {
    degradedMode = true;
  }
  try {
    learn7 = await getLearningAnalyticsSnapshot(7);
  } catch {
    degradedMode = true;
  }
  try {
    learn30 = await getLearningAnalyticsSnapshot(30);
  } catch {
    degradedMode = true;
  }
  try {
    series30 = await ensureDailyMetricAggregates(30);
  } catch {
    degradedMode = true;
  }

  const periods: PeriodStats[] = [
    { label: "Последние 7 дней", registrations: reg7, blogViews: views7, learning: learn7 },
    { label: "Последние 30 дней", registrations: reg30, blogViews: views30, learning: learn30 },
  ];

  return (
    <section className="panel-accent space-y-3">
      <div>
        <h2>Дашборд Часть 2-4</h2>
        <p className="text-sm text-slate-700">
          Каналы регистрации, воронка обучения, AI-активность и дневные продуктовые агрегаты.
        </p>
        {degradedMode ? (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            Данные показаны частично: часть таблиц БД недоступна или миграции не применены.
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {periods.map((period) => (
          <StatCard key={period.label} period={period} />
        ))}
      </div>
      <DailySeriesTable rows={series30} />
    </section>
  );
}
