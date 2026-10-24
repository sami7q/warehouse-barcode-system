"use client";

import { useEffect, useState } from "react";
import ScanTab from "@/components/tabs/ScanTab";
import { playAlertSound, unlockAlertSound } from "@/lib/alert-sound";
import { detectPushSupport, enablePush, syncPush } from "@/lib/push-client";

type AlertsState =
  | "loading"
  | "unsupported"
  | "ios-install"
  | "off"
  | "on"
  | "denied"
  | "error";

/**
 * Employee's sidebar-equivalent: no tab strip since there is only one
 * capability (scanning) — admin/إضافة/طباعة/صانع are all edit/create
 * actions the employee role is deliberately excluded from.
 */
export default function EmployeePanel() {
  const [alerts, setAlerts] = useState<AlertsState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const support = detectPushSupport();
    if (support !== "supported") {
      setAlerts(support);
      return;
    }
    if (Notification.permission === "denied") {
      setAlerts("denied");
      return;
    }
    if (Notification.permission === "default") {
      setAlerts("off");
      return;
    }
    syncPush()
      .then(() => setAlerts("on"))
      .catch((err) => {
        console.error("push subscription failed", err);
        setAlerts("error");
      });
  }, []);

  const onEnable = async () => {
    setBusy(true);
    // Permission prompt first: iOS only allows it as the first thing done
    // inside the tap. Audio unlock is synchronous so it can come before.
    void unlockAlertSound();
    try {
      const permission = await enablePush();
      setAlerts(permission === "granted" ? "on" : permission === "denied" ? "denied" : "off");
      if (permission === "granted") playAlertSound();
    } catch (err) {
      console.error("push subscription failed", err);
      setAlerts("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-[14px] border border-[#DCE1EB] bg-white lg:w-[360px]">
      <div className="border-b border-[#DCE1EB] px-4 py-3.5 text-[13px] font-bold text-[#101C36] sm:px-5">
        قارئ الباركود
      </div>

      {alerts === "off" || alerts === "error" ? (
        <div className="flex items-center gap-2.5 border-b border-[#DCE1EB] bg-[#FFF7E6] px-4 py-3 text-[12px] text-[#7A4D00] sm:px-5">
          <span className="flex-1">
            {alerts === "error"
              ? "تعذر تفعيل الإشعارات، حاول مرة أخرى"
              : "فعّل الإشعارات ليصلك تنبيه بصوت عند إضافة أي منتج أو تعديل سعره أو حذفه، حتى لو كان التطبيق مغلقاً"}
          </span>
          <button
            onClick={onEnable}
            disabled={busy}
            data-testid="enable-alerts-btn"
            className="shrink-0 cursor-pointer rounded-[7px] border-none bg-[#2563EB] px-3 py-1.5 font-[inherit] text-[12px] font-bold text-white hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "جارٍ التفعيل…" : "تفعيل الإشعارات"}
          </button>
        </div>
      ) : null}
      {alerts === "on" ? (
        <div
          data-testid="alerts-on"
          className="border-b border-[#DCE1EB] bg-[#ECFDF3] px-4 py-2 text-[12px] font-semibold text-[#16A34A] sm:px-5"
        >
          ✓ الإشعارات مفعّلة على هذا الجهاز
        </div>
      ) : null}
      {alerts === "denied" ? (
        <div className="border-b border-[#DCE1EB] bg-[#FDECEC] px-4 py-2.5 text-[12px] font-semibold text-[#DC2626] sm:px-5">
          الإشعارات محظورة لهذا الموقع — اسمح بها من إعدادات المتصفح ثم أعد
          تحميل الصفحة
        </div>
      ) : null}
      {alerts === "ios-install" ? (
        <div className="border-b border-[#DCE1EB] bg-[#EAF1FE] px-4 py-2.5 text-[12px] text-[#1E3A8A] sm:px-5">
          لتصلك الإشعارات على الآيفون: اضغط زر المشاركة ثم «إضافة إلى الشاشة
          الرئيسية»، وافتح التطبيق من أيقونته
        </div>
      ) : null}

      <ScanTab />
    </div>
  );
}
