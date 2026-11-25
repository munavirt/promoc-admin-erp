# PromoCraft ERP — Phase 4 Finance Integration Report
## Agency Settings · Finance Categories · Income · Expenses · Finance Overview

Date: 2026-11-16 · Scope: `promocraft-agency-hub/` only · Builds on `PHASE_4_FINANCE_DATA_INTEGRITY_AUDIT.md`. Nothing committed, pushed or deployed.

> **Status: implementation complete; build, type-check and unit tests pass. Phase 4 is NOT declared complete: backend persistence hasn't been demonstrated yet.** Per your decision, you'll create one income and one expense through the new UI. Then run the read-only live verification (§8), which proves those rows exist in the database Django Admin reads and that the UI, API and DB agree.

---

## 1. What changed, in one paragraph

Finance no longer uses mock services or browser storage.
- **Live:** Agency Settings, Finance Categories, Income, Expenses and the Finance Overview (page + Dashboard finance panel) now use the authenticated `apiClient` against Django.
- **Removed:** the mock adapters, the seed records and the `promocraft_finance_state_v1` ledger. The ledger's keys are also deleted from the browser on load. **Records are not migrated.**
- **Out of scope:** Invoices, Payments and Financial Reports show an honest "Not connected yet" page instead of demo records.
- **Success messages** appear only after the backend returns the saved record.
- **Every finance write** invalidates all `["finance", …]` queries, so lists, details, overview and dashboard re-fetch from Django.

## 2. Backend contract (read-only inspection)

| Area | Endpoint | Notes |
|---|---|---|
| Agency settings | `GET/POST/PATCH /api/settings/` | Singleton. **GET returns 404 until configured.** POST creates once. Required: `agency_name`, `address_line_1`, `city`, `state`, `postal_code`. PAN/GSTIN regex; GSTIN required when `gst_registered`. ADMIN only. **DB currently has 0 rows.** |
| Categories | `GET /api/finance/categories/` | `?type`, `is_active`, `search`, `ordering`. DELETE = soft deactivate. **11 categories in DB** (ids 1–4 INCOME, 5–11 EXPENSE, all active). |
| Income | `GET/POST /api/finance/income/`, `GET/PATCH /{id}/` | Filters: `search` (description, reference, notes), `category`, `payment_method`, `received_date`, `start_date`, `end_date`; ordering `received_date` / `amount` / `created_at`. **No DELETE, no reverse.** Payment-generated income can't be edited. |
| Expenses | `GET/POST /api/finance/expenses/`, `GET/PATCH /{id}/` | Same, plus `vendor_name` filter. `receipt_file` multipart: ≤10 MB; pdf/png/jpg/jpeg/webp/doc/docx; magic-byte check. **No DELETE, no reverse.** |
| Overview | `GET /api/finance/overview/`, `/trends/`, `/recent-transactions/` | `period` = 7d, 30d, 3m, 6m, 1y, this_month, this_year, custom. Trends are `YYYY-MM` buckets for monthly grouping. Recent: `limit` ≤100, `type`. |
| Permissions | all of the above | `IsAuthenticated + IsAdmin` |

Validation on income and expense:
- amount must be greater than 0 (`Decimal(12,2)`);
- the category must match the record type (INCOME vs EXPENSE) and be active for new records.

## 3. Files changed

| File | Change |
|---|---|
| **new** `src/services/api/finance.service.ts` | Real service: settings (null on 404), categories (all pages), income/expense list/detail/create/PATCH (writable-field whitelist; expense receipt as multipart `FormData` with upload progress), overview summary/trends/recent. |
| `src/modules/finance/types/api-contracts.ts` | Added backend DTOs: `FinanceCategoryDTO`, `IncomeRecordDTO`/`IncomeWritePayload`, `ExpenseRecordDTO`/`ExpenseWritePayload`, `FinanceListParams`, `RecentTransactionDTO`, payment-method labels. The existing settings/overview DTOs already matched the serializers. |
| `src/modules/finance/hooks/use-finance.ts` | **Rewritten.** Real income, expense and category hooks. Permissions derived from the authenticated role (ADMIN only, matching `IsAdmin`). Reversal, invoice, payment and audit flags are off (no backend). |
| `src/modules/finance/hooks/use-finance-workspace.ts` | **Rewritten.** Real agency settings (get, create, update) and overview summary, trends and recent transactions. |
| `src/modules/finance/pages/income-page.tsx`, `expenses-page.tsx` | Server-side search, category (**real ids**) and payment-method filters, backend pagination (PAGE_SIZE 10), loading/error+retry/empty states. "Reverse" removed. |
| `src/modules/finance/pages/income-form-page.tsx`, `expense-form-page.tsx` | Same sections. Fields mapped to the serializers; amount kept as a decimal string; real category picker (active only, plus current on edit); backend field errors on inputs; edit PATCHes changed fields only. Expense receipt uploaded as multipart. |
| `src/modules/finance/pages/income-detail-page.tsx`, `expense-detail-page.tsx` | Real record, created/updated metadata, receipt download (expense), 404 vs error+retry. |
| `src/modules/finance/pages/finance-overview-page.tsx` | Real summary (this_year), trends chart (6m / 1y monthly) and recent activity, with error states. **"Outstanding" shows "—" (invoices not connected).** |
| `src/modules/finance/components/attachment-uploader.tsx` | Keeps the real `File` (no base64/localStorage). Backend receipt rules (10 MB, allowed extensions). |
| **new** `src/modules/finance/components/finance-not-connected.tsx` | "Not connected yet" page. |
| `src/modules/finance/pages/{invoices,invoice-detail,manual-invoice-form,payments,payment-detail,record-payment-form,financial-reports}-page.tsx` | Now render the not-connected page (no demo data, no integration). |
| **new** `src/modules/finance/utils/tax-ids.ts`, `utils/legacy-storage.ts` | PAN/GSTIN patterns (same as backend). Removal of the old finance `localStorage` keys. |
| `src/pages/Settings.tsx` | Real agency settings. **First-time setup form (POST)** when the API returns 404. Required business fields enforced; the frontend-only 6-digit PIN rule relaxed to the backend's ≤20 characters. Removed the mock Finance Permissions, Audit Trail and "invoice generator details" panels and the demo notice. |
| `src/features/dashboard/components/dashboard-page.tsx` | Financial snapshot uses the real overview. The mock outstanding-invoices highlight, invoice due dates, finance audit events and "New invoice" tile are removed. |
| `src/App.tsx` | Removes the legacy finance `localStorage` keys at start-up. |
| `src/mocks/persistence.ts`, `src/mocks/__tests__/erp-mock-services.test.ts` | Finance is no longer part of the demo reset. |
| `package.json` | Test script: removed the deleted finance mock test, added the Phase 4 test. |
| **new** `src/modules/finance/hooks/__tests__/phase4-finance-units.test.ts` | 9 unit tests. |
| **deleted** | `services/finance.mock-adapter.ts`, `reports.mock-adapter.ts`, `agency-settings.mock-adapter.ts`, `demo-store.ts`, `finance.interfaces.ts`, `contracts.interfaces.ts`, `index.ts`, `api-endpoints.ts`; `mock-data/finance.mock.ts`; `schemas/finance.schemas.ts`; `__tests__/finance-domain.test.ts`; components `finance-settings-panels`, `allocate-advance-dialog`, `expense-reverse-dialog`, `invoice-cancel-dialog`, `invoice-form-sections`, `invoice-pdf-dialog`, `finance-status-badge`, `finance-admin-guard`; utils `invoice-calculations`, `invoice-pdf`, `domain-rules`; `src/pages/Reports.tsx` (unrouted page with a hard-coded "+12.4%"). |

## 4. Field mapping and unsupported UI fields

| UI field | Backend | Status |
|---|---|---|
| Income title | `description` | mapped |
| Income amount | `amount` (decimal string) | mapped |
| Income category | `category` (FK id) | mapped; real categories |
| Payment date | `received_date` | mapped |
| Payment method (income/expense) | `payment_method` (BANK_TRANSFER, UPI, CREDIT_CARD, DEBIT_CARD, CHEQUE, CASH, OTHER) | mapped; the old 4 frontend labels were replaced by the 7 backend values |
| Reference | `reference_number` (≤100) | mapped |
| Notes | `notes` | mapped |
| Expense title / vendor / description | `description` / `vendor_name` / `notes` | mapped |
| Expense date | `expense_date` | mapped |
| Expense receipt | `receipt_file` (multipart) | mapped |
| Income **Client**, **Project**, **payment-proof attachment**; Expense **Project** | — | **Removed: no backend field.** Income list "Client" column replaced by "Payment Method". |
| "Transaction ID" codes (INC-…) | — | Replaced by the real record id (`#id`). |
| Reverse income/expense, Reversed status | — | **Removed: no backend endpoint.** |
| Finance audit trail, Manager role and permission policy | — | **Removed: no backend.** |
| Overview "% vs previous period", "Outstanding" | — | % removed; Outstanding shows "—" until Invoices are integrated. |

## 5. Verified — automated (no network)

| Check | Result |
|---|---|
| `npm run build` | ✅ success (pre-existing >500 kB chunk warning) |
| `tsc --strict --noEmit` (scratch config) | ✅ **4 errors in total, down from 25**, all pre-existing in `features/users/*` and `main.tsx`. **0 in finance, Settings, Dashboard and the services.** |
| ESLint (finance, Settings, Dashboard, services; formatting rules off) | ✅ **0 errors.** 8 warnings: pre-existing dashboard hook-dependency notes, plus dev-only fast-refresh warnings. |
| `npm test` | ✅ **57/57 pass** (the 11 mock-finance-domain tests were deleted with the mock code; 9 new Phase 4 tests). |
| Source sweep | ✅ No `MOCK_INCOMES`/`MOCK_EXPENSES`/`financeMockDb`/`promocraft_finance_state_v1` reads, seed record titles or simulated `latency()` remain in `src/`. `localStorage` appears in finance only in `utils/legacy-storage.ts` (deletion). |

The new Phase 4 unit tests check:
- **Settings:** a 404 maps to "not configured" (`null`); other errors propagate; create is POST and update is PATCH.
- **Categories:** filtered by type, with every page fetched.
- **Income:** filters are sent to the server; create sends only writable fields with the real category id, and decimals stay strings; update is PATCH.
- **Expenses:** JSON without a receipt; multipart `FormData` with `receipt_file` and no JSON content type when a receipt is attached.
- **Overview:** requests use the correct period parameters.
- **Legacy cleanup:** the old browser keys are removed.

## 6. Verified — live, against `http://127.0.0.1:8000`

| # | Check | Result |
|---|---|---|
| U1 | Unauthenticated `GET /finance/income/`, `/finance/overview/` → 401 (real frontend service via Vite SSR) | ✅ PASS |
| — | Unauthenticated `curl`: `/settings/`, `/finance/categories/`, `/finance/income/`, `/finance/expenses/`, `/finance/overview/`, `/overview/trends/`, `/overview/recent-transactions/` → all **401** | ✅ PASS |
| — | Read-only DB inspection: 11 categories (4 INCOME, 7 EXPENSE, all active); 0 income; 0 expenses; 0 agency settings | ✅ observed |

## 7. NOT yet verified (pending your UI records + the authenticated run)

| # | Acceptance criterion | Status | How it will be verified |
|---|---|---|---|
| 1 | Income list count = Django Admin = API | ⏳ NOT TESTED | L1 (API `count` vs DB row count) + M1 (every API record = identical DB row) |
| 2 | Expense list count = Django Admin = API | ⏳ NOT TESTED | L2 + M2 (incl. receipt) |
| 3 | Overview values from the real backend | ⏳ NOT TESTED live (✅ by code: no local calculation remains) | O1: `this_year` totals and net = DB sums; O2: trends + recent load |
| 4 | Creating income persists in the DB | ⏳ NOT TESTED | Your UI-created income must appear in M1 with an identical DB row |
| 5 | Creating expense persists in the DB | ⏳ NOT TESTED | Your UI-created expense (optionally with receipt) in M2 |
| 6 | New records appear after a real GET | ⏳ NOT TESTED | M1/M2 read via `GET /finance/income/`, `/expenses/`; the UI re-fetches after the save |
| 7 | Browser refresh doesn't restore mock records | ✅ by code (mock store deleted, legacy keys removed at start-up) · ⏳ browser check by you | Refresh `/finance/income`: only Django rows |
| 8 | No silent demo fallback | ✅ by code (no mock path exists; errors render error states) | — |
| 9 | Failed API requests show honest errors | ✅ by code + unit tests · ⏳ live UI check (e.g. stop Django → "Unable to load …" + Retry) | — |
| 10 | Existing real records not modified/deleted | ✅ this implementation: DB read-only (`mode=ro`); no finance writes | — |
| — | Validation rejected without persisting (empty, amount 0, wrong category type) | ⏳ NOT TESTED | V1, not in the read-only script (it POSTs). Check it manually in the UI: an invalid submit shows field errors, and the Income/Expense counts stay the same. |
| — | Agency settings | ⏳ NOT TESTED | S1 (read-only). Creating the singleton is your choice, via Settings → Agency profile (setup form). |
| — | Edit (PATCH) persists | ⏳ NOT TESTED (your UI edit, then rerun M1/M2) | — |

**How to verify:**
1. Restart nothing; Vite hot-reloads. Log in to `http://localhost:3001` as admin.
2. Finance → Income → **Add Income** (e.g. "QA Phase4 UI income"). Finance → Expenses → **Add Expense** (optionally attach a small PDF).
   ⚠️ These are permanent (the API has no delete), and they count in the Overview totals.
3. Check Django Admin → Income Records / Expense Records shows them.
4. Make sure Django is running on `http://127.0.0.1:8000`. Then, in your own terminal (password not echoed):
   ```zsh
   cd ~/Desktop/promocraft-admin/promocraft-agency-hub
   read -r "E?Admin email: "; read -rs "P?Admin password: "; echo
   PHASE4_EMAIL="$E" PHASE4_PASSWORD="$P" node scripts/phase4-live.mjs
   unset E P
   ```
   The script is read-only. It sends only GETs, plus one `POST /api/accounts/login/`. It opens SQLite with `readOnly: true`, and `PHASE4_CREATE_QA` is refused. It prints PASS/FAIL/SKIP per check (P0, P1, U1, A0, S1, C1, L1, M1, L2, M2, O1, O2) and saves `scripts/phase4-live-results.json`, which never contains credentials or tokens. Run it with no env vars to run only the unauthenticated checks.
   - **Dependencies:** none from npm. It needs Node ≥ 22.5 for built-in `fetch` and `node:sqlite`; it was checked on Node 24.15.
   - **Optional overrides:** `PHASE4_API_BASE`, `PHASE4_DB_PATH`, `PHASE4_MEDIA_DIR`.
   - **Exit codes:** 0 = all checks passed, 1 = at least one check failed, 2 = setup error.

   > **Note (2026-11-16):** the original script lived in a temporary scratchpad that was cleaned up, so it couldn't be moved. `scripts/phase4-live.mjs` was **rebuilt** from the checks documented in §6/§7. **V1 (validation rejection) was deliberately left out:** it POSTs to the finance endpoints, and if validation regressed it could create a permanent record. Unauthenticated run on 2026-11-16: P0, P1 and U1 ✅ PASS (7/7 endpoints → 401). DB snapshot: 11 categories, 1 income, 1 expense, 0 agency settings.

## 8. Remaining limitations

1. **No delete or reverse** for income/expenses in the API. Corrections are edits; removals need Django Admin.
2. **Agency settings are empty.** Until created (Settings setup form), GET returns 404. The UI shows the setup form, not an error.
3. **Outstanding amount, invoice due dates, payment-generated income and reports** need Invoices/Payments/Reports integration (later phase). The pages say so.
4. Income has **no client/project** link and no payment-proof file in the backend. Those UI fields were removed rather than faked.
5. Receipt files are served from `MEDIA_URL` **without authentication** (DEBUG static serving), same as task attachments.
6. **Migration drift** (audit F.2) is still present: `bank_account_id` columns exist on income/expense tables, and the bank models are gone. They're nullable, so inserts work, but a backend owner should resolve it. No bank UI was added.
7. Category management UI doesn't exist (categories are managed in Django Admin); the frontend only reads them.

## 9. Backend files

**No backend files were modified, and no migrations were run.** The database was only read, through `mode=ro` connections. **No finance, settings or category records were created, modified or deleted by me.** The legacy browser keys are removed only from the browser's own `localStorage`; nothing in Django is affected.
