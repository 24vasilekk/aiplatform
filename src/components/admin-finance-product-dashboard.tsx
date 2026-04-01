import { getFinanceProductDashboard, type FinanceProductDashboard } from "@/lib/finance-product-analytics";

function StatusCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export async function AdminFinanceProductDashboard({ days = 30 }: { days?: number }) {
  const safeDays = Math.max(1, Math.min(Math.floor(days), 365));
  let degradedMode = false;
  let dashboard: FinanceProductDashboard = {
    periodDays: safeDays,
    revenueCents: 0,
    paymentConversionPercent: 0,
    activeStudents: 0,
    dau: 0,
    wau: 0,
    retentionD1Percent: 0,
    retentionD7Percent: 0,
    paymentStatus: {
      created: 0,
      requires_action: 0,
      processing: 0,
      succeeded: 0,
      failed: 0,
      canceled: 0,
      total: 0,
    },
    topCourses: [],
  };

  try {
    dashboard = await getFinanceProductDashboard(safeDays);
  } catch {
    degradedMode = true;
  }

  return (
    <section className="panel-accent space-y-3">
      <div>
        <h2>Финансы и продукт</h2>
        <p className="text-sm text-slate-700">Период: последние {dashboard.periodDays} дней (реальные данные БД).</p>
        {degradedMode ? (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            Финансовая аналитика временно в fallback-режиме. Проверьте, что миграции БД применены.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="card-soft p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Выручка</p>
          <p className="text-xl font-semibold text-slate-900">{(dashboard.revenueCents / 100).toFixed(2)} ₽</p>
        </div>
        <div className="card-soft p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Конверсия в оплату</p>
          <p className="text-xl font-semibold text-slate-900">{dashboard.paymentConversionPercent}%</p>
        </div>
        <div className="card-soft p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Активные ученики</p>
          <p className="text-xl font-semibold text-slate-900">{dashboard.activeStudents}</p>
          <p className="text-xs text-slate-600">
            DAU/WAU: {dashboard.dau}/{dashboard.wau}
          </p>
        </div>
        <div className="card-soft p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Retention D1</p>
          <p className="text-xl font-semibold text-slate-900">{dashboard.retentionD1Percent}%</p>
        </div>
        <div className="card-soft p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Retention D7</p>
          <p className="text-xl font-semibold text-slate-900">{dashboard.retentionD7Percent}%</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="card-soft p-4">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Платежи по статусам</h3>
          <div className="grid grid-cols-2 gap-2">
            <StatusCard label="succeeded" value={dashboard.paymentStatus.succeeded} />
            <StatusCard label="processing" value={dashboard.paymentStatus.processing} />
            <StatusCard label="requires_action" value={dashboard.paymentStatus.requires_action} />
            <StatusCard label="failed" value={dashboard.paymentStatus.failed} />
            <StatusCard label="canceled" value={dashboard.paymentStatus.canceled} />
            <StatusCard label="created" value={dashboard.paymentStatus.created} />
          </div>
          <p className="mt-3 text-sm text-slate-700">Всего платежей: {dashboard.paymentStatus.total}</p>
        </article>

        <article className="card-soft p-4">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Топ-курсы по выручке</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Курс</th>
                  <th className="px-3 py-2 font-medium">Покупок</th>
                  <th className="px-3 py-2 font-medium">Выручка</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.topCourses.map((course) => (
                  <tr key={course.courseId} className="border-t border-slate-100 text-slate-700">
                    <td className="px-3 py-2">{course.title}</td>
                    <td className="px-3 py-2">{course.purchases}</td>
                    <td className="px-3 py-2">{(course.revenueCents / 100).toFixed(2)} ₽</td>
                  </tr>
                ))}
                {dashboard.topCourses.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-slate-600" colSpan={3}>
                      Нет оплаченных курсов в выбранный период.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
