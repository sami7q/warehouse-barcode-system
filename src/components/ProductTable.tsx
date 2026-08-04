"use client";

import type { ApiProduct } from "@/lib/types";
import { fmtDate, fmtNumber, fmtTime } from "@/lib/format";
import { QTY_COLORS, qtyTier } from "@/lib/constants";

const GRID =
  "grid-cols-[36px_1.4fr_1.5fr_1fr_1fr_1fr_.8fr_1.15fr_.95fr_.95fr]";

type Props = {
  products: ApiProduct[];
  page: number;
  perPage: number;
  editingId: number | null;
  onPageChange: (page: number) => void;
  onEdit: (product: ApiProduct) => void;
  onDelete: (product: ApiProduct) => void;
};

export default function ProductTable({
  products,
  page,
  perPage,
  editingId,
  onPageChange,
  onEdit,
  onDelete,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(products.length / perPage));
  const current = Math.min(page, pageCount);
  const slice = products.slice((current - 1) * perPage, current * perPage);
  const from = products.length ? (current - 1) * perPage + 1 : 0;
  const to = Math.min(current * perPage, products.length);

  const pageNumbers: (number | "…")[] =
    pageCount <= 5
      ? Array.from({ length: pageCount }, (_, i) => i + 1)
      : [1, 2, 3, "…", pageCount];

  return (
    <>
      <div className="overflow-hidden rounded-[10px] border border-[#DCE1EB]">
        <div
          className={`grid ${GRID} bg-[#101C36] text-[12.5px] font-semibold text-white`}
        >
          <span className="px-2 py-[11px] text-center">#</span>
          <span className="px-2.5 py-[11px]">الباركود</span>
          <span className="px-2.5 py-[11px]">اسم المنتج</span>
          <span className="px-2.5 py-[11px]">سعر الشراء</span>
          <span className="px-2.5 py-[11px]">سعر البيع</span>
          <span className="px-2.5 py-[11px]">سعر المفرد</span>
          <span className="px-2 py-[11px] text-center">الكمية</span>
          <span className="px-2.5 py-[11px]">تاريخ الإدخال</span>
          <span className="px-2.5 py-[11px]">ساعة الإدخال</span>
          <span className="px-2.5 py-[11px] text-center">إجراءات</span>
        </div>

        {slice.length === 0 ? (
          <div className="border-t border-[#EDF0F6] bg-white px-4 py-8 text-center text-[13px] text-[#8A94A8]">
            لا توجد منتجات
          </div>
        ) : (
          slice.map((p, i) => {
            const tier = qtyTier(p.quantity);
            const color = QTY_COLORS[tier];
            return (
              <div
                key={p.id}
                data-testid="product-row"
                className={`grid ${GRID} items-center border-t border-[#EDF0F6] text-[13px] hover:bg-[#F4F7FC] ${
                  editingId === p.id ? "bg-[#EAF1FE]" : "bg-white"
                }`}
              >
                <span className="px-2 py-[9px] text-center text-[#8A94A8]">
                  {(current - 1) * perPage + i + 1}
                </span>
                <span className="px-2.5 py-[9px] text-[12.5px]" dir="ltr">
                  {p.barcode}
                </span>
                <span className="px-2.5 py-[9px] font-semibold">{p.name}</span>
                <span className="px-2.5 py-[9px]" dir="ltr">
                  {fmtNumber(p.purchasePrice)}
                </span>
                <span className="px-2.5 py-[9px]" dir="ltr">
                  {fmtNumber(p.sellPrice)}
                </span>
                <span className="px-2.5 py-[9px]" dir="ltr">
                  {fmtNumber(p.unitPrice)}
                </span>
                <span className="px-2 py-[9px] text-center">
                  <span
                    dir="ltr"
                    data-testid="qty-badge"
                    data-tier={tier}
                    className="inline-block min-w-[38px] rounded-full px-2 py-0.5 text-[12.5px] font-bold"
                    style={{ color, background: `${color}1A` }}
                  >
                    {p.quantity}
                  </span>
                </span>
                <span className="px-2.5 py-[9px]" dir="ltr">
                  {fmtDate(p.createdAt)}
                </span>
                <span className="px-2.5 py-[9px]">{fmtTime(p.createdAt)}</span>
                <span className="flex justify-center gap-1.5 px-2.5 py-1.5">
                  <button
                    onClick={() => onEdit(p)}
                    title="تعديل"
                    className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] border-none bg-[#2563EB] hover:brightness-115"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                    >
                      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(p)}
                    title="حذف"
                    className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] border-none bg-[#DC2626] hover:brightness-115"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-3.5">
        <span className="text-[12.5px] font-semibold text-[#3B4A66]">
          عرض {from} إلى {to} من {products.length} منتج
        </span>
        <div className="mx-auto flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(Math.min(pageCount, current + 1))}
            disabled={current >= pageCount}
            className="cursor-pointer rounded-lg border border-[#DCE1EB] bg-white px-4 py-[7px] font-[inherit] text-[12.5px] font-semibold text-[#101C36] hover:border-[#2563EB] disabled:cursor-default disabled:bg-[#F4F7FC] disabled:text-[#8A94A8]"
          >
            التالي
          </button>
          {pageNumbers.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1 text-[12.5px] text-[#8A94A8]">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => onPageChange(n)}
                className={`h-8 min-w-[34px] cursor-pointer rounded-lg border font-[inherit] text-[12.5px] font-bold ${
                  n === current
                    ? "border-[#2563EB] bg-[#2563EB] text-white"
                    : "border-[#DCE1EB] bg-white text-[#101C36]"
                }`}
              >
                {n}
              </button>
            ),
          )}
          <button
            onClick={() => onPageChange(Math.max(1, current - 1))}
            disabled={current <= 1}
            className="cursor-pointer rounded-lg border border-[#DCE1EB] bg-white px-4 py-[7px] font-[inherit] text-[12.5px] font-semibold text-[#101C36] hover:border-[#2563EB] disabled:cursor-default disabled:bg-[#F4F7FC] disabled:text-[#8A94A8]"
          >
            السابق
          </button>
        </div>
        <span className="text-[12.5px] font-semibold text-[#3B4A66]">
          {from} إلى {to} من {products.length} منتج
        </span>
      </div>
    </>
  );
}
