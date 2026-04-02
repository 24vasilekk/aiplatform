export default function MaintenancePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-2xl font-semibold text-amber-900">Maintenance Mode</h1>
        <p className="mt-3 text-sm text-amber-900/90">
          Service is temporarily unavailable while we align database schema with the current release.
        </p>
        <p className="mt-2 text-sm text-amber-900/90">
          Try again in a few minutes. Health endpoints remain available for diagnostics.
        </p>
      </section>
    </main>
  );
}
