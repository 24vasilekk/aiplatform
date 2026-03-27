import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { addChatMessage, getLessonKnowledge, listChatMessages } from "@/lib/db";
import { generateAiReply } from "@/lib/ai";

const schema = z.object({
  message: z.string().trim().min(1),
  mode: z.enum(["default", "beginner", "similar_task"]).default("default"),
  attachmentContext: z.string().trim().max(8000).optional(),
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
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const { lessonId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
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

    const assistant = await addChatMessage({
      userId: auth.user.id,
      chatType: "lesson",
      lessonId,
      role: "assistant",
      content: aiReply,
      mode: parsed.data.mode,
    });

    return NextResponse.json({ reply: assistant.content, message: assistant });
  } catch {
    const message = {
      id: `transient-${Date.now()}`,
      role: "assistant" as const,
      content: aiReply,
      mode: parsed.data.mode,
      createdAt: new Date().toISOString(),
    };
    return NextResponse.json({ reply: message.content, message });
  }
}
