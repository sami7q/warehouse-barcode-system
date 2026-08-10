"use client";

export type ProductFormState = {
  barcode: string;
  name: string;
  buy: string;
  sell: string;
  unit: string;
  qty: string;
};

export const EMPTY_FORM: ProductFormState = {
  barcode: "",
  name: "",
  buy: "",
  sell: "",
  unit: "",
  qty: "",
};

type Props = {
  form: ProductFormState;
  error: string;
  saving: boolean;
  editing: boolean;
  created: { barcode: string; svg: string } | null;
  onField: (field: keyof ProductFormState, value: string) => void;
  onSave: () => void;
  onNew: () => void;
  onClear: () => void;
};

const inputCls =
  "rounded-[9px] border border-[#DCE1EB] px-3 py-2.5 font-[inherit] text-[13px] outline-[#2563EB]";
const labelCls =
  "flex flex-col gap-[5px] text-[12.5px] font-bold text-[#101C36]";

export default function AddProductTab({
  form,
  error,
  saving,
  editing,
  created,
  onField,
  onSave,
  onNew,
  onClear,
}: Props) {
  return (
    <div className="flex flex-col gap-[11px] overflow-y-auto px-4 pb-5 pt-4 sm:px-5">
      <label className={labelCls}>
        الباركود
        <input
          value={form.barcode}
          onChange={(e) => onField("barcode", e.target.value)}
          placeholder="امسح الباركود أو أدخله يدويًا"
          data-testid="f-barcode"
          dir="ltr"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        اسم المنتج
        <input
          value={form.name}
          onChange={(e) => onField("name", e.target.value)}
          placeholder="أدخل اسم المنتج"
          data-testid="f-name"
          maxLength={200}
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        سعر الشراء
        <input
          type="number"
          value={form.buy}
          onChange={(e) => onField("buy", e.target.value)}
          placeholder="0"
          data-testid="f-buy"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        سعر البيع
        <input
          type="number"
          value={form.sell}
          onChange={(e) => onField("sell", e.target.value)}
          placeholder="0"
          data-testid="f-sell"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        سعر المفرد
        <input
          type="number"
          value={form.unit}
          onChange={(e) => onField("unit", e.target.value)}
          placeholder="0"
          data-testid="f-unit"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        الكمية
        <input
          type="number"
          value={form.qty}
          onChange={(e) => onField("qty", e.target.value)}
          placeholder="0"
          data-testid="f-qty"
          className={inputCls}
        />
      </label>

      {error ? (
        <div
          role="alert"
          data-testid="form-error"
          className="rounded-[9px] bg-[#FDECEC] px-3 py-2 text-[12px] font-semibold text-[#DC2626]"
        >
          {error}
        </div>
      ) : null}

      {created ? (
        <div
          data-testid="created-panel"
          className="flex flex-col items-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#16A34A] bg-[#F0FDF4] p-3.5"
        >
          <div className="text-[12.5px] font-bold text-[#16A34A]">
            تم الحفظ — الباركود المولّد
          </div>
          {/* SVG rendered via <img> data URI — scripts cannot execute in this context */}
          <img
            data-testid="created-barcode-svg"
            alt={`باركود ${created.barcode}`}
            className="w-[190px]"
            src={`data:image/svg+xml;utf8,${encodeURIComponent(created.svg)}`}
          />
          <div
            dir="ltr"
            data-testid="created-barcode-digits"
            className="text-[13px] font-semibold tracking-[2px]"
          >
            {created.barcode}
          </div>
        </div>
      ) : null}

      <div className="mt-1 flex gap-2">
        <button
          onClick={onNew}
          className="flex flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-[9px] border-none bg-[#2563EB] p-[11px] font-[inherit] text-[13px] font-bold text-white hover:brightness-108"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
          >
            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" />
          </svg>
          جديد
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          data-testid="save-btn"
          className="flex flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-[9px] border-none bg-[#16A34A] p-[11px] font-[inherit] text-[13px] font-bold text-white hover:brightness-108 disabled:opacity-60"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
          >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <path d="M17 21v-8H7v8M7 3v5h8" />
          </svg>
          {editing ? "تحديث" : "حفظ"}
        </button>
        <button
          onClick={onClear}
          className="flex cursor-pointer items-center justify-center gap-[7px] rounded-[9px] border-none bg-[#64748B] px-3.5 py-[11px] font-[inherit] text-[13px] font-bold text-white hover:brightness-108"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" />
          </svg>
          مسح
        </button>
      </div>
    </div>
  );
}
