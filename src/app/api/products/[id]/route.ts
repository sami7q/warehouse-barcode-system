import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { productUpdateSchema } from "@/lib/validation";
import { isUniqueViolation } from "@/lib/db-errors";
import { notifyEmployees } from "@/lib/push";
import { deletedEvent, updatedEvent } from "@/lib/product-events";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** PUT /api/products/:id — edit a product. */
export async function PUT(req: NextRequest, ctx: Ctx) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "جسم الطلب غير صالح" }, { status: 400 });
  }

  const parsed = productUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "البيانات المدخلة غير صالحة";
    return NextResponse.json(
      { error: message, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = await db.query.products.findFirst({
    where: eq(products.id, id),
  });
  if (!existing) {
    return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
  }

  const input = parsed.data;
  try {
    const [updated] = await db
      .update(products)
      .set({
        name: input.name,
        purchasePrice: input.purchase_price,
        sellPrice: input.sell_price,
        unitPrice: input.unit_price,
        quantity: input.quantity,
        ...(input.barcode ? { barcode: input.barcode } : {}),
        updatedAt: Date.now(),
      })
      .where(eq(products.id, id))
      .returning();
    // Awaited for the same reason as on create (serverless may freeze work
    // left pending after the response); never throws. A save that changed
    // nothing visible (no field differs) notifies nobody.
    const event = updatedEvent(existing, updated);
    if (event) await notifyEmployees(event);
    return NextResponse.json({ product: updated });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "هذا الباركود مستخدم بالفعل لمنتج آخر" },
        { status: 409 },
      );
    }
    throw err;
  }
}

/** DELETE /api/products/:id */
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
  const deleted = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning();
  if (deleted.length === 0) {
    return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
  }
  await notifyEmployees(deletedEvent(deleted[0]));
  return NextResponse.json({ ok: true });
}
