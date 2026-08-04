# final.md — Warehouse & Barcode Management System

Build report for the system specified in `plan.md`. Reference design
(`إدارة المخازن - سطح المكتب.dc.html`) was present in the repo and was used as
the source of truth for layout, colors, RTL direction, and all Arabic copy.

---

## 1. What was built

A cloud-ready, Arabic (RTL) warehouse management web app that runs in any
browser. All screens are converted from the static design into working React
components with real data underneath.

**The three core features:**

1. **Add product + automatic barcode** — the "إضافة منتج" form creates a
   product via `POST /api/products`; the server atomically generates a unique
   13-digit EAN-13 barcode (6-digit prefix + 6-digit product-id sequence +
   computed check digit) inside one DB transaction, and the UI immediately
   shows the digits and the rendered barcode image.
2. **Print barcode** — the "طباعة باركود" tab lists products with checkboxes;
   printing opens `/print?ids=1,2,3` in a new tab, a chrome-free label layout
   (50mm × 30mm per label, one page per product: name, EAN-13 SVG, digits,
   sell price) that auto-calls `window.print()` after the SVGs paint.
   `/print/[id]` prints a single label. Uses the normal browser print dialog —
   the owner picks their thermal printer there.
3. **Scan barcode** — the "قارئ باركود" tab keeps one large input permanently
   focused (auto-refocus on blur/click); pressing Enter looks up the exact
   barcode and instantly shows the product card (name, prices, quantity), then
   clears and refocuses for the next scan. A USB scanner is a HID keyboard, so
   this works with any scanner out of the box.

**Supporting features:** full product table (exact column order from the
spec), live clock in the top bar, search (exact barcode OR partial
case-insensitive name), "تحديث" refresh, "تصدير إلى Excel" (.xlsx via
exceljs, RTL sheet), edit ✎ / delete 🗑 row actions (delete with confirmation),
three-tier colored quantity badges, "صانع باركود" standalone
generator/preview/download tool, login page, and a session guard on every
route except `/login`.

## 2. Tech stack actually used (deviations noted)

| Layer | Choice |
|---|---|
| Framework | Next.js **16.3.0**, App Router, TypeScript, Turbopack |
| Database | Turso / libSQL (`@libsql/client` 0.17) — local dev/tests use `file:` databases |
| ORM | Drizzle ORM 0.45 + drizzle-kit migrations |
| Auth | Auth.js v5 (`next-auth@5.0.0-beta.32`), Credentials provider, JWT sessions, `bcryptjs` |
| Barcode | `bwip-js` 4.11 (pure JS, `ean13` / `code128`), rendered as SVG |
| Excel | `exceljs` 4.4 |
| Validation | `zod` 4 on every API route |
| Styling | Tailwind CSS v4 (properly installed via `@tailwindcss/postcss`, no CDN), Noto Kufi Arabic via `next/font` |
| Tests | Vitest 4 (unit + integration projects) and Playwright 1.62 |

**Deviations from the plan, with reasons:**

- **`src/proxy.ts` instead of `middleware.ts`** — Next.js 16 renamed the
  route-interception file; the plan explicitly said to use whichever is
  current.
- **The add-product form includes the الباركود field** (as in the design) as
  an *optional* manual barcode: leave it empty → server auto-generates the
  EAN-13 (the spec's flow); fill it (typed or scanned) → the server validates
  digits-only and uniqueness (409 on duplicates). This is a strict superset of
  the Section 6 endpoint contract.
- **Date/time/notes inputs from the raw design HTML were omitted** from the
  form: the plan's Section 3 field list (الباركود / اسم المنتج / سعر الشراء /
  سعر البيع / سعر المفرد + الكمية) and the Section 5 schema (no notes column;
  `created_at` set server-side) are authoritative.
- **Quantity badge thresholds** use the plan's suggested defaults (red < 30,
  amber 30–59, green ≥ 60) as named constants in `src/lib/constants.ts`
  (`QTY_RED_BELOW`, `QTY_AMBER_BELOW`) — the design file used slightly
  different cutoffs, but the plan says the constants are the contract.
- **Vitest config is `vitest.config.mts`** (ESM) because the package is CJS by
  default and Vitest 4's config loader requires ESM.
- **Phase 7 (deploy) could not be executed from this machine** — no Turso or
  Vercel accounts/credentials/CLIs are available in this environment. The app
  is fully deploy-ready; the exact steps are in Section 4 and are the only
  manual work remaining.

## 3. How to run locally

```bash
npm install

# 1) Environment — copy and fill (a local file DB needs no Turso account):
#    TURSO_DATABASE_URL=file:local.db
#    TURSO_AUTH_TOKEN=            (empty for file DBs)
#    AUTH_SECRET=<any long random hex, e.g. `openssl rand -hex 32`>
#    BARCODE_PREFIX=628110        (must be exactly 6 digits)
#    ADMIN_EMAIL=admin@example.com
#    ADMIN_PASSWORD=<choose one>
cp .env.example .env

# 2) Create the schema and the first admin login
npx drizzle-kit migrate
npm run seed

# 3) Run
npm run dev        # development, http://localhost:3000
# or production:
npm run build && npm run start
```

Log in at `/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

**Tests:**

```bash
npm run test           # unit + integration (Vitest)
npm run test:e2e       # Playwright (builds & starts its own server on :3100
                       #  against a throwaway e2e.db; run
                       #  `npx playwright install chromium` once first)
```

## 4. How to deploy (Turso Cloud + Vercel)

```bash
# --- Turso (database) ---
# install CLI: https://docs.turso.tech/cli/installation
turso auth login
turso db create warehouse-db
turso db show warehouse-db --url        # → TURSO_DATABASE_URL (libsql://…)
turso db tokens create warehouse-db     # → TURSO_AUTH_TOKEN

# run migrations + seed the admin against the cloud DB (from this repo):
#   set TURSO_DATABASE_URL / TURSO_AUTH_TOKEN / ADMIN_EMAIL / ADMIN_PASSWORD
#   in .env, then:
npx drizzle-kit migrate
npm run seed

# --- Vercel (app) ---
npm i -g vercel
vercel login
vercel link
vercel env add TURSO_DATABASE_URL      # the libsql:// URL
vercel env add TURSO_AUTH_TOKEN
vercel env add AUTH_SECRET             # openssl rand -hex 32
vercel env add BARCODE_PREFIX          # 628110
vercel --prod
```

Then verify on the live URL: log in, add a product (barcode appears), open the
قارئ باركود tab and "scan" (type + Enter) that barcode, print a label, export
Excel. `ADMIN_EMAIL`/`ADMIN_PASSWORD` are only used by the seed script — they
do not need to be set on Vercel.

## 5. Full test results — all passing

**61 tests: 23 unit / 18 integration / 19 e2e — 100% pass.**

```
Vitest (unit):         Tests  23 passed (23)
Vitest (integration):  Tests  18 passed (18)
Vitest (combined run): Test Files  3 passed (3)   Tests  41 passed (41)
Playwright (e2e):      19 passed (27.3s)
next build:            ✓ Compiled successfully — zero TypeScript errors
```

Coverage highlights, per the Section 11 checklist:

- `computeEan13CheckDigit`: verified real-world vector
  `computeEan13CheckDigit("400638133393") === 1`, all-zeros, all-nines,
  rejects non-12-digit / non-numeric input.
- Barcode assembly always yields exactly 13 digits satisfying EAN-13 validity,
  for multiple prefixes and ids; rejects ids beyond the 6-digit sequence.
- Zod schemas reject negative and non-numeric prices/quantity.
- Integration (throwaway local libSQL file, never the production DB):
  create-with-unique-valid-barcode, 50 back-to-back creates with zero
  duplicates, barcode lookup + 404 for unknown, delete → subsequent lookup
  404s, duplicate manual barcode → 409, and **401 on every
  `/api/products/*` route (and `/api/barcode`, `/api/products/export`) when
  unauthenticated**.
- E2E: login happy/wrong-password paths, add-product (13-digit barcode +
  rendered image asserted), scanner simulation (below), print (`window.print`
  stubbed and called exactly once; `/print/[id]` verified under
  `page.emulateMedia({ media: "print" })`), Excel download event for `.xlsx`,
  RTL sanity (`dir="rtl"`, unmangled Arabic strings), live clock format/tick,
  edit/delete row actions, three quantity-badge tiers, search by partial name
  and exact barcode, صانع باركود generation/preview.
- No browser console errors during E2E runs (asserted in the main flows;
  expected 404s from intentional unknown-barcode lookups excluded).

## 6. Scanner verification note

**No physical barcode scanner existed during development.** Scanning was
tested with Playwright keyboard-event simulation:
`page.keyboard.type(barcode, { delay: 15 })` followed by
`page.keyboard.press("Enter")` into the auto-focused reader input.

This is a faithful substitute, not a shortcut: a USB barcode scanner is,
electrically and to the browser, a **keyboard** (USB HID). It "types" the
digits within milliseconds and terminates with an Enter keystroke. The browser
cannot distinguish the simulated keystrokes from a real scanner's — the test
exercises the exact same input path end to end (keydown events → Enter →
`GET /api/products?barcode=…` → product card render → clear → refocus).

**First-time checklist when a real scanner arrives:**

1. Plug the scanner in (no drivers/config needed for standard USB HID mode).
2. Log in and open the **قارئ باركود** tab — the input focuses itself.
3. Scan any printed product label.
4. Confirm the product card (name, quantity, prices) appears within ~1 second.
5. Confirm the input cleared and is focused again — scan a second label
   immediately with no clicking in between.
6. Scan a barcode that isn't in the system → the red
   "لا يوجد منتج بهذا الباركود" message should appear.
7. Optionally aim a scan at the top search bar — the table filters to that
   product.
8. If the scanner emits something other than a trailing Enter (rare;
   configurable via the scanner's manual), set its suffix to CR/Enter.

## 7. Known limitations / deferred items (per Section 10)

- **No local print-agent service.** Printing uses the browser dialog. Natural
  future upgrade: a small local Node service that accepts print jobs over the
  network and sends raw ESC/POS or ZPL directly to the thermal printer,
  skipping the dialog. Label size is a named constant
  (`LABEL_WIDTH_MM`/`LABEL_HEIGHT_MM` in `src/lib/constants.ts`) so other
  label stock is a one-line change.
- No camera/mobile scanning.
- No multi-warehouse/multi-branch support.
- Single `admin` role only; no granular permissions.
- No invoicing or payments.
- Cloud deployment itself (Section 4) is pending owner credentials — the only
  step not executed in this build.

## 8. Barcode format reference

```
[ 6 2 8 1 1 0 ] [ S S S S S S ] [ C ]
  BARCODE_PREFIX   product id      EAN-13
  (env var,        zero-padded     check digit
   6 digits)       to 6 digits     (computed)
```

- Example: product id `12` with prefix `628110` →
  payload `628110000012` → check digit `2` → barcode **`6281100000122`**.
- Check digit: for the 12 payload digits, sum digits in odd (1-indexed)
  positions ×1 and even positions ×3; check digit = `(10 − sum mod 10) mod 10`
  (`src/lib/ean13.ts`, exhaustively unit-tested).
- Any code starting with the shop's 6-digit prefix is one of its own labels;
  the middle 6 digits are the product's database id.
- Symbology EAN-13 was chosen because every scanner ever made reads it with
  zero configuration. Capacity is 999,999 products
  (`BARCODE_SEQUENCE_WIDTH` in `src/lib/constants.ts` widens it if ever
  needed).
