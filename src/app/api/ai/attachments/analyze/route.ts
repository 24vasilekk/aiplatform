import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { buildAttachmentContext, extractTimecodes, extractUploadContent } from "@/lib/attachment-ai";
import { findUserUploadById, updateUserUploadText } from "@/lib/db";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  uploadId: z.string().trim().min(10),
  videoDurationSec: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "ai-attachments-analyze",
    keySuffix: auth.user.id,
    limit: 30,
    windowMs: 10 * 60 * 1_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много AI-запросов. Попробуйте позже.");
  }

  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Ожидается JSON-запрос" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Неверные данные запроса" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const upload = await findUserUploadById(parsed.data.uploadId, auth.user.id);
  if (!upload) {
    const response = NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const extracted = await extractUploadContent({
    mimeType: upload.mimeType,
    originalName: upload.originalName,
    storagePath: upload.storagePath,
  });
  const extractedText = extracted.extractedText;

  const savedUpload = await updateUserUploadText(upload.id, extractedText);
  const timecodes = extractTimecodes(extractedText, parsed.data.videoDurationSec);
  const outOfRange = timecodes.filter((item) => !item.inRange).map((item) => item.raw);

  const context = buildAttachmentContext({
    originalName: upload.originalName,
    mimeType: upload.mimeType,
    extractedText,
    timecodes,
  });

  const response = NextResponse.json({
    ok: true,
    upload: savedUpload,
    extractedText,
    timecodes,
    hasOutOfRangeTimecodes: outOfRange.length > 0,
    outOfRangeTimecodes: outOfRange,
    context,
  });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}
