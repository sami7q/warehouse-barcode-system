import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { pushSubscriptions, users } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * DELETE /api/users/:id — admin-only. Only ever removes an employee-role
 * row; an admin account can never be deleted through this endpoint.
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "هذا الإجراء متاح للمدير فقط" },
      { status: 403 },
    );
  }

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
  }

  const db = getDb();
  const target = await db.query.users.findFirst({
    where: eq(users.id, id),
  });
  if (!target) {
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
  }
  if (target.role !== "employee") {
    return NextResponse.json(
      { error: "لا يمكن حذف حساب مدير من هنا" },
      { status: 400 },
    );
  }

  // Explicit rather than relying on ON DELETE CASCADE, which SQLite only
  // honours when foreign_keys is switched on for the connection.
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, id));
  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
