import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { addChatMessage, createAnalyticsEvent, getLessonKnowledge, listChatMessages } from "@/lib/db";
import { generateAiReply } from "@/lib/ai";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  message: z.string().trim().min(1),
  mode: z.enum(["default", "beginner", "similar_task"]).default("default"),
  attachmentContext: z.string().trim().max(8000).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const { lessonId } = await params;
  try {
    const messages = await listChatMessages({
      userId: auth.user.id,
      chatType: "lesson",
      lessonId,
    });

    return NextResponse.json(messages);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const requestPath = new URL(request.url).pathname;
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "chat-lesson-messages",
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

  const { lessonId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    const response = NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const knowledge = await getLessonKnowledge(lessonId);
  const contextualAttachment = [knowledge?.extractedText ? `Теория урока:\n${knowledge.extractedText}` : "", parsed.data.attachmentContext ?? ""]
    .filter(Boolean)
    .join("\n\n");

  const aiReply = await generateAiReply({
    message: parsed.data.message,
    mode: parsed.data.mode,
    context: `lesson:${lessonId}`,
    attachmentContext: contextualAttachment || undefined,
  });

  try {
    await addChatMessage({
      userId: auth.user.id,
      chatType: "lesson",
      lessonId,
      role: "user",
      content: parsed.data.message,
      mode: parsed.data.mode,
    });
    await createAnalyticsEvent({
      eventName: "ai_chat_message",
      userId: auth.user.id,
      path: requestPath,
      payload: {
        scope: "lesson",
        lessonId,
        mode: parsed.data.mode,
      },
    });

    const assistant = await addChatMessage({
      userId: auth.user.id,
      chatType: "lesson",
      lessonId,
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
