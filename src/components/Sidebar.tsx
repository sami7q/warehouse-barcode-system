"use client";

export type TabKey = "add" | "print" | "scan" | "make";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "add",
    label: "إضافة منتج",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    key: "print",
    label: "طباعة باركود",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.9">
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="7" />
      </svg>
    ),
  },
  {
    key: "scan",
    label: "قارئ باركود",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.9">
        <path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M7 8v8M10 8v8M13 8v8M17 8v8" />
      </svg>
    ),
  },
  {
    key: "make",
    label: "صانع باركود",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.9">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9v6M10 9v6M13 9v6M17 9v6" />
      </svg>
    ),
  },
];

type Props = {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: React.ReactNode;
};

export default function Sidebar({ tab, onTabChange, children }: Props) {
  return (
    <div className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-[#DCE1EB] bg-white">
      <div className="grid grid-cols-4 border-b border-[#DCE1EB]">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <div
              key={t.key}
              onClick={() => onTabChange(t.key)}
              data-testid={`tab-${t.key}`}
              className={`flex cursor-pointer flex-col items-center gap-1.5 px-1.5 pb-[11px] pt-3.5 hover:bg-[#F4F7FC] ${
                active
                  ? "border-b-[3px] border-[#2563EB] bg-[#F4F7FC]"
                  : "border-b-[3px] border-transparent bg-white"
              }`}
            >
              <span style={{ color: active ? "#2563EB" : "#3B4A66" }}>
                <span className="[&_svg]:stroke-current">{t.icon}</span>
              </span>
              <span
                className={`text-[11px] ${
                  active ? "font-bold text-[#2563EB]" : "font-semibold text-[#3B4A66]"
                }`}
              >
                {t.label}
              </span>
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}
