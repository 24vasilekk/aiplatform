import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createAnalyticsEvent } from "@/lib/db";

const schema = z.object({
  eventName: z.enum([
    "blog_post_view",
    "blog_post_share",
    "site_page_view",
    "dashboard_view",
    "course_page_view",
    "lesson_page_view",
    "pricing_page_view",
    "checkout_created",
    "payment_succeeded",
    "payment_failed",
    "payment_canceled",
  ]),
  path: z.string().trim().max(300).optional(),
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные события" }, { status: 400 });
  }

  const user = await getCurrentUser();
  await createAnalyticsEvent({
    eventName: parsed.data.eventName,
    userId: user?.id,
    path: parsed.data.path ?? request.nextUrl.pathname,
    payload: parsed.data.payload ?? null,
  });

  return NextResponse.json({ ok: true });
}
