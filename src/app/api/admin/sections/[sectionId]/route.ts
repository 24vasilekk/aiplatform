import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { createAdminAuditLog, deleteCustomSection, updateCustomSection } from "@/lib/db";

const schema = z.object({
  title: z.string().trim().min(2),
});

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;

  const { sectionId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные раздела" }, { status: 400 });
  }

  const section = await updateCustomSection(sectionId, parsed.data);
  if (!section) {
    return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
  }
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "update_section",
    entityType: "section",
    entityId: section.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true, section });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const auth = await authorize(request);
  if (auth.error || !auth.user) return auth.error;

  const { sectionId } = await params;
  const ok = await deleteCustomSection(sectionId);

  if (!ok) {
    return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
  }
  await createAdminAuditLog({
    adminUserId: auth.user.id,
    action: "delete_section",
    entityType: "section",
    entityId: sectionId,
  });

  return NextResponse.json({ ok: true });
}
