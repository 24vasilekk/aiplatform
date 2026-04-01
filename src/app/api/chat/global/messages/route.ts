import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { addChatMessage, createAnalyticsEvent, listChatMessages } from "@/lib/db";
import { generateAiReply } from "@/lib/ai";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  message: z.string().trim().min(1),
  mode: z.enum(["default", "beginner", "similar_task"]).default("default"),
  attachmentContext: z.string().trim().max(8000).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  try {
    const messages = await listChatMessages({
      userId: auth.user.id,
      chatType: "global",
      lessonId: null,
    });

    return NextResponse.json(messages);
  } catch {
    // On serverless environments without writable fs, chat history may be unavailable.
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const requestPath = new URL(request.url).pathname;
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "chat-global-messages",
    keySuffix: auth.user.id,
    limit: 40,
    windowMs: 10 * 60 * 1_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много сообщений в чат. Попробуйте позже.");
  }

  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Ожидается JSON-запрос" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    const response = NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const aiReply = await generateAiReply({
    message: parsed.data.message,
    mode: parsed.data.mode,
    context: "global-ege-chat",
    attachmentContext: parsed.data.attachmentContext ?? undefined,
  });

  try {
    await addChatMessage({
      userId: auth.user.id,
      chatType: "global",
      lessonId: null,
      role: "user",
      content: parsed.data.message,
      mode: parsed.data.mode,
    });
    await createAnalyticsEvent({
      eventName: "ai_chat_message",
      userId: auth.user.id,
      path: requestPath,
      payload: {
        scope: "global",
        mode: parsed.data.mode,
      },
    });

    const assistant = await addChatMessage({
      userId: auth.user.id,
      chatType: "global",
      lessonId: null,
      role: "assistant",
      content: aiReply,
      mode: parsed.data.mode,
    });

    const response = NextResponse.json({ reply: assistant.content, message: assistant });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  } catch {
    const message = {
      id: `transient-${Date.now()}`,
      role: "assistant" as const,
      content: aiReply,
      mode: parsed.data.mode,
      createdAt: new Date().toISOString(),
    };
    const response = NextResponse.json({ reply: message.content, message });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }
}
