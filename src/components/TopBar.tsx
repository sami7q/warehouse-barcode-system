"use client";

import { useEffect, useState } from "react";
import { fmtClock, fmtDate } from "@/lib/format";
import { logout } from "@/app/logout-action";

export default function TopBar() {
  const [clock, setClock] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(fmtClock(d));
      setDate(fmtDate(d.getTime()));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-[58px] items-center gap-3.5 bg-[#101C36] px-[18px] text-white">
      <div className="grid h-9 w-9 place-items-center rounded-[9px] bg-white">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#101C36"
          strokeWidth="2"
        >
          <path d="M3 9.5 12 4l9 5.5V20H3z" />
          <path d="M8 20v-6h8v6" />
        </svg>
      </div>
      <div className="text-[19px] font-bold">إدارة المخازن</div>
      <div className="ms-auto flex items-center gap-2.5 text-[14px] font-semibold">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span dir="ltr" data-testid="live-clock" suppressHydrationWarning>
          {clock}
        </span>
        <span dir="ltr" className="opacity-85" suppressHydrationWarning>
          {date}
        </span>
      </div>
      <button
        onClick={() => logout()}
        title="تسجيل الخروج"
        className="ms-3.5 grid h-[30px] w-[34px] cursor-pointer place-items-center rounded-md border-none bg-transparent hover:bg-white/12"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5M21 12H9" />
        </svg>
      </button>
      <div className="flex items-center gap-1">
        <span className="grid h-[30px] w-[34px] cursor-pointer place-items-center rounded-md text-[16px] hover:bg-white/12">
          –
        </span>
        <span className="grid h-[30px] w-[34px] cursor-pointer place-items-center rounded-md hover:bg-white/12">
          <span className="block h-[11px] w-[11px] border-[1.5px] border-white" />
        </span>
        <span className="grid h-[30px] w-[34px] cursor-pointer place-items-center rounded-md text-[15px] hover:bg-[#C42B1C]">
          ✕
        </span>
      </div>
    </div>
  );
}
