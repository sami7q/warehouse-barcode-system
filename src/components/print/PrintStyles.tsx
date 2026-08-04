import {
  LABEL_BARCODE_HEIGHT_MM,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
} from "@/lib/constants";

/**
 * Print CSS driven by the named label-size constants (Section 7).
 *
 * Content height budget (must stay well under LABEL_HEIGHT_MM — overflowing
 * the fixed box clips the product name off the top and can spill to a second
 * page): padding 2mm + name ~3.8mm + barcode 11mm + digits ~3.2mm +
 * price ~3.8mm + 3 gaps 2.1mm ≈ 26mm of 30mm → 4mm slack for font metrics.
 */
export default function PrintStyles() {
  const css = `
@page { size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm; margin: 0; }
html, body { background: #fff; margin: 0; padding: 0; }
.print-label {
  width: ${LABEL_WIDTH_MM}mm;
  height: ${LABEL_HEIGHT_MM}mm;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.7mm;
  padding: 1mm;
  overflow: hidden;
  text-align: center;
  line-height: 1.2;
  background: #fff;
  color: #000;
}
/* Page break BETWEEN consecutive labels only. Never use a last-child/
   last-of-type break-after rule here: Next.js appends its route-announcer
   div to <body> after hydration, which silently re-enables the break on the
   "last" label and emits a trailing blank page (1 label printed as 2). */
.print-label + .print-label {
  break-before: page;
  page-break-before: always;
}
.label-name {
  font-size: 9pt;
  font-weight: 700;
  max-width: ${LABEL_WIDTH_MM - 4}mm;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.label-barcode {
  width: ${LABEL_WIDTH_MM - 8}mm;
  height: ${LABEL_BARCODE_HEIGHT_MM}mm;
  object-fit: contain;
}
.label-digits { font-size: 7.5pt; letter-spacing: 1px; }
.label-price { font-size: 9pt; font-weight: 700; }
@media screen {
  body { background: #e8ebf2; }
  .print-label {
    margin: 8px auto;
    border: 1px dashed #101c36;
    border-radius: 6px;
  }
}
`;
  return <style>{css}</style>;
}
