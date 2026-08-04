import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { renderBarcodeSvg } from "@/lib/barcode-svg";
import Label from "@/components/print/Label";
import PrintStyles from "@/components/print/PrintStyles";
import PrintTrigger from "@/components/print/PrintTrigger";

export const dynamic = "force-dynamic";

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
      <Label
        product={product}
        svg={renderBarcodeSvg(product.barcode, { includeText: false })}
      />
    </>
  );
}
