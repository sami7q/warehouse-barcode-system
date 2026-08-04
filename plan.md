# Warehouse & Barcode Management System — Build Specification for Claude Code

## 0. How to use this document

You (Claude Code) are being handed this file as your complete build brief. Read it fully once, then execute **Section 12 (Implementation Phases)** in order. Do not skip a phase or start the next one until the previous phase's tests are green.

This document is written entirely in English per the project owner's instruction. Short Arabic strings that appear below (in quotes or code) are **literal UI copy taken from the reference design** — preserve them exactly, character-for-character, in the built application. Do not translate them.

**Reference design file:** `إدارة المخازن - سطح المكتب.dc.html`, expected in the project root. This is a Claude Design export of the desktop UI and is the single source of truth for layout, colors, spacing, RTL direction, and exact Arabic copy. **If this file is not present in the repository when you start:** do not block on it. Proceed with Sections 5–11 (schema, APIs, logic, tests) using a clean, minimal RTL Tailwind layout that matches the field/column list in Section 3 as closely as you can, and record clearly in `final.md` that a pixel-fidelity pass against the real design file is still needed once it's added to the repo.

---

## 1. Project context

A small business needs a simple, cloud-hosted, Arabic (RTL) warehouse/inventory tool. It must run in a browser on a laptop (no installed desktop app required). The UI already exists as a static design; your job is to make it fully functional.

The three features the owner cares about most, in priority order:
1. Add a product and have the system generate a unique barcode for it automatically.
2. Print that barcode on a connected label/thermal printer.
3. Scan a product's barcode and have the system pull it up instantly ("smoothly").

**Important constraint:** there is no physical barcode scanner available during development. Section 11 explains exactly how to test scanning to full confidence without one — this is not a compromise, it is a faithful simulation of the real hardware's behavior, explained below.

---

## 2. Tech stack (use exactly this; do not substitute without a strong reason noted in final.md)

- **Framework:** Next.js, latest stable release, App Router, TypeScript. (Framework internals move fast — e.g. some Next.js versions renamed `middleware.ts` to `proxy.ts` for route interception. Check the actually-installed version's current convention rather than assuming; whichever mechanism is current, use it for the auth guard in Section 6.5.)
- **Database:** Turso Cloud (managed libSQL/SQLite-compatible, serverless-friendly, generous free tier — good fit for a simple app like this).
- **DB client / ORM:** `@libsql/client` + **Drizzle ORM** (the standard, first-class pairing for Turso; TypeScript-native schema and migrations).
- **Auth:** **Auth.js v5** (package `next-auth@beta`, formerly "NextAuth"). Credentials provider only (email + password, no OAuth needed). JWT session strategy — **no database adapter needed**, since there's no OAuth account linking to persist; the `authorize()` callback queries Drizzle directly and compares the password with bcrypt. Env var is `AUTH_SECRET`.
- **Password hashing:** `bcryptjs`.
- **Barcode rendering:** `bwip-js` (pure JavaScript, no native canvas bindings — safe inside Vercel serverless functions). Symbology: `ean13` (see Section 6 for why).
- **Excel export:** `exceljs`.
- **Validation:** `zod` for all API route input.
- **Styling:** whatever the reference HTML file uses (most Claude Design exports use Tailwind utility classes). Install Tailwind properly for production; do not ship a CDN `<script>` tag build. Preserve `dir="rtl"` and the existing Arabic font.
- **Testing:** `vitest` (unit + integration) and `@playwright/test` (end-to-end).
- **Hosting:** Vercel for the app, Turso Cloud for the database.

---

## 3. Design fidelity rules

Treat the reference HTML as ground truth for:
- Top bar: window-chrome dots (non-functional, decorative), a **live clock** (updates every second, format matches `YYYY-MM-DD HH:MM:SS ص/م`), the title "إدارة المخازن", and the home icon.
- Left sidebar tabs: "صانع باركود" (barcode maker), "قارئ باركود" (barcode reader), "طباعة باركود" (print barcode), "إضافة منتج" (add product — the form with الباركود / اسم المنتج / سعر الشراء / سعر البيع / سعر المفرد fields).
- Main panel: search bar ("ابحث باسم المنتج أو الباركود" + "بحث" button), "تحديث" (refresh) button, "تصدير إلى Excel" (export) button, and the product table with columns in this exact order: `# | الباركود | اسم المنتج | سعر الشراء | سعر البيع | سعر المفرد | الكمية | تاريخ الإدخال | ساعة الإدخال | إجراءات`.
- Row actions: 🗑 delete (red), ✎ edit (blue).
- Quantity is shown as a colored badge, three tiers. Exact thresholds aren't specified precisely by the source design, so use named, easily adjustable constants — suggested defaults: red `< 30`, amber `30–59`, green `≥ 60`.

Convert the static HTML into componentized React: `<TopBar/>`, `<Sidebar/>`, `<TabNav/>`, `<ProductForm/>`, `<ProductTable/>`, `<SearchBar/>` — same visual output, real data underneath.

---

## 4. Environment variables (`.env.example`)

```
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
AUTH_SECRET=
BARCODE_PREFIX=628110
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

`BARCODE_PREFIX` must be exactly 6 digits (see Section 6). `ADMIN_EMAIL` / `ADMIN_PASSWORD` are consumed only by the one-time seed script (Section 6.5) to create the first login — never store the plaintext password anywhere else.

---

## 5. Database schema (Drizzle, SQLite/libSQL types)

```
users
  id             INTEGER  PK AUTOINCREMENT
  email          TEXT     UNIQUE NOT NULL
  password_hash  TEXT     NOT NULL
  role           TEXT     NOT NULL DEFAULT 'admin'
  created_at     INTEGER  NOT NULL   -- unix ms

products
  id              INTEGER  PK AUTOINCREMENT
  barcode         TEXT     UNIQUE NOT NULL   -- 13-digit EAN-13
  name            TEXT     NOT NULL
  purchase_price  INTEGER  NOT NULL          -- سعر الشراء
  sell_price      INTEGER  NOT NULL          -- سعر البيع
  unit_price      INTEGER  NOT NULL          -- سعر المفرد
  quantity        INTEGER  NOT NULL DEFAULT 0
  created_at      INTEGER  NOT NULL
  updated_at      INTEGER  NOT NULL
```

Prices/quantity are plain integers (no decimal subunits), matching the whole-number style shown in the reference design. Add a unique index on `products.barcode` and a regular index on `products.name` for search.

---

## 6. Feature 1 — Add product & generate a unique barcode

**Endpoint:** `POST /api/products`
**Request body:** `{ name, purchase_price, sell_price, unit_price, quantity }` (validate with zod: name non-empty string; the three prices and quantity are non-negative integers).

**Why EAN-13, not a generic symbology:** the reference design's barcodes are 13-digit numeric strings, and EAN-13 is the one symbology every barcode scanner ever made — including the cheapest handheld ones — reads out of the box with zero configuration. Since the owner doesn't have a scanner yet and needs this to "just work" with whatever they eventually buy, EAN-13 is the safest choice. The tradeoff is it requires a real checksum, which is why it's specified precisely below.

**Server-side generation algorithm (implement as an atomic sequence, inside one DB transaction):**
1. Validate input.
2. Insert the product row with a temporary placeholder barcode (e.g. empty string) and get back the auto-generated `id`.
3. `sequence = String(id).padStart(6, '0')`
4. `data12 = BARCODE_PREFIX + sequence` — this **must** be exactly 12 digits (6-digit prefix + 6-digit sequence). If the shop is ever expected to exceed 999,999 products, widen the sequence portion — not a concern at this scale, but the constant should stay easy to change.
5. `checkDigit = computeEan13CheckDigit(data12)`
6. `barcode = data12 + String(checkDigit)` → exactly 13 digits.
7. Update the row's `barcode` field with this value, same transaction.
8. Return the full product record, plus a rendered barcode image (SVG from `bwip-js`, `bcid: 'ean13'`).

**`computeEan13CheckDigit` — implement exactly this (it is the single most important pure function in the codebase; unit-test it thoroughly):**

```typescript
export function computeEan13CheckDigit(twelveDigits: string): number {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error("Expected exactly 12 digits");
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(twelveDigits[i]);
    // 1-indexed odd positions × 1, even positions × 3
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}
```

**Verified test vector to include literally in the unit tests:** `computeEan13CheckDigit("400638133393")` must return `1` (this is a well-known real-world EAN-13 check digit, hand-verified — use it as a known-good fixture, not just a made-up one).

The "إضافة منتج" form (already present in the design) posts to this endpoint. On success, show the generated barcode — both the digits and the rendered image — immediately, before the user navigates away.

---

## 7. Feature 2 — Print barcode

- New route: `/print/[id]` — renders **only** the label layout, no app chrome. `@page { size: 50mm 30mm; margin: 0 }` as the default label size (make this a named constant; thermal label printers vary, so this must be trivial to change later).
- Label contents: product name, the EAN-13 barcode image (`bwip-js` SVG), the human-readable digits underneath, and the sell price.
- On the "طباعة باركود" tab: a compact list of products with checkboxes. Selecting one or more and clicking print opens `/print?ids=1,2,3` in a new tab, which auto-calls `window.print()` after the barcode SVGs have painted (a short delay, e.g. 300ms, is enough — don't call it before the SVGs exist in the DOM).
- **Scope for this phase:** ship the plain browser print dialog only — the user picks their label/thermal printer the same way they'd pick any printer in Windows/macOS. Do **not** build a local print-agent/bridge service in this phase; note it in `final.md` as a natural future upgrade (a small local Node service that would accept a print job over the network and send raw ESC/POS or ZPL commands directly to the printer, skipping the print dialog entirely) — but it is out of scope now.
- Acceptance test: the print route must render correctly under Playwright's `page.emulateMedia({ media: 'print' })`.

---

## 8. Feature 3 — Read / scan barcode smoothly

**The one fact this whole feature depends on:** a USB barcode scanner is, electrically and to the browser, a keyboard. When it reads a barcode it "types" the digits in a few milliseconds and finishes with an Enter keystroke. No SDK, no special browser permission, no native integration is needed — you're just handling fast keyboard input.

- On the "قارئ باركود" tab: render one large text input that stays focused at all times (auto-refocus on blur or on any click elsewhere in the tab). Below it, a live "product found" card.
- On `Enter` keydown in that input: call `GET /api/products?barcode=<value>`. On a match, show the full product card (name, prices, quantity) instantly, then clear the input and refocus. On no match, show a clear "not found" state, then clear and refocus.
- Wire the exact same lookup into the existing top search bar ("ابحث باسم المنتج أو الباركود"), since a scanner could also be aimed at that field — match by exact barcode OR partial, case-insensitive name.
- Out of scope for this phase: camera/mobile scanning (see Section 10).

---

## 9. Supporting features (already visible in the reference design — build alongside the three above)

- Full product table with the exact column order from Section 3.
- "تحديث" → re-fetch `GET /api/products`.
- "تصدير إلى Excel" → `GET /api/products/export` builds an `.xlsx` (via `exceljs`) with the same columns and triggers a download.
- Row actions: edit (✎) → `PUT /api/products/:id`; delete (🗑) → `DELETE /api/products/:id` with a client-side confirmation prompt.
- Quantity badge coloring per Section 3.
- "صانع باركود" tab: a standalone utility — type or paste any text/number, preview and download a generated barcode image, without saving it as a product. Useful for one-off labels.
- Login page + session guard on every route except `/login`.

---

## 10. Non-goals (explicitly do not build in this phase)

- Multi-warehouse / multi-branch support.
- Roles or permissions beyond a single admin role.
- The local print-agent service described in Section 7 (documented as future work only).
- Camera-based / mobile barcode scanning.
- Any invoicing or payment functionality.

---

## 11. Testing strategy — mandatory, 100% pass required before any phase counts as done

### 11.1 Unit tests (Vitest)
- `computeEan13CheckDigit`: the verified vector from Section 6, plus edge cases (all zeros, all nines, rejects non-12-digit input).
- Barcode assembly: for any `BARCODE_PREFIX` + product `id`, the output is always exactly 13 numeric digits and satisfies EAN-13 validity.
- Zod schemas reject negative prices/quantity and non-numeric input.

### 11.2 Integration tests (Vitest against a throwaway local libSQL file, not the production Turso database)
- `POST /api/products` creates a row with a valid, unique barcode.
- Creating 50 products back-to-back never produces a duplicate barcode.
- `GET /api/products?barcode=X` returns the right product; unknown barcode returns 404 JSON.
- `DELETE /api/products/:id` removes it; a subsequent `GET` 404s.
- Every `/api/products/*` route returns 401 when unauthenticated.

### 11.3 End-to-end tests (Playwright) — **including the no-hardware scanner simulation**
- Login flow, happy path and wrong-password path.
- Add-product flow: fill the "إضافة منتج" form → submit → assert a 13-digit barcode and its rendered image appear.
- **Scanner simulation (this stands in for the missing physical reader):** on the "قارئ باركود" tab, use `page.keyboard.type(barcode, { delay: 15 })` followed by `page.keyboard.press('Enter')` into the auto-focused input. This reproduces, keystroke for keystroke, exactly what a real USB HID scanner sends to the browser — a pass here is not a weaker substitute for hardware testing, it is the same input the browser would ever see either way. Assert the correct product card renders. Also test scanning an unknown barcode → assert the "not found" state.
- Print flow: trigger print on one product → assert the `/print/[id]` route renders correctly under `media: 'print'` emulation and contains the right barcode and name; stub `window.print` before navigation and assert it was called exactly once.
- Excel export: click "تصدير إلى Excel" → assert a download event fires for an `.xlsx` file.
- RTL sanity: assert `dir="rtl"` on the root layout and that Arabic strings render correctly (no mangled encoding).

### 11.4 Definition of done, per phase — check every box before moving on
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] `next build` completes with zero TypeScript errors
- [ ] No errors in the browser console during the E2E run
- [ ] Anything that genuinely cannot be verified without physical hardware is written down as a manual step in `final.md`, not silently skipped

---

## 12. Implementation phases — execute in this exact order

- **Phase 0 — Setup:** Next.js + TypeScript + Turso + Drizzle wired up; initial migration run; `.env.example` committed; reference HTML parsed into the base layout components from Section 3.
- **Phase 1 — Auth:** login page, JWT session, seed script (reads `ADMIN_EMAIL`/`ADMIN_PASSWORD`), route guard on everything but `/login`. Tests green.
- **Phase 2 — Feature 1:** product CRUD + EAN-13 generation (Section 6). Tests green.
- **Phase 3 — Feature 2:** printing (Section 7). Tests green.
- **Phase 4 — Feature 3:** scanning/search (Section 8). Tests green.
- **Phase 5 — Supporting features:** Excel export, refresh, edit/delete, quantity badges, "صانع باركود" tool (Section 9). Tests green.
- **Phase 6 — Full regression:** run the entire suite once more end-to-end; fix anything red.
- **Phase 7 — Deploy:** Vercel (app) + Turso Cloud (`turso db create`, generate token, set env vars); verify the live URL works end-to-end, not just `localhost`.
- **Phase 8 — Write `final.md`** (Section 13) and stop.

Recommended but not mandatory: commit at the end of each phase with a message like `Phase 2 complete: product CRUD + EAN-13 generation, all tests passing` — gives you (and the owner) clean checkpoints to review or roll back to.

---

## 13. `final.md` — required structure (write this last, only once every test is green)

1. **What was built** — plain-English summary of the three core features plus supporting features.
2. **Tech stack actually used**, and any deviation from Section 2 with the reason why.
3. **How to run locally** — exact commands, start to finish.
4. **How to deploy** — exact commands/steps, including the Turso database creation steps.
5. **Full test results** — counts (X unit / Y integration / Z e2e), all passing, paste the final test-run summary output.
6. **Scanner verification note** — explicitly confirm scanning was tested via keyboard-event simulation (no physical device available) and why that's a faithful substitute (Section 11.3). Include a short manual checklist the owner can run the first time they plug in a real scanner (e.g.: open the قارئ باركود tab, scan any product label, confirm the card appears within ~1 second, confirm the input auto-refocuses for the next scan).
7. **Known limitations / deferred items** — pulled from Section 10.
8. **Barcode format reference** — the exact prefix and algorithm used, so the business can recognize its own codes at a glance.
