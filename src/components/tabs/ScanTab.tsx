"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiProduct } from "@/lib/types";
import { fmtNumber } from "@/lib/format";

type ScanState =
  | { status: "idle" }
  | { status: "found"; product: ApiProduct }
  | { status: "miss" };

/** Full EAN-13 length — once the field reaches this many digits, look up
 * automatically without waiting for Enter (see AUTO_LOOKUP_DEBOUNCE_MS). */
const BARCODE_LENGTH = 13;
const AUTO_LOOKUP_DEBOUNCE_MS = 200;

export default function ScanTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [scan, setScan] = useState<ScanState>({ status: "idle" });
  // Guards for presentation-stand scanners firing several scans per second:
  // only the most recent request may write the result (no stale overwrite),
  // and superseded in-flight requests are aborted outright.
  const scanSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stay focused at all times: on mount, on blur, on any click in the tab.
  // (On iOS Safari this doesn't reliably pop the on-screen keyboard, since
  // it isn't called synchronously inside a user gesture — that's fine, it
  // still readies the field for a physical/Bluetooth scanner, and a tap
  // brings the keyboard up same as any other input.)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const refocus = () => {
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const lookup = async (barcode: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!barcode) return;
    const seq = ++scanSeq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setValue("");
    refocus();
    try {
      const res = await fetch(
        `/api/products?barcode=${encodeURIComponent(barcode)}`,
        { signal: controller.signal },
      );
      if (seq !== scanSeq.current) return; // a newer scan superseded this one
      if (res.ok) {
        const data = (await res.json()) as { product: ApiProduct };
        if (seq !== scanSeq.current) return;
        setScan({ status: "found", product: data.product });
      } else {
        setScan({ status: "miss" });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (seq !== scanSeq.current) return;
      setScan({ status: "miss" });
    }
  };

  const handleChange = (next: string) => {
    setValue(next);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Fallback trigger for input paths that never fire a clean Enter
    // keydown: mobile virtual keyboards during IME composition (a known
    // Android/Chrome quirk), and phone camera/Bluetooth "scanner" apps that
    // inject text without a real Enter keystroke. Debounced so it never
    // races an explicit Enter/تم submit, which always wins first and clears
    // the field (see the guard at the top of lookup()).
    const trimmed = next.trim();
    if (trimmed.length === BARCODE_LENGTH && /^\d+$/.test(trimmed)) {
      debounceRef.current = setTimeout(() => lookup(trimmed), AUTO_LOOKUP_DEBOUNCE_MS);
    }
  };

  return (
    <div
      className="flex flex-col gap-3.5 px-4 py-[18px] sm:px-5"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="text-[13px] font-bold">قارئ الباركود</div>
      <div className="text-[12px] text-[#8A94A8]">
        امسح الباركود بالقارئ، أو اكتبه وسيبحث تلقائياً عند اكتمال الرقم، أو
        اضغط بحث
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(value.trim());
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={refocus}
          placeholder="6281101000012"
          dir="ltr"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="search"
          autoComplete="off"
          data-testid="scan-input"
          className="w-full min-w-0 flex-1 rounded-[10px] border-2 border-[#2563EB] px-3.5 py-[13px] text-center font-[inherit] text-[15px] tracking-[2px] outline-none"
        />
        <button
          type="submit"
          data-testid="scan-search-btn"
          className="shrink-0 cursor-pointer rounded-[10px] border-none bg-[#2563EB] px-4 font-[inherit] text-[13px] font-bold text-white hover:brightness-108"
        >
          بحث
        </button>
      </form>

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
