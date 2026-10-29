"use client";

import ScanTab from "@/components/tabs/ScanTab";

/**
 * Employee's sidebar-equivalent: no tab strip since there is only one
 * capability (scanning) — admin/إضافة/طباعة/صانع are all edit/create
 * actions the employee role is deliberately excluded from. (Notification
 * status lives at the top of the page instead: PushStatusBanner.)
 */
export default function EmployeePanel() {
  return (
    <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-[14px] border border-[#DCE1EB] bg-white lg:w-[360px]">
      <div className="border-b border-[#DCE1EB] px-4 py-3.5 text-[13px] font-bold text-[#101C36] sm:px-5">
        قارئ الباركود
      </div>
      <ScanTab />
    </div>
  );
}
