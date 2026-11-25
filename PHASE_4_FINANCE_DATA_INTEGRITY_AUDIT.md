# PromoCraft ERP — Phase 4 Finance Data Integrity Audit

Date: 2026-11-16 · Investigation only: **no frontend, backend or database changes were made**, and no finance records were created, modified or deleted.

---

## A. Executive Summary

**The frontend Finance module has never been connected to Django.** Every finance screen (Overview, Income, Expenses, their detail and form pages, Invoices, Payments, Reports, the Dashboard finance panel, and the Settings agency/finance panels) reads from and writes to a **browser-local demo ledger**. No finance code makes a single HTTP request.

- **What you see:** hard-coded seed records from `src/modules/finance/mock-data/finance.mock.ts`, persisted in the browser's `localStorage` under the key `promocraft_finance_state_v1`.
- **Income:** **8** seeded income records, which is exactly the 8 shown.
- **Expenses:** **12** seeded expense records, plus the **"tea"** record you created = **13** shown.
- **"tea" is not in the source code.** It was written by the mock adapter into your browser's `localStorage`. That's why it never reached Django: the form never sent a request.
- **Django is consistent with itself:**
  - The admin site and the API use the same single SQLite file, `promocraft-admin-backend/db.sqlite3`.
  - That file has **0** income records, **0** expense records and **0** finance categories.
  - Django Admin's "0 records" is correct.

**There is no "Phase 4 frontend API integration" in this codebase.**
- No finance HTTP service, adapter or report exists.
- No file in the frontend has changed since the Phase 3 report.
- The finance facade still reads `FINANCE_DATA_SOURCE = "demo"`.
- The Phase 1–3 reports list Finance as "still mock-backed / out of scope".

If an integration was done elsewhere (another session, branch or machine), it isn't in `promocraft-agency-hub/` on this machine.

The fault is entirely in the frontend. The backend is healthy for this question.

---

## B. Evidence

### B.1 Frontend data source (static trace of every rendered finance record)

| Screen | Component → hook → service | Service implementation | Network calls |
|---|---|---|---|
| Income list | `income-page.tsx` → `useIncomes()` → `incomeService.getAll()` | `mockIncomeService` → `financeMockDb.load().incomes` | **none** |
| Income detail | `income-detail-page.tsx` → `useIncome(id)` → `incomeService.getById` | `financeMockDb.load().incomes.find(...)` | **none** |
| Income create/edit | `income-form-page.tsx` → `useCreateIncome()` → `incomeService.create` | builds a record and calls `financeMockDb.save()` → **`localStorage.setItem("promocraft_finance_state_v1", …)`** | **none** |
| Expense list/detail/form | `expenses-page.tsx` / `expense-*-page.tsx` → `useExpenses()` / `useCreateExpense()` … | `mockExpenseService` → `financeMockDb` (same storage) | **none** |
| Finance Overview | `finance-overview-page.tsx` → `useFinanceOverview()` → `financeService.getOverview()` | `mockFinanceService.getOverview` **computes totals locally** from the demo ledger | **none** |
| Admin Dashboard finance panel | `dashboard-page.tsx` → `useOverviewSummary` / `useOverviewTrends` / `useFinanceReport` | `mockFinanceReportsService` (`reports.mock-adapter.ts`) | **none** |
| Reports page, Financial Reports | `Reports.tsx`, `financial-reports-page.tsx` | mock overview / `reports.mock-adapter.ts` | **none** (the only finance page with a "Demo data" notice) |
| Settings → agency / GST / finance permissions / audit trail | `finance-settings-panels.tsx`, `use-finance-workspace.ts` | `agency-settings.mock-adapter.ts` (`localStorage`, simulated `latency()`), `mockFinancePermissionsService` | **none** |

Wiring proof:
- `src/modules/finance/services/index.ts` exports `financeService = mockFinanceService`, `incomeService = mockIncomeService`, `expenseService = mockExpenseService` (likewise invoice, payment, directory, permissions, reports, agency settings) and `FINANCE_DATA_SOURCE = "demo"`.
- A search of `src/modules/finance/**` for `apiClient`, `axios` or `fetch(` finds **one** import: `extractApiErrorMessage` (an error-formatting helper) in `use-finance-workspace.ts`.
- `api-endpoints.ts` lists the Django paths, but **nothing calls them**.

Seed evidence (`mock-data/finance.mock.ts`):

| Example on screen | Location |
|---|---|
| "Stock Licensing Rebate & Partner Referral" | `MOCK_INCOMES` |
| "November Design System Support Retainer" | `MOCK_INCOMES` |
| "Client Hospitality & Courier Dispatch" | `MOCK_EXPENSES` |
| "Notion, Slack & Linear Workspace Licenses" | `MOCK_EXPENSES` |
| "tea" | **not in source** (user-created, `localStorage` only) |

| Seed array | Distinct ids | Shown in UI |
|---|---|---|
| `MOCK_INCOMES` (`inc-*`) | 8 | 8 |
| `MOCK_EXPENSES` (`exp-*`) | 12 | 13 (12 + "tea") |

The seed file also contains `MOCK_INVOICES`, `MOCK_PAYMENTS`, `MOCK_AUDIT_LOGS`, `MOCK_FINANCE_CLIENTS` and `MOCK_FINANCE_PROJECTS` (fake clients/projects, separate from the real ones integrated in Phase 2).

**Persistence behaviour** (`finance.mock-adapter.ts`, `FinanceMockDatabase`):
- `load()` reads `promocraft_finance_state_v1`. If it's absent, it **seeds from the mock arrays** and saves.
- So refreshing the browser **always restores the demo records**, and they survive restarts of both Django and Vite.
- Only clearing site data or "Reset demo data" changes them, and the reset **re-seeds** them.

### B.2 Requests (Investigation B)

| Question | Finding |
|---|---|
| Runtime API base URL | `VITE_API_BASE_URL=http://127.0.0.1:8000/api` (`.env.local`), used by `src/infrastructure/apiClient.ts`. **Finance doesn't use this client.** |
| Income / expense / overview endpoints used | **None.** The paths exist only as constants in `api-endpoints.ts`. |
| HTTP methods, JWT, interceptors, response transforms | Not applicable: no request is made, so no JWT is attached and no interceptor runs. |
| React Query | Queries resolve from the mock adapter (`queryFn: () => incomeService.getAll()`). There's no `initialData`/`placeholderData` with finance records. The records aren't stale cache: they're re-read from `localStorage` on every query. |
| Django routes exist and are protected | Live, unauthenticated `GET` (no data returned):<br>`/api/finance/income/` → **401**<br>`/api/finance/expenses/` → **401**<br>`/api/finance/overview/` → **401**<br>`/api/finance/overview/trends/` → **401**<br>`/api/finance/categories/` → **401** |
| Authenticated response counts | **NOT TESTED** (no admin credentials in this session). Expected 0, given B.3. |

Browser Network inspection was not performed: I can't drive your browser session. To confirm it yourself:
1. Open DevTools → Network on `/finance/income`, filter "finance". **No request to `127.0.0.1:8000/api/finance/…` appears.**
2. DevTools → Application → Local Storage → `http://localhost:3001` → `promocraft_finance_state_v1` contains the 8 incomes and 13 expenses, including "tea".

### B.3 Database (Investigation C, read-only `mode=ro` connection)

| Check | Result |
|---|---|
| DB configuration | `DATABASES.default.NAME = SQLITE_DB_PATH = os.getenv("SQLITE_DB_PATH", BASE_DIR/"db.sqlite3")`. One database; no `DATABASE_ROUTERS`. |
| `SQLITE_DB_PATH` set? | Not set in the environment; no backend `.env` file. So `promocraft-admin-backend/db.sqlite3`. |
| SQLite files in the workspace (excl. venv) | **1**: `promocraft-admin-backend/db.sqlite3` |
| Running server | Single process on :8000 (pid 64460), working directory `promocraft-admin-backend/`. The admin site and the API are the same process and database. |
| `finance_income_records` | **0** |
| `finance_expense_records` | **0** |
| `finance_categories` | **0** |
| invoices / invoice items / payments / allocations / sequences / bank-statement tables | all **0** |
| Admin registration | `IncomeRecordAdmin`, `ExpenseRecordAdmin` registered (`finance/admin.py`), so Django Admin's "0" is accurate. |

| Count | Income | Expense |
|---|---:|---:|
| Frontend | 8 | 13 |
| Django Admin | 0 | 0 |
| Database rows | 0 | 0 |
| API (authenticated) | NOT TESTED (expected 0) | NOT TESTED (expected 0) |

### B.4 Create workflow (Investigation D)

What happened when "tea" was saved:

1. The form submits (`expense-form-page.tsx`).
2. Client-side zod validation runs.
3. `useCreateExpense()` calls `expenseService.create(input, actor.name, actor.role)`.
4. That is `mockExpenseService.create`, which builds the record in memory.
5. `financeMockDb.save()` writes it to `localStorage`.
6. The hook invalidates `financeKeys.all`, and the list re-reads `localStorage`. A success toast is shown.

**No POST was sent, and no backend response or database row exists.** The success toast is a false confirmation: it reports a save that only happened in the browser.

The exact payload of your earlier attempt can't be recovered from network logs, because there was no request. The record itself can be inspected in `localStorage` (B.2 step 2).

### B.5 Finance Overview (Investigation E)

| Figure | Source today | Real backend source (not used) |
|---|---|---|
| Net cash movement | computed in `mockFinanceService.getOverview` from demo incomes + demo payments − demo expenses | `GET /api/finance/overview/` |
| Income received | sum of demo `incomes` + demo `payments` in range | same |
| Expenses paid | sum of demo `expenses` (Active) | same |
| Outstanding amount | from demo `invoices` | same |
| Income vs Expenses chart | monthly buckets of demo ledger | `GET /api/finance/overview/trends/` |
| Recent Financial Activity | demo ledger / demo audit log | `GET /api/finance/overview/recent-transactions/` |

Every figure is **derived locally from fabricated records**. None is fetched, and none can show an error state, because nothing can fail.

### B.6 Categories and pagination (Investigation F)

| Topic | Frontend | Backend |
|---|---|---|
| Category | **hard-coded string unions** (`IncomeCategory`, `ExpenseCategory` in `types/finance.types.ts`) | `IncomeRecord.category` / `ExpenseRecord.category` = **required FK to `FinanceCategory`** (type INCOME/EXPENSE). **The table is empty**, so no income or expense can be created through the API until at least one category exists. |
| Client / project | mock `MOCK_FINANCE_CLIENTS` / `MOCK_FINANCE_PROJECTS` with string ids | real integer ids (Phase 2) |
| Pagination | `paginate()` in `demo-store.ts` returns `count = results.length`, `next = null` (single fake page) | DRF PageNumberPagination, PAGE_SIZE 10 |
| Search / filters | filter the local array | server-side (not called) |

---

## C. Root Cause

**Mock data is being rendered: the Finance module was never integrated with the Django API.** The service facade is hard-wired to mock adapters that seed and persist a demo ledger in browser `localStorage`.

All the evidence points to this cause and no other:

| Candidate cause | Verdict | Evidence |
|---|---|---|
| Mock data still being rendered | **Confirmed: primary cause** | B.1: facade → mock adapters; seed-record and count match |
| Mock fallback after API failure | Not the cause | There's no API call to fail; the mock is the only path |
| Incorrect endpoint / base URL | Not the cause | Finance never uses the API client; the base URL is correct for other modules |
| Wrong database file | Ruled out | B.3: one DB file, one server, 0 rows, admin agrees |
| Stale React Query cache | Ruled out | Data is re-read from `localStorage` every time; it survives cache clears |
| Incorrect response parsing | Not applicable | No responses |
| Frontend optimistic updates | Contributing | Create "succeeds" against `localStorage` and shows a success toast with no server involved |
| Backend persistence failure | Ruled out | No request ever reached the backend |
| **Also found** | Process issue | The finance work believed to be "Phase 4 integration" doesn't exist in this codebase (no files changed since Phase 3; facade says `"demo"`) |

---

## D. File-level Findings

| File | Problem |
|---|---|
| `src/modules/finance/services/index.ts` | Binds every finance interface to mock adapters; `FINANCE_DATA_SOURCE = "demo"` |
| `src/modules/finance/services/finance.mock-adapter.ts` | Seeds and persists the demo ledger (`promocraft_finance_state_v1`); computes Overview locally; fake create/update/reverse; hard-coded actor fallback "Alex Morgan" |
| `src/modules/finance/mock-data/finance.mock.ts` | Source of the displayed incomes, expenses, invoices, payments, audit logs, clients and projects |
| `src/modules/finance/services/reports.mock-adapter.ts` | Dashboard/Reports overview, trends and reports from the demo ledger |
| `src/modules/finance/services/agency-settings.mock-adapter.ts`, `demo-store.ts` | Agency settings in `localStorage`, simulated latency, fake single-page pagination |
| `src/modules/finance/hooks/use-finance.ts`, `use-finance-workspace.ts` | Call only the mock services; success toasts on local-only writes |
| `src/modules/finance/pages/*` (overview, income, expense pages and forms, invoices, payments, reports) | Render mock data without a demo notice (except Financial Reports) |
| `src/features/dashboard/components/dashboard-page.tsx`, `src/pages/Reports.tsx`, `src/pages/Settings.tsx` | Show finance figures and settings from the mock services |
| `src/modules/finance/types/finance.types.ts` | Category as string union, string ids, camelCase fields: **doesn't match the backend contract** (category FK, `received_date`, `expense_date`, `payment_method` choices, integer ids) |
| `src/components/layout/sidebar.tsx`, `nav-config.ts` | Finance nav visibility comes from `mockFinancePermissionsService` (includes a frontend-only MANAGER role) |
| `src/mocks/persistence.ts` (`resetAllDemoData`) | "Reset demo data" re-seeds the finance demo ledger |

---

## E. Correction Plan (proposed — not yet implemented)

**Option 1. Immediate honesty fix (small; recommended right now).** Until the real integration exists:
- Show a clear, non-dismissable "Demo data — not saved to the server" notice on every finance page and on the Dashboard finance panel (the existing `DataSourceNotice` component).
- Make the Income/Expense create, edit and reverse success toasts say "Saved in this browser only (demo)". Or **disable those actions**, so nobody believes a record was stored.
- No data is deleted, and your `localStorage` record "tea" stays where it is.

**Option 2. The real Phase 4 integration for Income, Expenses and Overview** (what the acceptance criteria require). This is the same pattern as Phases 1–3:
- **New services:** `src/services/api/finance.service.ts` covering `GET /finance/categories/?type=`, income/expense list/detail/create/update (multipart for receipts), `/finance/overview/`, `/overview/trends/` and `/overview/recent-transactions/`.
- **Rewiring:** point `incomeService` / `expenseService` / `financeService` at it, and map the backend serializers to the existing UI types.
- **Remove mock usage:** delete the mock income/expense/overview paths from production rendering, with no fallback. Real loading, empty and error states.
- **Real categories:** category pickers from `/finance/categories/` (real FK ids); real clients/projects from Phase 2.
- **Server-side pagination**, search and filters.
- **Create → POST →** `invalidateQueries` **→ real GET**. No optimistic insert, and backend field errors shown on the inputs.
- **Dashboard finance panel** and Reports overview switched to the real overview endpoints.
- **Left on mock, labelled "Demo data":** invoices, payments, reports and settings (per your instruction not to integrate them yet).

**Decisions needed from you before Option 2 can pass acceptance:**

1. **Categories.** `finance_categories` is empty, and the backend **requires** a category on every income/expense. Someone must create at least one INCOME and one EXPENSE category (Django Admin or `POST /finance/categories/`). Under this audit's rules I won't create any.
2. **Test records.** Acceptance items 4–6 require creating one income and one expense in the real database. Please confirm I may create clearly labelled QA records (e.g. "QA Phase4 …"). Check the backend for whether they can be deleted afterwards; income/expense may only be reversible.
3. **Credentials.** As in Phases 1–3, an ADMIN login is needed to run the authenticated checks. You'd run a script from your own terminal.
4. **The browser's demo ledger.** After integration, `promocraft_finance_state_v1` would simply stop being read. I won't delete it unless you ask; you can clear it in DevTools.

### Acceptance criteria — current status

| # | Criterion | Status |
|---|---|---|
| 1 | Income list count = Django Admin = API | ❌ **FAIL**: UI 8 vs Admin 0 vs DB 0 (API authenticated count NOT TESTED) |
| 2 | Expense list count = Django Admin = API | ❌ **FAIL**: UI 13 vs Admin 0 vs DB 0 |
| 3 | Overview values from the real backend | ❌ **FAIL**: computed locally from demo records |
| 4 | Creating income persists in the DB | ❌ **FAIL**: no request is sent (by code trace; no new record created in this audit) |
| 5 | Creating expense persists in the DB | ❌ **FAIL**: "tea" exists only in `localStorage`; DB has 0 rows |
| 6 | New records appear after a real GET | ❌ **FAIL**: no GET exists |
| 7 | Browser refresh doesn't restore mock records | ❌ **FAIL**: `load()` re-seeds / re-reads `localStorage` |
| 8 | No silent demo fallback | ❌ **FAIL**: demo is the only source; no notice on most pages |
| 9 | Failed API requests show honest errors | ❌ **FAIL**: no API requests, so no error path |
| 10 | Existing real records not modified/deleted | ✅ **PASS for this audit**: read-only work only; DB finance tables unchanged at 0 rows; no frontend files changed |

**Phase 4 is not complete.** It hasn't actually been started in this codebase.

---

## F. Remaining Risks (not fixable from the frontend)

1. **No finance categories exist.** Income/expense creation through the API is impossible until they're created (backend data, your decision).
2. **Migration drift** (reported in Phase 1): `makemigrations --check` wanted to remove the bank-reconciliation models, but the tables still exist (`finance_bank_statement_*`, 0 rows) and the models are absent. Finance writes may hit inconsistencies, so this needs a backend owner decision before relying on finance in production.
3. **Contract mismatch.** The frontend finance types (category strings, camelCase, string ids, the MANAGER role, manager-permission flags) don't match the backend. The integration needs a mapping layer, and some UI features may have no backend equivalent; these will be reported when they come up.
4. **Demo data in users' browsers.** Anyone who used the finance pages has a local demo ledger. It'll stop being read after integration, but stays in their browser storage until cleared.
5. **Media/receipt files** for expenses would be served publicly by URL in DEBUG (same as work-item attachments, Phase 3).

---

**Backend files:** none modified. **Database:** read only (`mode=ro`). **Frontend:** no files changed by this audit (this report is the only new file).
