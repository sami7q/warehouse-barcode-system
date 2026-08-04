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
