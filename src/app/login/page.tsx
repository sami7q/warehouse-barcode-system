"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E8EBF2] p-4">
      <div className="w-full max-w-[400px] overflow-hidden rounded-[14px] border border-[#DCE1EB] bg-white">
        <div className="flex items-center gap-3.5 bg-[#101C36] px-5 py-4 text-white">
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
          <div className="text-[17px] font-bold">إدارة المخازن</div>
        </div>

        <form action={formAction} className="flex flex-col gap-3.5 p-6">
          <div className="text-[15px] font-bold">تسجيل الدخول</div>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-[#101C36]">
            البريد الإلكتروني
            <input
              type="email"
              name="email"
              required
              dir="ltr"
              autoComplete="email"
              placeholder="admin@example.com"
              className="rounded-[9px] border border-[#DCE1EB] px-3 py-2.5 text-left font-[inherit] text-[13px] outline-[#2563EB]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-bold text-[#101C36]">
            كلمة المرور
            <input
              type="password"
              name="password"
              required
              dir="ltr"
              autoComplete="current-password"
              placeholder="••••••••"
              className="rounded-[9px] border border-[#DCE1EB] px-3 py-2.5 text-left font-[inherit] text-[13px] outline-[#2563EB]"
            />
          </label>
          {error ? (
            <div
              role="alert"
              data-testid="login-error"
              className="rounded-[9px] bg-[#FDECEC] px-3 py-2 text-[12px] font-semibold text-[#DC2626]"
            >
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 flex items-center justify-center gap-2 rounded-[9px] border-none bg-[#2563EB] px-4 py-3 font-[inherit] text-[13px] font-bold text-white hover:brightness-108 disabled:opacity-60"
          >
            {pending ? "جارٍ الدخول…" : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
