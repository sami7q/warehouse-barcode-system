"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/format";

type EmployeeUser = {
  id: number;
  email: string;
  role: string;
  createdAt: number;
  pushDevices: number;
};

const inputCls =
  "rounded-[9px] border border-[#DCE1EB] px-3 py-2.5 font-[inherit] text-[13px] outline-[#2563EB]";
const labelCls =
  "flex flex-col gap-[5px] text-[12.5px] font-bold text-[#101C36]";

export default function EmployeesTab() {
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = (await res.json()) as { users: EmployeeUser[] };
        setEmployees(data.users);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setError("");
    if (!email.trim()) {
      setError("أدخل البريد الإلكتروني");
      return;
    }
    if (password.length < 8) {
      setError("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "حدث خطأ أثناء الإضافة");
        return;
      }
      setEmail("");
      setPassword("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: EmployeeUser) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب "${u.email}"؟`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  return (
    <div className="flex flex-col gap-3.5 px-4 py-[18px] sm:px-5">
      <div className="text-[13px] font-bold">إدارة حسابات الموظفين</div>
      <div className="text-[12px] text-[#8A94A8]">
        حساب الموظف يمكّنه فقط من عرض المنتجات واستخدام قارئ الباركود — بدون
        أي صلاحية إضافة أو تعديل أو حذف
      </div>

      <div className="flex flex-col gap-2.5 rounded-[10px] border border-[#DCE1EB] p-3.5">
        <label className={labelCls}>
          البريد الإلكتروني
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="employee@example.com"
            dir="ltr"
            data-testid="employee-email"
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          كلمة المرور
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="8 أحرف على الأقل"
            dir="ltr"
            data-testid="employee-password"
            className={inputCls}
          />
        </label>
        {error ? (
          <div
            role="alert"
            data-testid="employee-form-error"
            className="rounded-[9px] bg-[#FDECEC] px-3 py-2 text-[12px] font-semibold text-[#DC2626]"
          >
            {error}
          </div>
        ) : null}
        <button
          onClick={create}
          disabled={saving}
          data-testid="employee-create-btn"
          className="cursor-pointer rounded-[9px] border-none bg-[#16A34A] p-[11px] font-[inherit] text-[13px] font-bold text-white hover:brightness-108 disabled:opacity-60"
        >
          إضافة موظف
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="py-4 text-center text-[12.5px] text-[#8A94A8]">
            جارٍ التحميل…
          </div>
        ) : employees.length === 0 ? (
          <div
            data-testid="employees-empty"
            className="py-4 text-center text-[12.5px] text-[#8A94A8]"
          >
            لا يوجد موظفون بعد
          </div>
        ) : (
          employees.map((u) => (
            <div
              key={u.id}
              data-testid="employee-row"
              className="flex items-center justify-between gap-2.5 rounded-[9px] border border-[#DCE1EB] bg-white px-[13px] py-[9px] text-[12.5px]"
            >
              <div className="min-w-0">
                <div dir="ltr" className="truncate font-semibold">
                  {u.email}
                </div>
                <div className="text-[11px] text-[#8A94A8]">
                  أُضيف في {fmtDate(u.createdAt)}
                </div>
                <div
                  data-testid="employee-push-status"
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                    u.pushDevices > 0
                      ? "bg-[#ECFDF3] text-[#16A34A]"
                      : "bg-[#FFF7E6] text-[#B45309]"
                  }`}
                >
                  {u.pushDevices > 0
                    ? `🔔 الإشعارات مفعّلة (${u.pushDevices === 1 ? "جهاز واحد" : `${u.pushDevices} أجهزة`})`
                    : "🔕 الإشعارات غير مفعّلة — لن يصله تنبيه"}
                </div>
              </div>
              <button
                onClick={() => remove(u)}
                title="حذف"
                className="grid h-[30px] w-[30px] shrink-0 cursor-pointer place-items-center rounded-[7px] border-none bg-[#DC2626] hover:brightness-115"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                >
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
