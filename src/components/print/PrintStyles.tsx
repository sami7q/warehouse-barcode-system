import { LABEL_HEIGHT_MM, LABEL_WIDTH_MM } from "@/lib/constants";

/** Print CSS driven by the named label-size constants (Section 7). */
export default function PrintStyles() {
  const css = `
@page { size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm; margin: 0; }
html, body { background: #fff; }
.print-label {
  width: ${LABEL_WIDTH_MM}mm;
  height: ${LABEL_HEIGHT_MM}mm;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1mm;
  padding: 1.5mm;
  overflow: hidden;
  text-align: center;
  background: #fff;
  color: #000;
  break-after: page;
  page-break-after: always;
}
.label-name {
  font-size: 10pt;
  font-weight: 700;
  max-width: ${LABEL_WIDTH_MM - 4}mm;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.label-barcode {
  width: ${LABEL_WIDTH_MM - 8}mm;
  height: ${Math.round(LABEL_HEIGHT_MM * 0.45)}mm;
  object-fit: contain;
}
.label-digits { font-size: 8pt; letter-spacing: 1px; }
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
