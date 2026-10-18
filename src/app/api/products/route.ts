import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { assembleBarcode } from "@/lib/ean13";
import { getBarcodePrefix } from "@/lib/constants";
import { renderBarcodeSvg } from "@/lib/barcode-svg";
import { productCreateSchema } from "@/lib/validation";
import { isUniqueViolation } from "@/lib/db-errors";
import { serialized, withBusyRetry } from "@/lib/serialize";
import { notifyEmployeesOfNewProduct } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * GET /api/products
 *   ?barcode=X → exact-barcode lookup: single product or 404
 *   ?q=X       → exact barcode OR partial case-insensitive name match
 *   (none)     → full list, newest first
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const db = getDb();
  const { searchParams } = req.nextUrl;
  const barcode = searchParams.get("barcode")?.trim();
  const q = searchParams.get("q")?.trim();

  if (barcode) {
    const product = await db.query.products.findFirst({
      where: eq(products.barcode, barcode),
    });
    if (!product) {
      return NextResponse.json(
        { error: "لا يوجد منتج بهذا الباركود" },
        { status: 404 },
      );
    }
    return NextResponse.json({ product });
  }

  const all = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt), desc(products.id));

  if (q) {
    const needle = q.toLowerCase();
    const filtered = all.filter(
      (p) => p.barcode === q || p.name.toLowerCase().includes(needle),
    );
    return NextResponse.json({ products: filtered });
  }

  return NextResponse.json({ products: all });
}

/**
 * POST /api/products — create a product; generates a unique EAN-13 barcode
 * atomically (placeholder insert → id → prefix+sequence+check digit → update)
 * unless a manual barcode was supplied.
 */
export async function POST(req: NextRequest) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "جسم الطلب غير صالح" }, { status: 400 });
  }

  const parsed = productCreateSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "البيانات المدخلة غير صالحة";
    return NextResponse.json(
      { error: message, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const prefix = getBarcodePrefix();
  const db = getDb();
  const now = Date.now();

  try {
    const product = await serialized(() =>
      withBusyRetry(() =>
        db.transaction(async (tx) => {
      const placeholder = input.barcode ?? `pending-${randomUUID()}`;
      const [inserted] = await tx
        .insert(products)
        .values({
          barcode: placeholder,
          name: input.name,
          purchasePrice: input.purchase_price,
          sellPrice: input.sell_price,
          unitPrice: input.unit_price,
          quantity: input.quantity,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (input.barcode) return inserted;

      const barcode = assembleBarcode(prefix, inserted.id);
      const [updated] = await tx
        .update(products)
        .set({ barcode })
        .where(eq(products.id, inserted.id))
        .returning();
          return updated;
        }),
      ),
    );

    // Awaited rather than fire-and-forget: on serverless, work still pending
    // after the response is sent can be frozen and the push never delivered.
    // It never throws and each send has its own timeout.
    await notifyEmployeesOfNewProduct(product);

    return NextResponse.json(
      { product, svg: renderBarcodeSvg(product.barcode) },
      { status: 201 },
    );
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
