/** Number with thousands separators, e.g. 45000 → "45,000". */
export function fmtNumber(n: number): string {
  return Number(n).toLocaleString("en-US");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** unix ms → "YYYY-MM-DD" (تاريخ الإدخال). */
export function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** unix ms → "hh:mm ص/م" (ساعة الإدخال). */
export function fmtTime(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const ap = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return `${pad(h)}:${pad(d.getMinutes())} ${ap}`;
}

/** now → "hh:mm:ss ص/م" for the live clock. */
export function fmtClock(d: Date): string {
  let h = d.getHours();
  const ap = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return `${pad(h)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ap}`;
}
