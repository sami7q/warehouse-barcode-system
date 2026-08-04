export default function BottomBar() {
  return (
    <div className="flex h-[44px] items-center gap-2 bg-[#101C36] px-[22px] text-[12.5px] text-[#B9C4D8]">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#B9C4D8"
        strokeWidth="2"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
      المستخدم: مدير النظام
      <span className="mx-auto flex items-center gap-[7px]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B9C4D8"
          strokeWidth="2"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>
          جميع الحقوق محفوظة © 2026 — تم التطوير بواسطة{" "}
          <a
            href="https://softodeviq.com"
            target="_blank"
            rel="noreferrer"
            className="text-[#7EA6E8]"
          >
            softodeviq.com
          </a>
        </span>
      </span>
      نسخة البرنامج: 1.0.0
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#B9C4D8"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v4h1" />
      </svg>
    </div>
  );
}
