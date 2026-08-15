"use client";

import { useMemo, useState } from "react";
import type { ApiProduct } from "@/lib/types";
import { fmtNumber } from "@/lib/format";

type Props = {
  products: ApiProduct[];
  selected: number[];
  onToggle: (id: number) => void;
  onPrint: () => void;
};

export default function PrintTab({
  products,
  selected,
  onToggle,
  onPrint,
}: Props) {
  const [search, setSearch] = useState("");
  const first = products.find((p) => selected.includes(p.id));

  // Same matching rule as the main search bar / scanner lookup: exact
  // barcode OR partial case-insensitive name.
  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return products;
    const needle = q.toLowerCase();
    return products.filter(
      (p) => p.barcode === q || p.name.toLowerCase().includes(needle),
    );
  }, [products, search]);

  return (
    <div className="flex flex-col gap-3.5 px-4 py-[18px] sm:px-5">
      <div className="text-[13px] font-bold">
        اختر منتجاً لطباعة ملصق الباركود
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ابحث باسم المنتج أو الباركود"
        data-testid="print-search"
        className="rounded-[9px] border border-[#DCE1EB] px-3.5 py-2.5 font-[inherit] text-[13px] outline-[#2563EB]"
      />
      <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
        {filtered.map((p) => {
          const isSel = selected.includes(p.id);
          return (
            <label
              key={p.id}
              data-testid="print-item"
              className={`flex cursor-pointer items-center justify-between gap-2.5 rounded-[9px] border-[1.5px] px-[13px] py-[9px] text-[12.5px] ${
                isSel
                  ? "border-[#2563EB] bg-[#EAF1FE]"
                  : "border-[#DCE1EB] bg-white"
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => onToggle(p.id)}
                  className="h-4 w-4 accent-[#2563EB]"
                />
                {p.name}
              </span>
              <span dir="ltr" className="text-[11.5px] text-[#8A94A8]">
                {p.barcode}
              </span>
            </label>
          );
        })}
        {filtered.length === 0 ? (
          <div
            data-testid="print-no-results"
            className="py-4 text-center text-[12.5px] text-[#8A94A8]"
          >
            {products.length === 0 ? "لا توجد منتجات" : "لا توجد نتائج مطابقة"}
          </div>
        ) : null}
      </div>

      {first ? (
        <>
          <div
            data-testid="print-preview"
            className="flex flex-col items-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#101C36] p-3.5"
          >
            <div className="text-[13px] font-bold">{first.name}</div>
            <img
              alt={`باركود ${first.barcode}`}
              className="h-[44px] w-[190px] object-contain"
              src={`/api/barcode?text=${encodeURIComponent(first.barcode)}`}
            />
            <div dir="ltr" className="text-[12px] tracking-[2px]">
              {first.barcode}
            </div>
            <div className="text-[13px] font-bold" dir="ltr">
              {fmtNumber(first.sellPrice)} دينار
            </div>
          </div>
          <button
            onClick={onPrint}
            data-testid="print-btn"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border-none bg-[#2563EB] p-[11px] font-[inherit] text-[13px] font-bold text-white hover:brightness-108"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
            >
              <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="7" />
            </svg>
            طباعة الملصق
          </button>
        </>
      ) : null}
    </div>
  );
}
