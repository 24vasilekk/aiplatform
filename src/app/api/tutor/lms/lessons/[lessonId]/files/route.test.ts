import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRolesMock: vi.fn(),
  canTutorManageLessonMock: vi.fn(),
  getTutorLessonKnowledgeMock: vi.fn(),
  upsertTutorLessonKnowledgeMock: vi.fn(),
  deleteTutorLessonKnowledgeMock: vi.fn(),
  createAdminAuditLogMock: vi.fn(),
  extractUploadContentMock: vi.fn(),
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
  rmMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireRoles: mocks.requireRolesMock,
}));

vi.mock("@/lib/attachment-ai", () => ({
  extractUploadContent: mocks.extractUploadContentMock,
}));

vi.mock("@/lib/db", () => ({
  canTutorManageLesson: mocks.canTutorManageLessonMock,
  getTutorLessonKnowledge: mocks.getTutorLessonKnowledgeMock,
  upsertTutorLessonKnowledge: mocks.upsertTutorLessonKnowledgeMock,
  deleteTutorLessonKnowledge: mocks.deleteTutorLessonKnowledgeMock,
  createAdminAuditLog: mocks.createAdminAuditLogMock,
}));

vi.mock("node:fs", () => ({
  default: {
    promises: {
      mkdir: mocks.mkdirMock,
      writeFile: mocks.writeFileMock,
      rm: mocks.rmMock,
    },
  },
  promises: {
    mkdir: mocks.mkdirMock,
    writeFile: mocks.writeFileMock,
    rm: mocks.rmMock,
  },
}));

import { DELETE, GET, POST } from "@/app/api/tutor/lms/lessons/[lessonId]/files/route";

function makeUploadRequest(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return {
    url: "http://localhost/api/tutor/lms/lessons/lesson_1/files",
    formData: async () => formData,
  } as Request;
}

describe("/api/tutor/lms/lessons/[lessonId]/files", () => {
  beforeEach(() => {
    mocks.requireRolesMock.mockResolvedValue({
      user: { id: "tutor_1", email: "tutor@ege.local", role: "tutor" },
      error: null,
    });
    mocks.canTutorManageLessonMock.mockResolvedValue(true);
    mocks.getTutorLessonKnowledgeMock.mockResolvedValue(null);
    mocks.upsertTutorLessonKnowledgeMock.mockResolvedValue({
      id: "lk_1",
      lessonId: "lesson_1",
      originalName: "plan.pdf",
      mimeType: "application/pdf",
      storagePath: "/repo/data/lesson-knowledge/tutors/tutor_1/file.pdf",
      extractedText: "text",
      summary: "summary",
      pageCount: 1,
      textChars: 4,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });
    mocks.createAdminAuditLogMock.mockResolvedValue(null);
    mocks.extractUploadContentMock.mockResolvedValue({
      extractedText: "text",
      summary: "summary",
      pageCount: 1,
      textChars: 4,
    });
    mocks.mkdirMock.mockResolvedValue(undefined);
    mocks.writeFileMock.mockResolvedValue(undefined);
    mocks.rmMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("uploads valid pdf and writes audit", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const request = makeUploadRequest(new File([pdfBytes], "plan.pdf", { type: "application/pdf" }));

    const response = await POST(request as never, { params: Promise.resolve({ lessonId: "lesson_1" }) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.knowledge?.storagePath).toBeUndefined();
    expect(data.knowledge?.extractedText).toBeUndefined();
    expect(mocks.upsertTutorLessonKnowledgeMock).toHaveBeenCalled();
    expect(mocks.createAdminAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tutor_lms_upsert_lesson_file",
      }),
    );
  });

  it("returns sanitized knowledge in GET response", async () => {
    mocks.getTutorLessonKnowledgeMock.mockResolvedValue({
      id: "lk_get",
      lessonId: "lesson_1",
      originalName: "plan.pdf",
      mimeType: "application/pdf",
      storagePath: "/secret/path/plan.pdf",
      extractedText: "private text",
      summary: "summary",
      pageCount: 2,
      textChars: 120,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });

    const response = await GET(
      new Request("http://localhost/api/tutor/lms/lessons/lesson_1/files") as never,
      { params: Promise.resolve({ lessonId: "lesson_1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.knowledge.storagePath).toBeUndefined();
    expect(data.knowledge.extractedText).toBeUndefined();
    expect(data.knowledge.originalName).toBe("plan.pdf");
  });

  it("rejects unsupported file type", async () => {
    const request = makeUploadRequest(new File([new Uint8Array([1, 2, 3])], "virus.exe", { type: "application/x-msdownload" }));
    const response = await POST(request as never, { params: Promise.resolve({ lessonId: "lesson_1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("PDF");
    expect(mocks.upsertTutorLessonKnowledgeMock).not.toHaveBeenCalled();
  });

  it("rejects signature mismatch", async () => {
    const request = makeUploadRequest(new File([new Uint8Array([1, 2, 3, 4])], "fake.pdf", { type: "application/pdf" }));
    const response = await POST(request as never, { params: Promise.resolve({ lessonId: "lesson_1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Сигнатура");
    expect(mocks.writeFileMock).not.toHaveBeenCalled();
  });

  it("replaces previous file and removes old storage file", async () => {
    mocks.getTutorLessonKnowledgeMock.mockResolvedValue({
      id: "lk_old",
      lessonId: "lesson_1",
      originalName: "old.pdf",
      mimeType: "application/pdf",
      storagePath: "/Users/vasilekk/web ai/ege-mvp/data/lesson-knowledge/tutors/tutor_1/old.pdf",
      extractedText: "old",
      summary: null,
      pageCount: 1,
      textChars: 3,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const request = makeUploadRequest(new File([pdfBytes], "new.pdf", { type: "application/pdf" }));

    const response = await POST(request as never, { params: Promise.resolve({ lessonId: "lesson_1" }) });
    expect(response.status).toBe(201);
    expect(mocks.rmMock).toHaveBeenCalledWith(
      "/Users/vasilekk/web ai/ege-mvp/data/lesson-knowledge/tutors/tutor_1/old.pdf",
      { force: true },
    );
  });

  it("deletes knowledge and file from disk", async () => {
    mocks.getTutorLessonKnowledgeMock.mockResolvedValue({
      id: "lk_1",
      lessonId: "lesson_1",
      originalName: "plan.pdf",
      mimeType: "application/pdf",
      storagePath: "/Users/vasilekk/web ai/ege-mvp/data/lesson-knowledge/tutors/tutor_1/plan.pdf",
      extractedText: "text",
      summary: "summary",
      pageCount: 1,
      textChars: 4,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });
    mocks.deleteTutorLessonKnowledgeMock.mockResolvedValue(true);

    const response = await DELETE(
      new Request("http://localhost/api/tutor/lms/lessons/lesson_1/files", { method: "DELETE" }) as never,
      { params: Promise.resolve({ lessonId: "lesson_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.rmMock).toHaveBeenCalledWith(
      "/Users/vasilekk/web ai/ege-mvp/data/lesson-knowledge/tutors/tutor_1/plan.pdf",
      { force: true },
    );
    expect(mocks.createAdminAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tutor_lms_delete_lesson_file",
        entityId: "lk_1",
      }),
    );
  });

  it("returns auth error as-is", async () => {
    mocks.requireRolesMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await DELETE(
      new Request("http://localhost/api/tutor/lms/lessons/lesson_1/files", { method: "DELETE" }) as never,
      { params: Promise.resolve({ lessonId: "lesson_1" }) },
    );
    expect(response.status).toBe(403);
  });
});
