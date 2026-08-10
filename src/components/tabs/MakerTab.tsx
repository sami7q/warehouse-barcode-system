"use client";

import { useState } from "react";
import { computeEan13CheckDigit } from "@/lib/ean13";
import { DEFAULT_BARCODE_PREFIX } from "@/lib/constants";

type Props = {
  onUseInAdd: (barcode: string) => void;
};

export default function MakerTab({ onUseInAdd }: Props) {
  const [text, setText] = useState("");

  const generate = () => {
    const random6 = String(Math.floor(Math.random() * 1_000_000)).padStart(
      6,
      "0",
    );
    const data12 = DEFAULT_BARCODE_PREFIX + random6;
    setText(data12 + String(computeEan13CheckDigit(data12)));
  };

  const download = async () => {
    if (!text.trim()) return;
    const res = await fetch(
      `/api/barcode?text=${encodeURIComponent(text.trim())}`,
    );
    if (!res.ok) return;
    const svg = await res.text();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `barcode-${text.trim()}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col gap-3.5 px-4 py-[18px] sm:px-5">
      <div className="text-[13px] font-bold">صانع الباركود</div>
      <div className="text-[12px] text-[#8A94A8]">
        اكتب أو الصق أي نص/رقم لمعاينة الباركود وتنزيله دون حفظه كمنتج
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="اكتب نصاً أو رقماً…"
        dir="ltr"
        data-testid="maker-input"
        className="rounded-[10px] border border-[#DCE1EB] px-3.5 py-[11px] text-center font-[inherit] text-[14px] tracking-[2px] outline-[#2563EB]"
      />

      <div className="flex flex-col items-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-[#2563EB] bg-[#F4F7FC] p-4">
        {text.trim() ? (
          <img
            alt={`باركود ${text.trim()}`}
            data-testid="maker-preview"
            className="h-[64px] w-[220px] object-contain"
            src={`/api/barcode?text=${encodeURIComponent(text.trim())}`}
          />
        ) : (
          <div className="py-4 text-[12px] text-[#8A94A8]">
            المعاينة ستظهر هنا
          </div>
        )}
        <div dir="ltr" className="text-[14px] font-semibold tracking-[3px]">
          {text.trim()}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={generate}
          data-testid="maker-generate"
          className="flex-1 cursor-pointer rounded-[9px] border-none bg-[#2563EB] p-[11px] font-[inherit] text-[13px] font-bold text-white hover:brightness-108"
        >
          توليد جديد
        </button>
        <button
          onClick={download}
          disabled={!text.trim()}
          data-testid="maker-download"
          className="flex-1 cursor-pointer rounded-[9px] border-none bg-[#64748B] p-[11px] font-[inherit] text-[13px] font-bold text-white hover:brightness-108 disabled:opacity-50"
        >
          تنزيل
        </button>
        <button
          onClick={() => text.trim() && onUseInAdd(text.trim())}
          disabled={!text.trim()}
          className="flex-1 cursor-pointer rounded-[9px] border-none bg-[#16A34A] p-[11px] font-[inherit] text-[13px] font-bold text-white hover:brightness-108 disabled:opacity-50"
        >
          استخدامه في الإضافة
        </button>
      </div>
    </div>
  );
}
