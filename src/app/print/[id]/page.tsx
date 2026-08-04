import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { renderBarcodeSvg } from "@/lib/barcode-svg";
import Label from "@/components/print/Label";
import PrintStyles from "@/components/print/PrintStyles";
import PrintTrigger from "@/components/print/PrintTrigger";

export const dynamic = "force-dynamic";

/**
 * Print routes get their own title: browsers print the document title in the
 * page header, so inheriting "إدارة المخازن" put app branding on the label.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (Number.isInteger(id) && id > 0) {
    const product = await getDb().query.products.findFirst({
      where: eq(products.id, id),
    });
    if (product) return { title: product.name };
  }
  return { title: "ملصق باركود" };
}

/** /print/[id] — label-only layout for a single product, no app chrome. */
export default async function PrintOnePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = getDb();
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
  });
  if (!product) notFound();

  return (
    <>
      <PrintStyles />
      <PrintTrigger />
      <main className="print-labels">
        <Label
          product={product}
          svg={renderBarcodeSvg(product.barcode, { includeText: false })}
        />
      </main>
    </>
  );
}
