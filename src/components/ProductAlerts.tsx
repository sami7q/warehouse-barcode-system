"use client";

import type { ProductAlert } from "@/components/useProductAlerts";
import { fmtNumber, fmtTime } from "@/lib/format";
import { eventHeading, isPriceOnly } from "@/lib/product-events";

type Props = {
  alerts: ProductAlert[];
  onDismiss: (key: string) => void;
  /** Filter the main table down to this product. */
  onShow: (barcode: string) => void;
};

function accent(a: ProductAlert): string {
  if (a.kind === "created") return "#16A34A";
  if (a.kind === "deleted") return "#DC2626";
  return isPriceOnly(a) ? "#D97706" : "#2563EB";
}

/** Stack of product-change cards for the employee view (see useProductAlerts). */
export default function ProductAlerts({ alerts, onDismiss, onShow }: Props) {
  if (alerts.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-50 flex max-h-[80vh] flex-col gap-2.5 overflow-y-auto sm:inset-x-auto sm:bottom-14 sm:left-4 sm:w-[340px]"
    >
      {alerts.map((a) => {
        const p = a.product;
        return (
          <div
            key={a.key}
            data-testid="product-alert"
            data-kind={a.kind}
            className="shrink-0 overflow-hidden rounded-[12px] border border-[#DCE1EB] bg-white text-[13px] text-[#101C36] shadow-[0_10px_30px_rgba(16,28,54,.18)]"
          >
            <div
              className="flex items-center gap-2 px-3.5 py-2 text-white"
              style={{ background: accent(a) }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <span className="font-bold" data-testid="product-alert-heading">
                {eventHeading(a)}
              </span>
              <span className="ms-auto text-[11.5px] opacity-90">
                {fmtTime(a.at)}
              </span>
              <button
                onClick={() => onDismiss(a.key)}
                title="إغلاق"
                data-testid="product-alert-close"
                className="grid h-6 w-6 cursor-pointer place-items-center rounded-md border-none bg-transparent text-[14px] text-white hover:bg-white/15"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2 px-3.5 py-3">
              <div className="font-bold" data-testid="product-alert-name">
                {p.name}
              </div>

              {a.kind === "updated" ? (
                <ul className="flex flex-col gap-1.5" data-testid="product-alert-changes">
                  {a.changes.map((c) => (
                    <li
                      key={c.field}
                      className="flex items-center justify-between gap-2 rounded-[8px] bg-[#F4F7FC] px-2.5 py-1.5 text-[12.5px]"
                    >
                      <span className="text-[#3B4A66]">{c.label}</span>
                      <span dir="ltr" className="text-left">
                        <s className="text-[#8A94A8]">{c.from}</s>
                        <span className="mx-1.5 text-[#8A94A8]">→</span>
                        <b>{c.to}</b>
                        {c.unit ? (
                          <span className="ms-1 text-[11px] text-[#8A94A8]">
                            {c.unit}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {a.kind === "deleted" ? (
                <div className="text-[12.5px] text-[#3B4A66]">
                  الباركود <b dir="ltr">{p.barcode}</b> — تم حذفه من النظام
                </div>
              ) : (
                <img
                  src={`/api/barcode?text=${encodeURIComponent(p.barcode)}`}
                  alt={`باركود ${p.barcode}`}
                  className="mx-auto h-[58px] max-w-full"
                />
              )}

              {a.kind === "created" ? (
                <div className="grid grid-cols-3 gap-2 border-t border-[#EDF0F6] pt-2 text-[12px]">
                  <div>
                    <span className="block text-[#8A94A8]">سعر البيع</span>
                    <b dir="ltr">{fmtNumber(p.sellPrice)}</b>
                  </div>
                  <div>
                    <span className="block text-[#8A94A8]">سعر المفرد</span>
                    <b dir="ltr">{fmtNumber(p.unitPrice)}</b>
                  </div>
                  <div>
                    <span className="block text-[#8A94A8]">الكمية</span>
                    <b dir="ltr">{p.quantity}</b>
                  </div>
                </div>
              ) : null}

              {a.kind === "deleted" ? null : (
                <button
                  onClick={() => {
                    onShow(p.barcode);
                    onDismiss(a.key);
                  }}
                  className="mt-0.5 cursor-pointer rounded-[8px] border-none bg-[#2563EB] py-2 font-[inherit] text-[12.5px] font-bold text-white hover:brightness-110"
                >
                  عرض في الجدول
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
