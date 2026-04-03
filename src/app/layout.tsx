import type { Metadata } from "next";
import { TopNav } from "@/components/top-nav";
import { AnalyticsPageTracker } from "@/components/analytics-page-tracker";
import { getCurrentUser } from "@/lib/auth";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "EGE AI Platform MVP",
  description: "MVP платформа подготовки к ЕГЭ по математике и физике",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <AnalyticsPageTracker />
        <TopNav initialRole={user?.role ?? null} />
        <main className="page-shell mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
      </body>
    </html>
  );
}
