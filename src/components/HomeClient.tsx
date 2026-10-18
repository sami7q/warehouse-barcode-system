"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import BottomBar from "@/components/BottomBar";
import SearchBar from "@/components/SearchBar";
import ProductTable from "@/components/ProductTable";
import EmployeePanel from "@/components/EmployeePanel";
import Sidebar, { type TabKey } from "@/components/Sidebar";
import AddProductTab, {
  EMPTY_FORM,
  type ProductFormState,
} from "@/components/tabs/AddProductTab";
import PrintTab from "@/components/tabs/PrintTab";
import ScanTab from "@/components/tabs/ScanTab";
import MakerTab from "@/components/tabs/MakerTab";
import EmployeesTab from "@/components/tabs/EmployeesTab";
import NewProductAlerts from "@/components/NewProductAlerts";
import { useNewProductAlerts } from "@/components/useNewProductAlerts";
import type { ApiProduct } from "@/lib/types";
import type { UserRole } from "@/types/next-auth";

const PER_PAGE = 10;
/** How often the employee view re-fetches the list to catch new products. */
const EMPLOYEE_POLL_MS = 15_000;
const MAX_INPUT_VALUE = 1_000_000_000;

function toNonNegativeInt(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return 0;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > MAX_INPUT_VALUE) return null;
  return n;
}

export default function HomeClient({ role }: { role: UserRole }) {
  const isAdmin = role === "admin";

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<TabKey>("add");

  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [created, setCreated] = useState<{
    barcode: string;
    svg: string;
  } | null>(null);

  const [printSel, setPrintSel] = useState<number[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = (await res.json()) as { products: ApiProduct[] };
      setProducts(data.products);
      setLoaded(true);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Employees never mutate, so nothing on their screen would otherwise
  // trigger a refresh: poll, and re-check right away when the tab returns
  // to the foreground (background timers are throttled by the browser).
  useEffect(() => {
    if (isAdmin) return;
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        await fetchProducts();
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(tick, EMPLOYEE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAdmin, fetchProducts]);

  const { alerts, dismiss } = useNewProductAlerts(products, loaded, !isAdmin);

  // Same matching rule as the scanner lookup: exact barcode OR partial name.
  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return products;
    const needle = q.toLowerCase();
    return products.filter(
      (p) => p.barcode === q || p.name.toLowerCase().includes(needle),
    );
  }, [products, search]);

  const onField = (field: keyof ProductFormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const clearForm = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditingId(null);
    setCreated(null);
  };

  const save = async () => {
    setFormError("");
    if (!form.name.trim()) {
      setFormError("أدخل اسم المنتج");
      return;
    }
    const buy = toNonNegativeInt(form.buy);
    const sell = toNonNegativeInt(form.sell);
    const unit = toNonNegativeInt(form.unit);
    const qty = toNonNegativeInt(form.qty);
    if (buy === null || sell === null || unit === null || qty === null) {
      setFormError("الأسعار والكمية يجب أن تكون أرقاماً صحيحة غير سالبة");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        purchase_price: buy,
        sell_price: sell,
        unit_price: unit,
        quantity: qty,
        barcode: form.barcode.trim() || undefined,
      };
      const res = await fetch(
        editingId ? `/api/products/${editingId}` : "/api/products",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setFormError(
          (data as { error?: string }).error ?? "حدث خطأ أثناء الحفظ",
        );
        return;
      }
      if (!editingId && (data as { svg?: string }).svg) {
        setCreated({
          barcode: (data as { product: ApiProduct }).product.barcode,
          svg: (data as { svg: string }).svg,
        });
      } else {
        setCreated(null);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await fetchProducts();
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (p: ApiProduct) => {
    setTab("add");
    setEditingId(p.id);
    setCreated(null);
    setFormError("");
    setForm({
      barcode: p.barcode,
      name: p.name,
      buy: String(p.purchasePrice),
      sell: String(p.sellPrice),
      unit: String(p.unitPrice),
      qty: String(p.quantity),
    });
  };

  const onDelete = async (p: ApiProduct) => {
    if (!window.confirm(`هل أنت متأكد من حذف "${p.name}"؟`)) return;
    const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingId === p.id) clearForm();
      setPrintSel((sel) => sel.filter((id) => id !== p.id));
      await fetchProducts();
    }
  };

  const onExport = () => {
    const a = document.createElement("a");
    a.href = "/api/products/export";
    a.download = "products.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onRefresh = async () => {
    setSearch("");
    setPage(1);
    await fetchProducts();
  };

  const onPrint = () => {
    if (printSel.length === 0) return;
    window.open(`/print?ids=${printSel.join(",")}`, "_blank");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#E8EBF2] text-[#101C36]">
      <TopBar />

      <div className="flex flex-1 flex-col items-stretch gap-3 px-3 py-3 sm:gap-3.5 sm:px-[18px] sm:py-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col rounded-[14px] border border-[#DCE1EB] bg-white px-3.5 py-4 sm:px-5 sm:py-[18px]">
          <SearchBar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            onRefresh={onRefresh}
            onExport={onExport}
            showExport={isAdmin}
          />
          {loadError ? (
            <div
              data-testid="load-error"
              className="mb-3 flex items-center justify-between rounded-[9px] bg-[#FDECEC] px-4 py-3 text-[13px] font-semibold text-[#DC2626]"
            >
              تعذر تحميل المنتجات — تحقق من الاتصال ثم أعد المحاولة
              <button
                onClick={() => fetchProducts()}
                className="cursor-pointer rounded-[7px] border-none bg-[#DC2626] px-3 py-1.5 font-[inherit] text-[12px] font-bold text-white hover:brightness-110"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : null}
          <ProductTable
            products={filtered}
            page={page}
            perPage={PER_PAGE}
            editingId={editingId}
            onPageChange={setPage}
            onEdit={isAdmin ? onEdit : undefined}
            onDelete={isAdmin ? onDelete : undefined}
            readOnly={!isAdmin}
          />
        </div>

        {isAdmin ? (
          <Sidebar tab={tab} onTabChange={setTab} showEmployeesTab>
            {tab === "add" ? (
              <AddProductTab
                form={form}
                error={formError}
                saving={saving}
                editing={editingId !== null}
                created={created}
                onField={onField}
                onSave={save}
                onNew={clearForm}
                onClear={clearForm}
              />
            ) : null}
            {tab === "print" ? (
              <PrintTab
                products={products}
                selected={printSel}
                onToggle={(id) =>
                  setPrintSel((sel) =>
                    sel.includes(id)
                      ? sel.filter((x) => x !== id)
                      : [...sel, id],
                  )
                }
                onPrint={onPrint}
              />
            ) : null}
            {tab === "scan" ? <ScanTab /> : null}
            {tab === "make" ? (
              <MakerTab
                onUseInAdd={(barcode) => {
                  setTab("add");
                  setForm((f) => ({ ...f, barcode }));
                }}
              />
            ) : null}
            {tab === "employees" ? <EmployeesTab /> : null}
          </Sidebar>
        ) : (
          <EmployeePanel />
        )}
      </div>

      <BottomBar userLabel={isAdmin ? "مدير النظام" : "موظف"} />

      {isAdmin ? null : (
        <NewProductAlerts
          alerts={alerts}
          onDismiss={dismiss}
          onShow={(barcode) => {
            setSearch(barcode);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
