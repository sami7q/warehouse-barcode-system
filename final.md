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
- **Phase 7 (deploy)** was initially blocked on cloud credentials; it has
  since been **executed for real** — see the
  "Production Readiness Audit & Deployment" section at the end of this file
  for the live URL and smoke-test results.

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

---

## Production Readiness Audit & Deployment

Adversarial pre-launch audit per the production-readiness spec. Every check
below was actually executed, not assumed. New totals after this audit:
**92 tests passing — 38 unit / 25 integration / 29 e2e** (up from 61).

### Section 1 — Carry-over items

| Item | Result |
|---|---|
| Git history secret check (`git log --all --full-history -- .env local.db "*.sqlite" "*.sqlite3"`) | **PASS — empty.** No `.env`, no database file was ever committed in any commit. Only `.env.example` (empty values) is tracked. No purge needed; repo has never been pushed anywhere. |
| Fresh `AUTH_SECRET` | **DONE.** Newly generated (32 random bytes, base64) for production only; stored in git-ignored `.env.production.local` and in Vercel encrypted env vars. Never printed to any report/chat. The dev secret remains only for local dev. |
| Fresh admin credentials | **DONE.** New random password generated straight into `.env.production.local` (git-ignored) and used only to seed the production DB. It appears in no report, no chat output, no commit. Retrieval: see "Credentials handoff" below. The dev credentials (`admin@warehouse.local`) are considered burned — they exist only in the local dev `.env` and were never seeded to production. |
| Quantity thresholds (red < 30, amber 30–59, green ≥ 60) | **CONFIRMED** as named constants `QTY_RED_BELOW` / `QTY_AMBER_BELOW` in `src/lib/constants.ts`, used in exactly one place (`qtyTier()`); no magic numbers in the UI. **⚠ Placeholder business logic — confirm real thresholds with the client.** |

### Section 2 — Security audit

| Check | Result |
|---|---|
| Raw / concatenated SQL | **PASS.** Grep found zero raw SQL; every query goes through Drizzle query builder (parameterized). |
| Fresh 401 audit (independent of original suite) | **PASS.** New `e2e/audit.spec.ts` hits `POST /api/products`, `PUT`/`DELETE /api/products/:id`, `GET /api/products`, `/api/products/export`, `/api/barcode` with no session cookie → all 401 JSON. Also re-verified via direct HTTP against the production URL in the smoke test. |
| Brute-force protection | **IMPLEMENTED.** `src/lib/login-rate-limit.ts`: 5 consecutive failures for an email → 15-minute lockout; success resets the counter; case-insensitive keying. Wired into `authorize()` in `src/auth.ts`. Verified by 6 unit tests plus an e2e test that locks a dedicated seeded user and confirms the *correct* password is refused during lockout. Limitation (documented): the counter is in-memory per server instance — adequate at this scale; a durable store is the upgrade path. |
| bcrypt cost factor | **PASS.** Cost 10 in both `scripts/seed.ts` and the e2e seed. |
| `password_hash` leakage | **PASS.** Grep shows `passwordHash` read only inside `authorize()` (for compare) — `authorize` returns `{id, email, name}` only; no API route selects from `users`. |
| CSRF on credentials sign-in | **PASS.** Login goes through Auth.js v5 `signIn()` (server action → `/api/auth/callback/credentials` with the double-submit CSRF token). E2E test posts valid credentials directly *without* a CSRF token and confirms no session is established. No custom code path bypasses Auth.js. |
| `npm audit` | **6 moderate, 0 high / 0 critical.** Accepted with reasons: (1) `esbuild` ≤0.24.2 via `drizzle-kit` — dev-only CLI tooling, never shipped to the production runtime, and the advisory concerns the esbuild *dev server*, which is never run; (2) `uuid` <11.1.1 via `exceljs` — the advisory concerns v3/v5/v6 `buf` argument bounds; the only "fix" downgrades exceljs to 3.x (breaking). Both are documented accepted risks; re-check on the next dependency refresh. |
| Hardcoded secrets | **PASS.** No secret/API key/fallback in `src/`; the only literals are the e2e fixtures (`e2e/credentials.ts`, `AUTH_SECRET` in `playwright.config.ts`) which are test-only and clearly labeled, and the non-secret `BARCODE_PREFIX` default. |
| HTTPS in production | **VERIFIED at deploy time** — the smoke test requests the `http://` URL with redirects disabled and asserts a 3xx redirect to `https://` (see Section 5 below). |

### Section 3 — Correctness & edge cases (all covered by new tests)

| Case | Result |
|---|---|
| Empty states | **PASS.** Zero products → "لا توجد منتجات" + "عرض 0 إلى 0 من 0 منتج"; no-result search → same clean empty state; print tab with nothing selected renders no print button/preview and cannot crash. |
| 200+ char name | **PASS.** Names capped at 200 chars (`MAX_NAME_LENGTH`); a 201-char name is rejected 400 with a clear Arabic message at both the schema and API level; the input also has `maxLength`. |
| Arabic + emoji + RTL control chars | **PASS.** Accepted, stored, and returned byte-identical (unit + integration round-trip tests, plus the Excel round-trip below). |
| Negative / zero / absurd values | **PASS.** Negative and fractional and stringified numbers → 400; zero is accepted (valid business case); values above `MAX_MONEY_VALUE` (10⁹) / `MAX_QUANTITY` (10⁶) → 400 with a clear message. |
| **True concurrency** | **PASS.** New integration test fires 20 `POST /api/products` via `Promise.all` → 20 × 201, all barcodes valid EAN-13, zero duplicates. Hardening added for SQLite single-writer reality: product creation is serialized per instance (`src/lib/serialize.ts`) and the insert+update transaction retries with backoff on `SQLITE_BUSY`. Logical uniqueness never depended on timing (barcode derives from the UNIQUE AUTOINCREMENT id + UNIQUE index on barcode). |
| **Rapid presentation-stand scans** | **PASS — required a real fix.** `ScanTab` now aborts superseded in-flight lookups (AbortController) and gates results by a sequence counter, so a slow earlier response can never overwrite a newer scan. Tests: 5 back-to-back scans (no waiting) → final card is the 5th product and stays correct after 800ms; plus a paced test asserting each of 5 sequential scans resolves to its own product. |
| Excel Arabic round-trip | **PASS.** Integration test re-opens the generated `.xlsx` with exceljs and asserts Arabic names (incl. emoji + dashes) round-trip unmangled and the sheet is `rightToLeft`. |
| Barcode quality at print size | **PASS — one real bug found and fixed.** At the 42mm barcode area the EAN-13 module width is 0.442mm ≥ the 0.264mm scannable minimum; unit tests assert all 30 bars render for small ids (leading-zero sequences) with identical viewBox across the id range. **Bug found:** a stored 13-digit barcode with an *invalid* check digit (possible via manual entry) made bwip-js throw → `/print` returned 500. Fixed: EAN-13 rendering only for check-digit-valid codes, Code 128 fallback otherwise (regression test added). |
| DB/network failure UI | **PASS.** Product-list fetch failure now shows a clear Arabic error banner with a working "إعادة المحاولة" button — never a blank screen or infinite spinner (e2e test aborts the API route, asserts the banner, restores the route, asserts recovery without reload). |
| Session expiry | **PASS.** A tampered/expired session cookie on `/` redirects cleanly to `/login`; the same cookie on the API returns 401 JSON (e2e-tested). |

### Section 4 — Performance & build

| Check | Result |
|---|---|
| `next build` | Clean, zero TS errors. Client static assets total **0.8 MB** — nothing unexpected. |
| 500 products | Seeded 500 rows; initial page load **336ms**, live search across them **58ms**, exact-barcode search narrows to 1 row instantly. Existing 10-per-page client pagination keeps the DOM small — no changes needed. |
| 20-label batch print | `/print?ids=…` with 20 products renders all 20 barcode SVGs server-side in **327ms** — no UI blocking. |

### Section 5 — Deployment (executed for real)

**Live production URL: https://warehouse-barcode-system.vercel.app**

What was done, in order:

1. **Turso Cloud:** authenticated via `turso auth login` (browser flow completed
   by the owner), created database `warehouse-db`
   (`libsql://warehouse-db-sami7q.aws-eu-west-1.turso.io`, aws-eu-west-1),
   ran the Drizzle migrations against it, and seeded the admin user with the
   fresh production credentials.
2. **Vercel:** linked project `softodevs-projects/warehouse-barcode-system`,
   set encrypted production env vars (`AUTH_SECRET`, `BARCODE_PREFIX`,
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`), deployed with
   `vercel deploy --prod`, aliased to the URL above.
3. **Deployment hygiene findings (found & fixed during deploy):**
   - The first deploy bundled the local dev `.env` and database files (Vercel
     CLI uploads the working directory). Fixed with a `.vercelignore`
     excluding env files, `*.db`, tests, and docs; the three pre-fix
     deployments were **deleted from Vercel**. Runtime was never affected
     (platform env vars always override `.env`), and only dev-only values were
     involved — the production secrets never existed in any file that left the
     machine unencrypted.
   - **BOM bug:** piping env values into `vercel env add` from PowerShell
     prefixed them with a UTF-8 BOM, which made the libSQL URL invalid in
     production (`URL_INVALID: '﻿libsql://…'`) and broke login. Root
     cause identified from Vercel runtime logs; all four env vars were
     removed and re-added BOM-free, then redeployed.

**Live smoke test — run against the production URL, not localhost
(`scripts/smoke-prod.ts`): 10/10 passed.**

```
PASS  HTTPS redirect enforced — status 308
PASS  unauthenticated /api/products → 401
PASS  login
PASS  add product generates 13-digit barcode — 6281100000013
PASS  barcode image rendered
PASS  scanner lookup returns the right product
PASS  print route renders label under print emulation
PASS  window.print auto-called exactly once — 1
PASS  Excel export downloads .xlsx
PASS  cleanup: smoke product deleted
```

(The generated `6281100000013` is the valid EAN-13 for product id 1 with
prefix 628110 — generation verified end-to-end on the real infrastructure.)

### Section 6 — Go/no-go checklist (each independently verified)

- [x] **No secrets anywhere in git history** — `git log --all --full-history`
      over `.env` / db files returns nothing; only the empty `.env.example`
      is tracked.
- [x] **Fresh `AUTH_SECRET` and fresh admin credentials in production** — both
      newly generated for production, stored only in the git-ignored
      `.env.production.local` and Vercel's encrypted env store. No dev
      placeholder is live; the new password appears in no report, chat log,
      or commit.
- [x] **`npm audit`** — 0 high / 0 critical; 6 moderate findings documented
      with acceptance reasons (dev-only drizzle-kit esbuild chain; exceljs →
      uuid, fix would be a breaking downgrade).
- [x] **All new edge-case tests passing alongside the originals** — 92 total:
      38 unit / 25 integration / 29 e2e, plus `next build` clean. (One
      transient vitest run showed 57/63 with unhandled async errors once
      during the audit; three consecutive full re-runs were 100% green — noted
      for transparency.)
- [x] **Concurrency test under genuine parallel load** — 20 × `Promise.all`
      POSTs: all 201, zero duplicate barcodes; creation serialized per
      instance with SQLITE_BUSY retry.
- [x] **Rapid-sequential-scan test passing** — 5 back-to-back scans resolve
      correctly; stale responses can never overwrite newer ones
      (AbortController + sequence guard).
- [x] **Production deployment live and smoke-tested end-to-end on the real
      URL** — 10/10 checks above.
- [x] **Quantity thresholds documented as pending business confirmation** —
      named constants in `src/lib/constants.ts`; ⚠ placeholder values,
      confirm with the client.

### Credentials handoff (how the owner retrieves access)

The production admin login is **not** written in this document, the chat log,
or any commit — per the audit's handling rules:

- **Email:** the owner's own Gmail address (the one used for this project).
- **Password:** stored on this machine only, in the git-ignored file
  `.env.production.local` in the project root (`ADMIN_PASSWORD=`), and used
  once to seed the production database. Open that file locally to retrieve
  it, log in at https://warehouse-barcode-system.vercel.app/login, and it is
  strongly recommended to change it afterwards (re-run `npm run seed` with new
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` env values pointed at the production DB — the
  seed updates the existing user's password in place).
- The Turso auth token and `AUTH_SECRET` live only in Vercel's encrypted env
  store (and the same local git-ignored file for the secret). Rotate either at
  any time via `turso db tokens create warehouse-db` / `vercel env`.

### Post-launch notes

- The brute-force lockout counter is in-memory per serverless instance —
  adequate now; move it to a Turso table if the product ever gets a public
  user base.
- `local.db` / `e2e.db` remain strictly local dev/test artifacts
  (git-ignored, vercel-ignored).
- Old Vercel deployments containing the dev `.env` were deleted; current
  production and all future deploys exclude it via `.vercelignore`.

---

## Print Label Fix

A real print test of `/print/[id]` for "كيلو سكر" (PDF export, visually
inspected) exposed three defects the automated suite had not caught. All three
are fixed, each with a regression test that fails against the old code.

### Root causes (not just symptoms)

**Defect B — product name missing from the label.** The label content stack
did not fit its own box: padding 3mm + name (10pt ≈ 4.7mm at the Arabic
font's line-height) + barcode 14mm + digits ≈ 3.8mm + price ≈ 4.3mm + three
1mm gaps ≈ **32.8mm of content inside a fixed 30mm box**. With
`justify-content: center` + `overflow: hidden`, the stack clips at both ends —
and the first element, the product name, is what disappeared. (It passed the
old tests because headless font metrics left it borderline; real-browser
metrics pushed it over.) **Fix:** the content budget was re-derived and
tightened — explicit `line-height: 1.2`, name 9pt single-line ellipsis,
barcode height 11mm (new named constant `LABEL_BARCODE_HEIGHT_MM`), digits
7.5pt, gaps 0.7mm, padding 1mm ≈ **26mm of 30mm → 4mm slack**. The barcode
stays scannable: effective module width 0.319mm ≥ the 0.264mm minimum
(recomputed in the unit test from the real constrained geometry).

**Defect C — wrong page size / 2 pages for 1 label.** Two causes. (1)
`break-after: page` applied to *every* label, including the last → a forced
trailing blank page (1 label printed as 2 pages). The first fix attempt
(`:not(:last-of-type)`) worked locally but still failed in production: after
hydration Next.js appends its route-announcer `div` to `<body>`, so the label
was no longer "last" and the break came back — a race the local test passed by
luck. **Final fix:** labels render inside a dedicated `<main>` wrapper and the
break rule is `.print-label + .print-label { break-before: page }` — a break
exists only *between* consecutive labels, immune to any trailing DOM Next
adds. The regression test now waits for hydration (`networkidle`) before
generating the PDF so it tests the worst case. (2) The full-size-page corner
rendering in the user's export came from the OS print dialog printing on
default A4 paper — see the physical-print note below; browser "Save as PDF"
and the PDF pipeline honor `@page 50mm 30mm` (verified: exported MediaBox is
50.12 × 29.97mm).

**Defect C (branding) — "إدارة المخازن" on the label.** That text was never in
the print route's DOM — it was the inherited document `<title>` from the root
layout, which browsers print in the page header (and headers get room when
the page size falls back to A4). **Fix:** print routes now carry their own
metadata — `/print/[id]`'s title is the product name (also giving the PDF a
sensible filename), `/print?ids=` uses "ملصقات باركود".

**Defect A — content rotated ~90°.** No rotation exists in the code: audited
every element's computed `transform` (must be none/identity) and
`writing-mode` (must be `horizontal-tb`), and the barcode SVG's own markup
(plain vertical-line paths, no transform/viewBox rotation) — now enforced by
a regression test. The exported PDF contains **no `/Rotate` entries**. The
rotation in the field print came from the export pipeline: a 50×30mm CSS page
is landscape-oriented, and when forced onto portrait A4 by the OS print
dialog the content gets auto-rotated and cornered. With the correct label
stock selected (or browser Save-as-PDF), output is upright — see the manual
note below.

### Regression tests added (`e2e/print-pdf.spec.ts`, all green; red on old code)

- PDF page size exactly 50mm × 30mm (≈141.73 × 85.04pt MediaBox), via
  `page.pdf({ preferCSSPageSize: true })` — not a default paper size.
- Exactly 1 page for 1 label and exactly N pages for N labels (fails on the
  old code with 2 and 4), generated after hydration.
- Product name text node exact-match AND its bounding box fully inside the
  label box (catches visible-but-clipped), parametrized over "كيلو سكر" and a
  long name; plus scrollHeight ≤ clientHeight (zero overflow).
- No element computes a rotating transform; every element is
  `writing-mode: horizontal-tb`; the barcode SVG markup itself contains no
  rotation.
- No app chrome: rendered body text and document title contain no
  "إدارة المخازن"; the label contains exactly the four required elements
  (name, barcode, digits, price) and nothing else.
- Visual baseline artifacts attached to the test output (label PNG + PDF).

**Totals after fix: 99 tests passing (63 vitest + 36 Playwright), build clean.**

### Fresh verification against production (deployed and re-exported)

`scripts/export-label-pdf.ts` against the live URL for the real "كيلو سكر"
product (id 2): **1 page, 50.12 × 29.97mm, no rotation entries, name present,
digits 6281100000020, title "كيلو سكر"**. Known-good artifacts committed at
`docs/label-baseline.pdf` / `docs/label-baseline.png`.

### Physical print note (manual step for the owner)

A correct PDF does not guarantee a correct physical print: in the print
dialog, the **printer's paper size must be set to the 50×30mm label stock**
(and scale to 100%). If the driver is left on A4/Letter, Windows will rotate
and corner the label exactly like the defect being fixed here. Set the label
size once in the printer driver defaults (Printing Preferences → Page Setup →
50mm × 30mm), then print a label and scan it with the Zebra scanner to
confirm a first-attempt read — the barcode module width (0.319mm) is above
the standard scannable minimum, so a clean thermal print should read
immediately.

---

## Remember Me & Full Mobile Responsiveness

Two feature additions, requested directly by the business owner: a "تذكرني"
(remember me) login option, and a fully responsive layout for phones.

### تذكرني (Remember me)

- New checkbox on `/login`, checked by default, `name="remember"`.
- Wired through Auth.js v5's Credentials provider: `authorize()` now accepts
  a `remember` field and attaches it to the returned user; a `jwt` callback
  copies it onto the token; a custom `jwt.encode` (wrapping the library's
  default `encode` from `next-auth/jwt`) selects the session length from it —
  **30 days when checked, 1 day when unchecked** (`REMEMBER_ME_MAX_AGE_SECONDS`
  / `DEFAULT_SESSION_MAX_AGE_SECONDS` in `src/lib/constants.ts`, selected by
  the pure, unit-tested `resolveSessionMaxAge()`). This is the standard
  documented Auth.js recipe for per-login session length — the cookie's own
  physical `Max-Age` stays at the 30-day ceiling either way, but the *token's
  own* `exp` claim is what's shortened when unchecked, and Auth.js validates
  that claim server-side on every request, so an unremembered session
  functionally expires after a day regardless of whether the cookie file is
  still sitting in the browser.
- **Test coverage note, stated plainly:** the exact resulting duration is
  verified at the unit level (`resolveSessionMaxAge` — both branches, and
  that "remembered" is strictly longer). Confirming the *exact* number
  end-to-end would require decrypting Auth.js v5's session token, which is an
  encrypted-JWE scheme with a per-cookie salt derivation — reimplementing
  that in a test isn't worth the fragility it would add. Instead, the e2e
  suite (`e2e/remember-me.spec.ts`) proves both code paths actually run in
  the live app without error: checkbox present and checked by default, login
  succeeds and issues a real session cookie whether checked or unchecked, and
  an unremembered session works immediately for authenticated API calls.

### Mobile responsiveness

The UI was originally built once, desktop-only, per the reference design
(Section 0 of `plan.md` calls it a desktop screenshot). Every screen is now
responsive from ~360px phone widths up through desktop, Tailwind
`sm`/`md`/`lg` breakpoints throughout:

- **Product table → cards on mobile.** The 10-column grid table is
  unreadable squeezed onto a phone, so below the `md` breakpoint the table is
  replaced with one card per product (name, barcode, the three prices, the
  colored quantity badge, date/time, and full-width إجراءات buttons) built
  from the same data. The desktop grid table remains exactly as before at
  `md` and up (also gained an `overflow-x-auto` safety net so it scrolls
  instead of ever forcing page-level horizontal scroll in the awkward
  tablet range). The two views use **different `data-testid`s**
  (`product-row` vs. `product-row-mobile`) specifically so the existing
  desktop-scoped test suite keeps counting and asserting against exactly
  what it always did — nothing in the original 99 tests needed to change.
- **Top bar / bottom bar** compact on mobile: the decorative window-chrome
  dots and the copyright/version strip hide below `sm` (they're
  non-functional and the real content — brand, clock, logout, user, tabs —
  stays visible); logo, title, and clock shrink a step.
- **Search bar** stacks the search box full-width above the export/refresh
  buttons on mobile instead of forcing them onto one cramped row.
- **Sidebar (4 tabs + panel)** goes from a fixed 360px side column to full
  width, stacked *below* the table on mobile (`flex-col` under `lg`,
  `flex-row` at `lg` and up) — tab icons/labels shrink a step so all four
  still fit one row on a 360px-wide phone.
- **Pagination** row wraps and centers instead of overflowing when there are
  many page-number buttons; the redundant duplicate range label (originally
  shown on both sides of the pager for desktop symmetry) hides on mobile to
  save vertical space.
- **Global safety net:** `overflow-x: hidden` + `max-width: 100%` on
  `html, body`, plus an explicit `viewport` export in the root layout — no
  page can force horizontal scrolling regardless of what any individual
  component does.

**New test coverage (`e2e/mobile.spec.ts`, iPhone 12/13-sized 390×844
viewport):** no horizontal overflow on the home screen or after switching
through all four tabs; product table renders as cards (and the desktop grid
row is confirmed *hidden*, not just visually smaller); edit and delete work
from a mobile card; top bar and bottom bar render without overflow; the
barcode-scanner keystroke simulation still resolves correctly at mobile
width; the login page (including the تذكرني checkbox) fits and a full login
completes. Also visually spot-checked with real screenshots (login, home
with seeded products, scan tab, print tab) before deploying — the product
cards render cleanly with correctly colored quantity badges, nothing clips.

### Test results after this change

**113 tests, 100% pass: 67 unit/integration (vitest) + 46 e2e (Playwright).**
`next build` clean, zero TypeScript errors.

### Verified live on production

Deployed to https://warehouse-barcode-system.vercel.app and smoke-tested at
the actual mobile viewport against the real URL (not a local server):

```
login page overflow (mobile): { scrollW: 390, clientW: 390 }   ← no overflow
remember-me checked by default: true
home page overflow (mobile): { scrollW: 390, clientW: 390 }    ← no overflow
scan tab reachable on mobile: true
session cookie issued: true
```

---

## Scanner Fix — قارئ الباركود on Mobile

Reported: the barcode-reader tab "doesn't work on the phone." Investigated
root cause rather than guessing at a patch — the desktop implementation
relied entirely on a raw `onKeyDown` listener checking `e.key === "Enter"`,
with no other way to trigger a lookup. That design has three concrete,
well-documented mobile failure modes, all of which plausibly explain "does
nothing":

1. **Android IME composition swallows Enter.** Many Android on-screen
   keyboards (Gboard, Samsung Keyboard) don't reliably fire a clean
   `key === "Enter"` keydown when the keyboard's own Go/Search/Done action
   button is tapped — during IME composition the browser can see
   `key: "Unidentified"` or nothing at all reaches a plain `onKeyDown`
   listener. Since there was no other trigger, typing a barcode by hand on
   an Android phone could look completely dead.
2. **No numeric keypad.** The field showed a full QWERTY keyboard for a
   13-digit numeric barcode — slow and error-prone to type correctly.
3. **iOS Safari's focus-outside-a-gesture quirk.** The auto-focus-on-tab-
   mount ran inside a `useEffect`, not synchronously inside the tap that
   switched to the tab — Safari allows the DOM focus but not the on-screen
   keyboard popup in that case, so the field looked focused but nothing
   appeared to type into without an extra manual tap.

### What changed (`src/components/tabs/ScanTab.tsx`)

- The input now sits in a `<form>` with `onSubmit`, so **any** commit
  gesture — a real Enter keystroke, a mobile keyboard's action key, or the
  browser's own implicit single-field-form submission — reaches the same
  handler, sidestepping the raw-keydown IME issue entirely.
- Added a visible **"بحث" (search) button** next to the field — an explicit,
  always-reliable path that works regardless of any keyboard/IME quirk on
  any device.
- Added `inputMode="numeric"` + `pattern="[0-9]*"` + `enterKeyHint="search"`
  so phones show a numeric keypad instead of a full keyboard.
- Added a **debounced auto-lookup**: the moment the field holds exactly 13
  numeric digits (a complete EAN-13), it looks the product up on its own
  after a 200ms pause — no Enter, no button tap required at all. This
  specifically covers scanner/companion apps that inject text via paste or
  an accessibility service without ever sending a real Enter keystroke, and
  is generous enough (200ms) to never race a real trailing Enter, which
  arrives in low single-digit milliseconds after typing on both real
  hardware and in the automated tests.
- Desktop behavior (auto-focus, refocus-on-blur, refocus-on-any-tab-click —
  required by `plan.md` §8 for the always-focused hardware-scanner UX) is
  unchanged.

### Verification

**125 tests, 100% pass: 67 unit/integration + 58 e2e.** New coverage in
`e2e/scan-mobile.spec.ts` runs under **real mobile device emulation**
(iPhone 13 and Pixel 7 profiles — touch taps via `.tap()`, mobile viewport
and UA, not just a resized desktop browser) and specifically exercises the
failure modes above:

- Tap to focus → type → tap the بحث button, with **no Enter pressed at
  all** — finds the product.
- Type a complete 13-digit barcode and do **nothing else** — auto-lookup
  fires and finds the product (the exact "Enter never arrives" case).
- An unknown barcode via the بحث button shows the not-found state.
- The field carries `inputmode="numeric"` and `pattern="[0-9]*"`.
- An 11-digit (incomplete) string does *not* auto-fire.
- A real physical Enter keystroke still works (Bluetooth/USB scanners).
- No horizontal overflow on the scan tab at a real mobile viewport.
- All pre-existing scanner tests (desktop keydown-Enter simulation,
  rapid-scan sequencing, mid-scan abort guards) still pass unmodified.

### Verified live on production, against a real catalog item

Ran the same real-device-emulation smoke check directly against
https://warehouse-barcode-system.vercel.app using an actual product from
the live catalog ("جيلاتين نجمة العدد 12"):

```
inputmode attr: numeric
pattern attr: [0-9]*
enterkeyhint attr: search
PASS: tap+fill+بحث button found: جيلاتين نجمة العدد 12
PASS: auto-lookup with no Enter/button found: جيلاتين نجمة العدد 12
overflow check: { scrollWidth: 390, clientWidth: 390 } OK
```
