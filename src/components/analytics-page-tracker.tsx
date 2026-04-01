"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function resolvePageEvent(pathname: string) {
  if (pathname === "/dashboard") return "dashboard_view" as const;
  if (pathname.startsWith("/courses/")) return "course_page_view" as const;
  if (pathname.startsWith("/lessons/")) return "lesson_page_view" as const;
  if (pathname === "/pricing") return "pricing_page_view" as const;
  return "site_page_view" as const;
}

export function AnalyticsPageTracker() {
  const pathname = usePathname() || "/";
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    if (!pathname || lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    const eventName = resolvePageEvent(pathname);
    void fetch("/api/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventName,
        path: pathname,
        payload: {
          source: "page_tracker",
        },
      }),
      keepalive: true,
    }).catch(() => {
      // best-effort telemetry
    });
  }, [pathname]);

  return null;
}

