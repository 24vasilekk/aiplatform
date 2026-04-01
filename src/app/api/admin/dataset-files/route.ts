import path from "node:path";
import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  createAdminAuditLog,
} from "@/lib/db";
import { ReadOps } from "@/lib/read-ops";
import { WriteOps } from "@/lib/write-ops";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt"]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/octet-stream",
]);

function normalizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "dataset-file";
}

function isAllowedExtension(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

async function authorize(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return { error: auth.error, user: null };
  }

  if (auth.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), user: null };
  }

  return { error: null, user: auth.user };
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const takeRaw = Number(searchParams.get("take") ?? "50");
  const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(Math.floor(takeRaw), 200)) : 50;
  const files = await ReadOps.listDatasetFiles(take);
  return NextResponse.json({ files });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) {
    return auth.error;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Пустой файл" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл слишком большой (до 20 MB)" }, { status: 400 });
  }

  const originalName = file.name || "dataset-file";
  if (!isAllowedExtension(originalName)) {
    return NextResponse.json({ error: "Поддерживаются только файлы pdf/docx/txt" }, { status: 400 });
  }

  const mimeType = (file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "Неподдерживаемый mime-type для выбранного формата" }, { status: 400 });
  }

  const storageDir = path.join(process.cwd(), "data", "dataset-files");
  await fs.mkdir(storageDir, { recursive: true });

  const safeName = normalizeFilename(originalName);
  const extension = path.extname(safeName);
  const baseName = path.basename(safeName, extension);
  const finalName = `${baseName}-${crypto.randomUUID()}${extension}`;
  const storagePath = path.join(storageDir, finalName);

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storagePath, bytes);

  const uploaded = await WriteOps.createDatasetFile({
    originalName,
    mimeType,
    sizeBytes: file.size,
    storagePath,
  });
  try {
    const explicitKey = request.headers.get("x-idempotency-key")?.trim() || null;
    const job = await WriteOps.enqueueDatasetFileProcessingJob({
      fileId: uploaded.id,
      idempotencyKey: explicitKey ? `dataset_process:${uploaded.id}:${explicitKey}` : undefined,
    });

    await createAdminAuditLog({
      adminUserId: auth.user.id,
      action: "upload_dataset_file_queued",
      entityType: "dataset_file",
      entityId: uploaded.id,
      metadata: {
        originalName,
        mimeType,
        sizeBytes: file.size,
        jobId: job.id,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        file: uploaded,
        job,
        processing: "queued",
      },
      { status: 202 },
    );
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown queueing error";
    const failed = await WriteOps.updateDatasetFileProcessingStatus({
      fileId: uploaded.id,
      status: "failed",
      processingError: details,
      processedAt: new Date(),
    }).catch(() => null);

    return NextResponse.json(
      {
        ok: false,
        error: "Файл загружен, но задача процессинга не поставлена в очередь.",
        details,
        file: failed ?? uploaded,
      },
      { status: 500 },
    );
  }
}
