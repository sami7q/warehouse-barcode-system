"use client";

import { useEffect, useState } from "react";
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
 * Employee notification status, pinned to the top of the page. It used to
 * live in the scan panel, which on a phone renders *below* the whole
 * product table — easy to never scroll to, so phones never got enabled.
 */
export default function PushStatusBanner() {
  const [alerts, setAlerts] = useState<AlertsState>("loading");
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

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

  const onTest = async () => {
    setBusy(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json()) as { sent?: number; error?: string };
      setTestMsg(
        res.ok
          ? { ok: true, text: "أُرسل إشعار تجريبي — يجب أن يرنّ الهاتف خلال ثوانٍ" }
          : { ok: false, text: data.error ?? "تعذر إرسال الإشعار التجريبي" },
      );
    } catch {
      setTestMsg({ ok: false, text: "تعذر الاتصال بالخادم" });
    } finally {
      setBusy(false);
    }
  };

  if (alerts === "loading" || alerts === "unsupported") return null;

  const btn =
    "shrink-0 cursor-pointer rounded-[8px] border-none px-3.5 py-2 font-[inherit] text-[12.5px] font-bold text-white hover:brightness-110 disabled:opacity-60";

  if (alerts === "off" || alerts === "error") {
    return (
      <div
        data-testid="push-banner"
        className="mb-3.5 flex flex-wrap items-center gap-3 rounded-[10px] border border-[#F5C26B] bg-[#FFF7E6] px-4 py-3 text-[13px] text-[#7A4D00]"
      >
        <span className="text-[20px]" aria-hidden="true">🔔</span>
        <span className="min-w-[200px] flex-1 font-semibold">
          {alerts === "error"
            ? "تعذر تفعيل الإشعارات، حاول مرة أخرى"
            : "فعّل الإشعارات ليرنّ هاتفك عند إضافة منتج جديد أو تغيير أي سعر — حتى والتطبيق مغلق"}
        </span>
        <button
          onClick={onEnable}
          disabled={busy}
          data-testid="enable-alerts-btn"
          className={`${btn} bg-[#2563EB]`}
        >
          {busy ? "جارٍ التفعيل…" : "تفعيل الإشعارات"}
        </button>
      </div>
    );
  }

  if (alerts === "denied") {
    return (
      <div
        data-testid="push-banner"
        className="mb-3.5 rounded-[10px] border border-[#F3B4B4] bg-[#FDECEC] px-4 py-3 text-[12.5px] text-[#991B1B]"
      >
        <div className="font-bold">
          🔕 الإشعارات محظورة على هذا الهاتف — لن يصلك أي تنبيه
        </div>
        <div className="mt-1">
          اضغط على رمز القفل 🔒 بجانب عنوان الموقع في الأعلى ← الأذونات ←
          الإشعارات ← سماح، ثم أعد تحميل الصفحة.
        </div>
      </div>
    );
  }

  if (alerts === "ios-install") {
    return (
      <div
        data-testid="push-banner"
        className="mb-3.5 rounded-[10px] border border-[#BFD3FB] bg-[#EAF1FE] px-4 py-3 text-[12.5px] text-[#1E3A8A]"
      >
        لتصلك الإشعارات على الآيفون: اضغط زر المشاركة ثم «إضافة إلى الشاشة
        الرئيسية»، وافتح التطبيق من أيقونته
      </div>
    );
  }

  // on
  return (
    <div
      data-testid="alerts-on"
      className="mb-3.5 rounded-[10px] border border-[#BBE5C8] bg-[#ECFDF3] px-4 py-2.5 text-[12.5px] text-[#166534]"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex-1 font-bold">
          ✓ الإشعارات مفعّلة على هذا الجهاز
        </span>
        <button
          onClick={onTest}
          disabled={busy}
          data-testid="test-push-btn"
          className={`${btn} bg-[#16A34A] py-1.5`}
        >
          {busy ? "جارٍ الإرسال…" : "تجربة الإشعار"}
        </button>
        <button
          onClick={() => setShowHelp((v) => !v)}
          className="cursor-pointer border-none bg-transparent p-0 font-[inherit] text-[12px] font-semibold text-[#166534] underline"
        >
          لا يرنّ؟
        </button>
      </div>
      {testMsg ? (
        <div
          data-testid="test-push-result"
          className={`mt-1.5 font-semibold ${testMsg.ok ? "" : "text-[#DC2626]"}`}
        >
          {testMsg.text}
        </div>
      ) : null}
      {showHelp ? (
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-[12px] text-[#14532D]">
          <li>تأكد أن الهاتف ليس على الصامت وأن «عدم الإزعاج» مطفأ.</li>
          <li>
            إعدادات الهاتف ← التطبيقات ← Chrome ← الإشعارات ← فعّل الإشعارات
            وتأكد أن الصوت مفعّل لـ«المواقع».
          </li>
          <li>
            إعدادات الهاتف ← البطارية ← Chrome ← «بدون قيود» (مهم في هواتف
            شاومي وهواوي وأوبو حتى تصل الإشعارات والشاشة مقفلة).
          </li>
          <li>ثم اضغط «تجربة الإشعار» مرة أخرى.</li>
        </ol>
      ) : null}
    </div>
  );
}
