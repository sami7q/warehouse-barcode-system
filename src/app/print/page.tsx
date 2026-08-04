import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { renderBarcodeSvg } from "@/lib/barcode-svg";
import Label from "@/components/print/Label";
import PrintStyles from "@/components/print/PrintStyles";
import PrintTrigger from "@/components/print/PrintTrigger";

export const dynamic = "force-dynamic";

/** /print?ids=1,2,3 — label-only layout for one or more products. */
export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: rawIds } = await searchParams;
  const ids = (rawIds ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length === 0) notFound();

  const db = getDb();
  const rows = await db
    .select()
    .from(products)
    .where(inArray(products.id, ids));
  if (rows.length === 0) notFound();

  // Preserve the order the ids were passed in.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <>
      <PrintStyles />
      <PrintTrigger />
      {ordered.map((p) => (
        <Label
          key={p.id}
          product={p}
          svg={renderBarcodeSvg(p.barcode, { includeText: false })}
        />
      ))}
    </>
  );
}
