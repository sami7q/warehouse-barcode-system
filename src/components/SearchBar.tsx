"use client";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
};

export default function SearchBar({
  search,
  onSearchChange,
  onRefresh,
  onExport,
}: Props) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-3">
      <div className="text-[17px] font-bold">البحث عن منتج</div>
      <div className="ms-auto flex">
        <span className="flex items-center gap-[7px] rounded-e-none rounded-s-[9px] bg-[#101C36] px-[18px] py-2.5 text-[13px] font-semibold text-white">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          بحث
        </span>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ابحث باسم المنتج أو الباركود"
          data-testid="search-input"
          className="w-[300px] rounded-e-[9px] rounded-s-none border border-s-0 border-[#DCE1EB] px-3.5 py-2.5 font-[inherit] text-[13px] outline-[#2563EB]"
        />
      </div>
      <button
        onClick={onExport}
        data-testid="export-btn"
        className="flex cursor-pointer items-center gap-2 rounded-[9px] border-none bg-[#16A34A] px-4 py-2.5 font-[inherit] text-[13px] font-semibold text-white hover:brightness-108"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        >
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6M9 13l6 6M15 13l-6 6" />
        </svg>
        تصدير إلى Excel
      </button>
      <button
        onClick={onRefresh}
        data-testid="refresh-btn"
        className="flex cursor-pointer items-center gap-2 rounded-[9px] border-none bg-[#2563EB] px-4 py-2.5 font-[inherit] text-[13px] font-semibold text-white hover:brightness-108"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" />
        </svg>
        تحديث
      </button>
    </div>
  );
}
