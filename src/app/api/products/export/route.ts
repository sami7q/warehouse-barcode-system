import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { fmtDate, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/** GET /api/products/export — build an .xlsx with the table columns. */
export async function GET() {
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

  const db = getDb();
  const all = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt), desc(products.id));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("المنتجات", {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { header: "#", key: "n", width: 6 },
    { header: "الباركود", key: "barcode", width: 18 },
    { header: "اسم المنتج", key: "name", width: 28 },
    { header: "سعر الشراء", key: "purchase", width: 14 },
    { header: "سعر البيع", key: "sell", width: 14 },
    { header: "سعر المفرد", key: "unit", width: 14 },
    { header: "الكمية", key: "qty", width: 10 },
    { header: "تاريخ الإدخال", key: "date", width: 14 },
    { header: "ساعة الإدخال", key: "time", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  all.forEach((p, i) => {
    sheet.addRow({
      n: i + 1,
      barcode: p.barcode,
      name: p.name,
      purchase: p.purchasePrice,
      sell: p.sellPrice,
      unit: p.unitPrice,
      qty: p.quantity,
      date: fmtDate(p.createdAt),
      time: fmtTime(p.createdAt),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="products.xlsx"; filename*=UTF-8''${encodeURIComponent("المنتجات")}.xlsx`,
    },
  });
}
