"use client";

import type { ProductAlert } from "@/components/useNewProductAlerts";
import { fmtNumber, fmtTime } from "@/lib/format";

type Props = {
  alerts: ProductAlert[];
  onDismiss: (id: number) => void;
  /** Filter the main table down to this product. */
  onShow: (barcode: string) => void;
};

/** Stack of "new product" cards for the employee view (see useNewProductAlerts). */
export default function NewProductAlerts({ alerts, onDismiss, onShow }: Props) {
  if (alerts.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-50 flex flex-col gap-2.5 sm:inset-x-auto sm:bottom-14 sm:left-4 sm:w-[340px]"
    >
      {alerts.map(({ product: p, at }) => (
        <div
          key={p.id}
          data-testid="new-product-alert"
          className="overflow-hidden rounded-[12px] border border-[#DCE1EB] bg-white text-[13px] text-[#101C36] shadow-[0_10px_30px_rgba(16,28,54,.18)]"
        >
          <div className="flex items-center gap-2 bg-[#16A34A] px-3.5 py-2 text-white">
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
            <span className="font-bold">منتج جديد أُضيف للنظام</span>
            <span className="ms-auto text-[11.5px] opacity-90">
              {fmtTime(at)}
            </span>
            <button
              onClick={() => onDismiss(p.id)}
              title="إغلاق"
              data-testid="new-product-alert-close"
              className="grid h-6 w-6 cursor-pointer place-items-center rounded-md border-none bg-transparent text-[14px] text-white hover:bg-white/15"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2 px-3.5 py-3">
            <div className="font-bold" data-testid="new-product-alert-name">
              {p.name}
            </div>
            <img
              src={`/api/barcode?text=${encodeURIComponent(p.barcode)}`}
              alt={`باركود ${p.barcode}`}
              className="mx-auto h-[58px] max-w-full"
            />
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
            <button
              onClick={() => {
                onShow(p.barcode);
                onDismiss(p.id);
              }}
              className="mt-0.5 cursor-pointer rounded-[8px] border-none bg-[#2563EB] py-2 font-[inherit] text-[12.5px] font-bold text-white hover:brightness-110"
            >
              عرض في الجدول
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
