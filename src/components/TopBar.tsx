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
    <div className="flex h-14 items-center gap-2 bg-[#101C36] px-3 text-white sm:h-[58px] sm:gap-3.5 sm:px-[18px]">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-white sm:h-9 sm:w-9">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#101C36"
          strokeWidth="2"
          className="sm:h-5 sm:w-5"
        >
          <path d="M3 9.5 12 4l9 5.5V20H3z" />
          <path d="M8 20v-6h8v6" />
        </svg>
      </div>
      <div className="truncate text-[15px] font-bold sm:text-[19px]">
        إدارة المخازن
      </div>
      <div className="ms-auto flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold sm:gap-2.5 sm:text-[14px]">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          className="hidden sm:block"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span dir="ltr" data-testid="live-clock" suppressHydrationWarning>
          {clock}
        </span>
        <span
          dir="ltr"
          className="hidden opacity-85 sm:inline"
          suppressHydrationWarning
        >
          {date}
        </span>
      </div>
      <button
        onClick={() => logout()}
        title="تسجيل الخروج"
        className="ms-2 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md border-none bg-transparent hover:bg-white/12 sm:ms-3.5 sm:h-[30px] sm:w-[34px]"
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
      <div className="hidden items-center gap-1 sm:flex">
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
