"use client";

import { useEffect, useState } from "react";
import ScanTab from "@/components/tabs/ScanTab";
import { playAlertSound, unlockAlertSound } from "@/lib/alert-sound";

type Permission = NotificationPermission | "unsupported";

/**
 * Employee's sidebar-equivalent: no tab strip since there is only one
 * capability (scanning) — admin/إضافة/طباعة/صانع are all edit/create
 * actions the employee role is deliberately excluded from.
 */
export default function EmployeePanel() {
  const [permission, setPermission] = useState<Permission | null>(null);

  useEffect(() => {
    setPermission(
      typeof Notification === "undefined"
        ? "unsupported"
        : Notification.permission,
    );
  }, []);

  // Must run inside the click: both the permission prompt and audio unlock
  // require a user gesture. The chime doubles as a "sound works" check.
  const enableAlerts = async () => {
    void unlockAlertSound().then(playAlertSound);
    if (typeof Notification === "undefined") return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      // ignore — in-app alerts still work without system notifications
    }
  };

  return (
    <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-[14px] border border-[#DCE1EB] bg-white lg:w-[360px]">
      <div className="flex items-center gap-2 border-b border-[#DCE1EB] px-4 py-3.5 text-[13px] font-bold text-[#101C36] sm:px-5">
        قارئ الباركود
        {permission === "default" ? (
          <button
            onClick={enableAlerts}
            data-testid="enable-alerts-btn"
            className="ms-auto cursor-pointer rounded-[7px] border-none bg-[#EAF1FE] px-2.5 py-1.5 font-[inherit] text-[11.5px] font-bold text-[#2563EB] hover:brightness-95"
          >
            تفعيل إشعارات المنتجات الجديدة
          </button>
        ) : null}
        {permission === "granted" ? (
          <span className="ms-auto text-[11.5px] font-semibold text-[#16A34A]">
            الإشعارات مفعّلة
          </span>
        ) : null}
      </div>
      <ScanTab />
    </div>
  );
}
