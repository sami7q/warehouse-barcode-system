"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiProduct } from "@/lib/types";
import { fmtNumber } from "@/lib/format";

type ScanState =
  | { status: "idle" }
  | { status: "found"; product: ApiProduct }
  | { status: "miss" };

export default function ScanTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [scan, setScan] = useState<ScanState>({ status: "idle" });

  // Stay focused at all times: on mount, on blur, on any click in the tab.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const refocus = () => {
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const lookup = async (barcode: string) => {
    if (!barcode) return;
    try {
      const res = await fetch(
        `/api/products?barcode=${encodeURIComponent(barcode)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { product: ApiProduct };
        setScan({ status: "found", product: data.product });
      } else {
        setScan({ status: "miss" });
      }
    } catch {
      setScan({ status: "miss" });
    }
    setValue("");
    refocus();
  };

  return (
    <div
      className="flex flex-col gap-3.5 px-5 py-[18px]"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="text-[13px] font-bold">قارئ الباركود</div>
      <div className="text-[12px] text-[#8A94A8]">
        امسح الباركود بالقارئ أو اكتبه ثم اضغط Enter للبحث الفوري
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") lookup(value.trim());
        }}
        onBlur={refocus}
        placeholder="6281101000012"
        dir="ltr"
        data-testid="scan-input"
        className="rounded-[10px] border-2 border-[#2563EB] px-3.5 py-[13px] text-center font-[inherit] text-[15px] tracking-[2px] outline-none"
      />

      {scan.status === "found" ? (
        <div
          data-testid="scan-result"
          className="flex flex-col gap-1.5 rounded-[10px] border border-[#DCE1EB] bg-[#F4F7FC] p-3.5 text-[13px]"
        >
          <div className="text-[14px] font-bold" data-testid="scan-name">
            {scan.product.name}
          </div>
          <div className="flex justify-between">
            <span className="text-[#8A94A8]">الباركود</span>
            <b dir="ltr">{scan.product.barcode}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8A94A8]">الكمية</span>
            <b dir="ltr">{scan.product.quantity}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8A94A8]">سعر الشراء</span>
            <b dir="ltr">{fmtNumber(scan.product.purchasePrice)} دينار</b>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8A94A8]">سعر البيع</span>
            <b dir="ltr">{fmtNumber(scan.product.sellPrice)} دينار</b>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8A94A8]">سعر المفرد</span>
            <b dir="ltr">{fmtNumber(scan.product.unitPrice)} دينار</b>
          </div>
        </div>
      ) : null}

      {scan.status === "miss" ? (
        <div
          data-testid="scan-miss"
          className="rounded-[9px] bg-[#FDECEC] px-3 py-[9px] text-[12.5px] font-semibold text-[#DC2626]"
        >
          لا يوجد منتج بهذا الباركود
        </div>
      ) : null}
    </div>
  );
}
