import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { addChatMessage, listChatMessages } from "@/lib/db";
import { generateAiReply } from "@/lib/ai";

const schema = z.object({
  message: z.string().trim().min(1),
  mode: z.enum(["default", "beginner", "similar_task"]).default("default"),
});

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const messages = await listChatMessages({
    userId: auth.user.id,
    chatType: "global",
    lessonId: null,
  });

  return NextResponse.json(messages);
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
  }

  await addChatMessage({
    userId: auth.user.id,
    chatType: "global",
    lessonId: null,
    role: "user",
    content: parsed.data.message,
    mode: parsed.data.mode,
  });

  const aiReply = await generateAiReply({
    message: parsed.data.message,
    mode: parsed.data.mode,
    context: "global-ege-chat",
  });

  const assistant = await addChatMessage({
    userId: auth.user.id,
    chatType: "global",
    lessonId: null,
    role: "assistant",
    content: aiReply,
    mode: parsed.data.mode,
  });

  return NextResponse.json({ reply: assistant.content, message: assistant });
}
