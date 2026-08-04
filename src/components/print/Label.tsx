import type { Product } from "@/db/schema";
import { fmtNumber } from "@/lib/format";

/** One thermal label: product name, EAN-13 image, digits, sell price. */
export default function Label({
  product,
  svg,
}: {
  product: Product;
  svg: string;
}) {
  return (
    <div className="print-label" dir="rtl" data-testid="print-label">
      <div className="label-name">{product.name}</div>
      {/* SVG via <img> data URI — inert, cannot run scripts */}
      <img
        className="label-barcode"
        alt={`باركود ${product.barcode}`}
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      />
      <div className="label-digits" dir="ltr">
        {product.barcode}
      </div>
      <div className="label-price" dir="ltr">
        {fmtNumber(product.sellPrice)} دينار
      </div>
    </div>
  );
}
