# PromoCraft ERP — Phase 5 Integration Report
## Invoices · Invoice Items & GST · Numbering · Invoice PDF · Payments · Allocations · Voiding · Financial Reports · CSV/PDF Exports

Date: 2026-11-16 · Scope: `promocraft-agency-hub/` only · Builds on Phase 4. Nothing committed, pushed or deployed.

---

## 1. Executive summary

**Status: implementation complete; type-check, lint, unit tests and production build pass. The unauthenticated live checks pass. Phase 5 is NOT declared complete:**
- The authenticated read-only live run has not been done yet (it needs your admin credentials).
- No write workflow (create, issue, pay, allocate, void, cancel) has been exercised live, because each one creates permanent financial records and needs your approval first (§26).

What's in place:
- The Invoices, Payments and Financial Reports pages no longer show "Not connected yet". They now use the Django API through the Phase 4 `apiClient` and the same JWT session.
- **Invoices:** list, create, draft edit, issue, cancel, delete draft, and an authenticated PDF download.
- **Payments:** list, record (with single, multiple or partial allocations, or an unallocated advance), allocate later, reverse an allocation, and void.
- **Reports:** all six backend reports (P&L, income, expenses, outstanding invoices, payments, GST summary), with the backend's CSV and PDF exports.
- **Calculations stay in the backend.** The browser never generates invoice numbers or payment references, and never calculates GST or totals. It never creates income records either.
- **No mock data.** No finance data is stored in the browser, and nothing falls back to demo data.

## 2. Documentation reviewed

| Document | Used for |
|---|---|
| `docs/README.md`, `docs/api-reference/complete-api-reference.md` | Endpoint list, invoice/payment/report request examples |
| `docs/openapi/openapi.yaml` | Schema cross-check |
| `docs/frontend-integration/endpoint-to-page-mapping.md` | Page ↔ endpoint mapping (several discrepancies, §27) |
| `docs/frontend-integration/api-client-specification.md`, `error-handling.md` | Re-used the Phase 4 `apiClient` and `ApiError` model unchanged |
| `docs/architecture/database-relationships.md`, `module-dependencies.md` | Invoice ↔ client, payment ↔ allocation ↔ invoice, payment ↔ income |

**Where the docs and the code disagreed, the backend source and the running API were followed (§27).**

## 3. Backend endpoints verified (source + running server)

All endpoints are `IsAuthenticated + IsAdmin`. Lists use DRF `PageNumberPagination`: `PAGE_SIZE` 10 and the `{count, next, previous, results}` envelope.

| Endpoint | Method | Notes (verified in `finance/api/views.py`, `serializers.py`, `services.py`, `reports.py`) |
|---|---|---|
| `/api/finance/invoices/` | GET | Filters: `search` (invoice_number, client company name, notes), `client`, `status` (DRAFT/ISSUED/CANCELLED), `payment_status` (UNPAID/PARTIALLY_PAID/PAID, annotated), `issue_date`, `start/end_issue_date`, `due_date`, `start/end_due_date`. Ordering: `issue_date`, `due_date`, `total_amount`, `created_at`, `status`. |
| `/api/finance/invoices/` | POST | Creates a **DRAFT**. The **invoice number is generated here** (`InvoiceSequence`, `PC/<FY>/<NNNN>`). Writable: `client`, `issue_date`, `due_date`, `client_state`, `client_gstin`, `notes`, `terms`, `items[]`. Blank `terms` → agency `default_invoice_terms`. |
| `/api/finance/invoices/{id}/` | GET / PATCH / DELETE | PATCH and DELETE work only on DRAFT; anything else returns 400. PATCH with `items` replaces every line item. |
| `/api/finance/invoices/{id}/issue/` | POST | DRAFT → ISSUED. Needs at least one item. Recalculates totals and freezes the agency and client snapshots. |
| `/api/finance/invoices/{id}/cancel/` | POST `{reason?}` | DRAFT or ISSUED → CANCELLED. Refused while any allocation is ACTIVE. The reason is appended to the notes. |
| `/api/finance/invoices/{id}/pdf/` | GET | `application/pdf`, `Content-Disposition: attachment; filename="Invoice-<sanitised number>.pdf"`. Works for any status. |
| `/api/finance/payments/` | GET | Filters: `search` (payment_number, reference_number, notes, client name), `client`, `status`, `payment_method`, `payment_date`, `start_date`, `end_date`, `has_unallocated`. Ordering: `payment_date`, `amount`, `created_at`. |
| `/api/finance/payments/` | POST | `client`, `amount`, `payment_date`, `payment_method`, `reference_number`, `notes`, `initial_allocations[{invoice, amount}]`. Generates `PAY/<FY>/<NNNN>` and **auto-creates one IncomeRecord**. |
| `/api/finance/payments/{id}/` | GET | (PATCH/PUT/DELETE exist but are deliberately not used, §16 and §27.) |
| `/api/finance/payments/{id}/void/` | POST `{reason}` (required) | Reverses all ACTIVE allocations, **deletes the linked IncomeRecord**, and marks the payment VOIDED. A second void returns 400. |
| `/api/finance/payments/{id}/allocate/` | POST `{invoice, amount}` | The invoice must be ISSUED and belong to the same client. Amount ≤ the payment's unallocated balance and ≤ the invoice's outstanding balance. |
| `/api/finance/payments/{id}/reverse-allocation/` | POST `{allocation_id, reason?}` | ACTIVE → REVERSED (history kept). |
| `/api/finance/allocations/` | GET | Read-only list; used only for the 401 check. |
| `/api/finance/reports/{profit-loss, income, expenses, outstanding-invoices, payments, tax-summary}/` | GET | `?export=csv` works on all six; **`?export=pdf` only on `profit-loss` and `tax-summary`**. |

**Report filters, as each report actually reads them:**
- **Periods** (`parse_report_date_range`): `current_month`, `previous_month`, `last_30_days` (the default), `last_90_days`, `current_fy`, `previous_fy`, `current_year`, `custom` (needs `start_date` and `end_date`).
- **P&L:** + `payment_method`.
- **Income:** + `category`, `payment_method`, `client`.
- **Expenses:** + `category`, `payment_method`, `vendor`.
- **Outstanding invoices:** `client`, `start_date`, `end_date` (issue-date window). **No period.**
- **Payments:** + `client`, `payment_method`, `status`.
- **GST summary:** + `client`.

## 4. Files inspected

**Backend (read only):**
- `finance/models.py`: Invoice, InvoiceItem, InvoiceSequence, Payment, PaymentAllocation, PaymentSequence, IncomeRecord, and the immutability querysets.
- `finance/api/{views,serializers,filters,urls}.py`
- `finance/services.py`: InvoiceCalculationService, InvoiceIssuanceService, PaymentService, `SUPPORTED_GST_RATES`, `normalize_state`.
- `finance/reports.py`, `finance/exports.py`
- `finance/pdf.py` (entry points only)
- `clients/models.py`, `project/settings.py` (pagination, CORS)

**Frontend:**
- The Phase 4 finance module: service, hooks, pages, components, types.
- `infrastructure/apiClient.ts`, `api/clients.api.ts`, `services/api/clients.service.ts`
- The admin routes and `nav-config.ts`

## 5. Files changed

| File | Change |
|---|---|
| `src/modules/finance/types/api-contracts.ts` | **Replaced** the stale report DTOs (their field names and `bank_account` fields didn't match the backend) with DTOs taken from `reports.py`. **Added** the invoice, item, payment, allocation and download types, `SUPPORTED_GST_RATES` and `REPORTS_WITH_PDF`. |
| `src/services/api/finance.service.ts` | **Extended** (the Phase 4 methods are unchanged): invoice CRUD and lifecycle, payments, allocations, reports, and authenticated binary downloads. Request bodies are built from a whitelist of writable fields. |
| `src/modules/finance/hooks/use-finance.ts` | ADMIN now gets the invoice, payment and allocation permissions. `useIncomes` gained an optional `enabled` flag. |
| **new** `src/modules/finance/hooks/use-invoices-payments.ts` | Invoice, payment, eligible-invoice and client hooks, plus the mutations. |
| **new** `src/modules/finance/hooks/use-reports.ts` | Report query hook. |
| **new** `src/modules/finance/utils/decimal.ts` | Exact decimal maths for form previews and validation (no floating point). |
| **new** `src/modules/finance/utils/save-file.ts` | Hands a file streamed from Django to the browser as a download. |
| **new** `src/modules/finance/components/finance-status.tsx` | Invoice status, payment status, payment and allocation badges. |
| **new** `src/modules/finance/components/confirm-action-dialog.tsx` | Confirmation dialog with consequences and an optional or required reason. Double submission is blocked. |
| **new** `src/modules/finance/components/finance-table-states.tsx` | Loading, error/retry, empty and detail-error states in the Phase 4 style. |
| `src/modules/finance/pages/invoices-page.tsx` | **Rewritten:** real list. |
| `src/modules/finance/pages/manual-invoice-form-page.tsx` | **Rewritten:** create and draft-edit form. `invoice-form-page.tsx` still re-exports it. |
| `src/modules/finance/pages/invoice-detail-page.tsx` | **Rewritten:** detail, lifecycle actions and PDF. |
| `src/modules/finance/pages/payments-page.tsx` | **Rewritten:** real list. |
| `src/modules/finance/pages/record-payment-form-page.tsx` | **Rewritten:** record payment with allocations. |
| `src/modules/finance/pages/payment-detail-page.tsx` | **Rewritten:** detail, allocate, reverse, void, and the linked income record. |
| `src/modules/finance/pages/financial-reports-page.tsx` | **Rewritten:** six reports, filters and exports. |
| **deleted** `src/modules/finance/components/finance-not-connected.tsx` | No longer used. |
| **new** `src/modules/finance/hooks/__tests__/phase5-invoices-payments-reports.test.ts` | 16 unit tests. |
| `package.json` | Test script now also runs the Phase 5 test file. |
| **new** `scripts/phase5-live.mjs` | Read-only live verification. |
| `.gitignore` | Ignores `scripts/phase5-live-results.json`. |

**Not changed:**
- The Phase 4 Income, Expense, Overview and Settings pages.
- The `apiClient` and the authentication code.
- The routes: `/finance/invoices`, `/new`, `/:id`, `/:id/edit`, `/finance/payments`, `/new`, `/:id` and `/finance/reports` already existed and are reused as they are.
- The navigation.

## 6. Invoice endpoints integrated

**List (`/finance/invoices`):**
- Search, client, status, payment status, issue-date range and sort are all applied by the server; pagination is the server's.
- Columns: Invoice number, Client, Issue and Due dates, Subtotal (taxable value), Tax (CGST + SGST + IGST from the row), Total, Paid, Outstanding, Status and Payment status. Outstanding shows "—" for drafts and cancelled invoices.
- Loading skeleton, error with retry, and filtered/unfiltered empty states.
- **No page-wide totals are calculated from the loaded page.**

**Create and edit (`/new`, `/:id/edit`):**
- **Client:** selected from the live Clients API, with loading, empty and error hints; no hard-coded clients and no automatic client creation. When editing, a draft whose client is no longer listed keeps that client selectable.
- **Client state and GSTIN:** captured on the invoice. Client records have neither field, and the backend uses `client_state` to choose CGST/SGST or IGST.
- **Dates:** issue date (which also decides the invoice-number financial year) and an optional due date, which must not be earlier than the issue date. Currency is shown read-only (INR, set by the backend).
- **Line items:** description, HSN/SAC, quantity, unit price, discount and GST rate, with add and remove; at least one item is required. Decimals are validated as exact 2-decimal strings and sent as strings. Item-level server errors (`items.N.field`) are mapped back onto the right input.
- **Notes and terms:** blank terms use the agency default (the backend does this).
- **Editing is offered only for DRAFT.** An issued or cancelled invoice shows a "can no longer be modified" message, and no PATCH is sent. Only changed fields are PATCHed; when items change, the full item list is sent, because the backend replaces all items.

**Detail (`/:id`):**
- Number, status and payment status, client, dates, and line items with the backend's per-line taxable amount, GST split and line total.
- Totals: subtotal, discount, taxable value, CGST, SGST, IGST, total, paid and outstanding.
- "Billed to": the frozen snapshot once issued, the live client while a draft.
- Payment history (allocations), notes and terms, created by, and created/updated/issued/cancelled timestamps.
- 404 shows "not found"; 403 shows "Access denied"; other errors offer a retry.

## 7. Payment endpoints integrated

**List:**
- Search, client, method, status, has-unallocated, payment-date range and sort are applied by the server, with server pagination.
- Columns: payment number (plus reference), client, date, method, related invoices (from active allocations), amount, unallocated balance and status.

**Record (`/new`):**
- Fields: client (live Clients API), amount, date, method (the backend's 7 values), optional reference and notes.
- **No bank account field.** The backend has none, and none is introduced.
- Eligible invoices (ISSUED, same client, outstanding greater than zero) are fetched fresh with the backend's `total_paid` and `outstanding_amount`. There's a "Refresh balances" button, and the list re-fetches automatically after a failed save.
- Allocation: per-invoice checkbox and amount, plus a "Max" button that fills min(outstanding, remaining payment).
- The UI checks each allocation against the invoice's outstanding balance and the total against the payment amount. It shows the allocated total and the remaining unallocated advance.
- `initial_allocations` is left out when nothing is selected (an advance payment).
- Arriving from an invoice's "Record Payment" button (`?client=&invoice=`) pre-selects that invoice.

**Detail:** number, status, client, amount, date, method, reference, notes, recorded by, timestamps, allocated and unallocated balances, and the full allocation history (active and reversed, with who and when). It also shows the income record linked to the payment (see §17).

## 8. Invoice PDF integration

- `GET /finance/invoices/{id}/pdf/` goes through the shared `apiClient`, so it gets the JWT header and the token refresh/replay.
- The response is read as an `arraybuffer`. The content type must start with `application/pdf`, otherwise the download is rejected.
- The file is saved as a Blob. The filename comes from `Content-Disposition` when it's readable; otherwise the backend's own scheme `Invoice-<sanitised number>.pdf` is used, because CORS doesn't expose that header to `:3001`.
- **Error bodies** arrive as bytes and are decoded back to JSON, so Django's `detail` message reaches the user. The button shows a spinner while downloading.
- **The PDF is always the backend file** rendered from the saved invoice. There's no browser-generated invoice. Drafts download a "Draft PDF".

## 9. Financial report endpoints integrated

`/finance/reports` has six tabs, and every figure is read from the backend response:
- **Profit & Loss:** income, expenses, net profit and margin, income and expense by category, and the monthly comparison. The disclaimer is shown, with a note that payment receipts count once.
- **Income:** total, count, manual income vs income from client payments, by category, by payment method, monthly trend, and the record list.
- **Expenses:** total, count, by category, by method, vendor count, monthly trend, and the record list.
- **Outstanding invoices:** total outstanding, invoiced, received, overdue, the aging buckets, the by-client breakdown, and the invoice list with backend `total_paid`, `outstanding_amount`, `payment_status` and aging.
- **Payments:** confirmed, allocated, unallocated and voided totals, reversed allocations, by method, and the payment list. A note says these are the same receipts as payment income, so the two shouldn't be added together.
- **GST summary:** taxable value, CGST, SGST, IGST and total GST, intra-state vs inter-state, cancelled invoices excluded, and the per-invoice rows. A notice appears when GST is inactive or agency settings are missing.

**Filters:** each tab offers only the filters its endpoint reads (§3). Changing a filter re-queries Django. A custom range must be complete and valid before anything is requested.

## 10. CSV/PDF export integration

- The **Export CSV** button is available on every report. **Export PDF** appears only on P&L and GST, the only reports the backend can render as PDF.
- Exports send exactly the same query as the on-screen report, plus `export=csv|pdf`. They're authenticated binary requests with content-type validation and Django's error messages preserved.
- Filenames follow the backend's names: `Profit-and-Loss-Report`, `Income-Report`, `Expense-Report`, `Outstanding-Invoices-Report`, `Payments-Report`, `GST-Tax-Summary-Report`, plus the `.csv` or `.pdf` extension.
- **No CSV or PDF is generated in the browser.**
- `phase5-live.mjs` E1 checks that the P&L CSV totals equal the JSON report.

## 11. Mock data removed

- The three "Not connected yet" placeholders and their component are gone.
- The sweep found no `MOCK_INVOICE`, `MOCK_PAYMENT` or `financeMockDb` references, and no `promocraft_finance_state_v1` reads.
- Finance code never writes finance data to `localStorage`; the only reference is the Phase 4 legacy-key deletion.
- No demo invoices or payments, no hard-coded totals, and no fallback to mock data. On failure the page shows an error with a retry.

## 12. Invoice lifecycle implementation

DRAFT → **Issue** (confirmation) → ISSUED. Either DRAFT or ISSUED → **Cancel** (confirmation, optional reason) → CANCELLED. Only a DRAFT can be **deleted** (confirmation).

**Issue:**
- The button is shown only for drafts, and is disabled while the draft has no line items.
- The dialog explains that the backend recalculates the totals, freezes the agency and client details, makes the invoice immutable (it can only be cancelled afterwards), and makes it available for payment allocation.

**Cancel:**
- Available for DRAFT or ISSUED.
- The button is disabled with an explanation while the invoice has active payment allocations, as the backend requires.

**Delete draft:**
- The dialog warns that the number already used from the sequence won't be reused.

**General rules:**
- Drafts are never issued automatically.
- Nothing is simulated or removed from local state: every action waits for Django, then the queries are invalidated.

## 13. Invoice numbering behavior

- The number is generated by Django **when the draft is created** (`InvoiceSequence.get_next_invoice_number`). The format is `PC/<FY>/<NNNN>`, for example `PC/2026-27/0001`. The financial year (April–March) comes from the **issue date**.
- The frontend never generates, predicts, increments or submits an invoice number. It always shows the number from the response; the whitelist strips one even if something tries to send it (unit-tested).
- Deleting a draft leaves a gap in the sequence, which is normal backend behavior and is explained in the delete dialog.
- Payments work the same way: `PAY/<FY>/<NNNN>`, generated by Django.

## 14. GST behavior

- **Calculation is entirely the backend's** (`InvoiceCalculationService`).
- **When GST applies:** only when Agency Settings has `tax_enabled` **and** `gst_registered`.
  - Client state equals the agency state (after `normalize_state`, so codes such as KL work) → CGST + SGST, each at half the rate.
  - Otherwise → IGST at the full rate.
  - Money is rounded half-up to 2 decimals per line.
- **What the form shows:**
  - When GST is active, the rate selector offers only `SUPPORTED_GST_RATES` (0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28%). Client state is required once any line has a rate above zero, the same rule as the backend.
  - When GST is inactive (no settings, not registered, or tax disabled), a banner explains why. Every line is fixed at 0% and the GST row reads "₹0.00 (not active)".
  - The form previews only quantity × price − discount (in exact decimal maths). The GST split and the total are labelled "calculated on save"; the saved figures appear on the detail page.
- **Issuing recalculates the totals** from the stored items and the *current* settings, and the detail page then shows the returned values.
- **The live database currently has 0 AgencySettings rows**, so GST is inactive. Issuing now would snapshot placeholder agency details ("PromoCraft Agency"), and the form warns about this.

## 15. Payment allocation behavior

**Supported and implemented:** single-invoice, multi-invoice and partial allocation; unallocated advance payments; allocating an advance later from the payment page; and reversing an individual allocation.

**UI checks** (feedback only; the backend re-validates everything):
- Each amount must be greater than 0, have at most 2 decimals, and not exceed the invoice's outstanding balance.
- The total must not exceed the payment amount.
- Only ISSUED invoices of the same client with an outstanding balance are offered.

**Backend errors** (client mismatch, balance changed in the meantime, …) are shown as returned, and the balances re-fetch.

Invoice paid and outstanding amounts are never calculated or edited in the browser; they're always re-fetched from Django.

## 16. Payment reversal/void behavior (verified in `PaymentService.void_payment`)

- **Void:** offered only for CONFIRMED payments, and a reason is required. The confirmation lists what will happen:
  - every active allocation is reversed, so the invoices' outstanding balances rise;
  - **the linked IncomeRecord is deleted**, so income, the overview and reports drop by the payment amount;
  - the action is permanent, and the voided payment is kept as an audit record that can't be reactivated.
- After a void there's no void button, and a second void is refused by the backend.
- **Reverse allocation:** offered for ACTIVE allocations of CONFIRMED payments, with an optional reason. The payment and its income record are unchanged.
- **Not exposed:** payment edit (PATCH doesn't re-sync the linked IncomeRecord, §27) and payment delete (voided payments are audit records).
- **No reversal or void has been run** on any payment (there are 0 in the database). Testing needs an approved QA payment (§26).

## 17. Payment-to-income integrity verification

**In the frontend:**
- Creating a payment is a **single POST** to `/finance/payments/`. No income request is made, which the unit test asserts.
- No compensating income is written on void.
- Payment-generated income can't be edited (Phase 4).
- The UI warns users not to also record a payment as income.
- The payment detail page shows the backend-generated income record found via `GET /finance/income/?search=<payment number>`, and flags more than one as an error.

**Live checks in `phase5-live.mjs`:**
- **F1 (database):** every CONFIRMED payment has exactly one IncomeRecord with the same amount, VOIDED payments have none, and no income record references a missing payment.
- **P3 (API):** the same through the API.
- **R1:** P&L income equals the database income sum, and payment income equals the confirmed payment total, so payments are counted only once.

**Current result:** F1 passes but has nothing to check (0 payments). P3 and R1 haven't run yet; they need your login.

## 18. Cache invalidation behavior

- All new query keys live under `["finance", …]`:
  - `["finance","invoices","list",params]`, `["finance","invoices","detail",id]`, `["finance","invoices","eligible",clientId]`
  - `["finance","payments","list",params]`, `["finance","payments","detail",id]`
  - `["finance","reports",kind,query]`
  - `["finance","clients"]`
- Every invoice and payment mutation runs the Phase 4 `invalidateFinance` **after Django confirms**: create, update, issue, cancel, delete, record, void, allocate and reverse.
- That re-fetches invoice lists and details, eligible balances, payments, income (including payment income), the Finance Overview, the Dashboard finance panel and every report.
- No optimistic updates. Eligible-invoice balances use `staleTime: 0`. A deleted draft's detail query is removed from the cache.

## 19. Permission handling

- The UI shows finance features only to ADMIN users (the `FinanceGuard` plus per-action permission checks), mirroring `IsAdmin` on every endpoint. **The backend remains the enforcement point.**
- 401 responses trigger the existing refresh-and-replay, then a session-expired logout. 403 renders "Access denied" on detail pages and an error with retry on lists.
- Credentials and tokens are never logged or stored beyond the existing `tokenStorage`.

## 20. TypeScript results

The check used `tsc --strict --noEmit` with a scratch config and TypeScript 5.9 plus `@types/react` installed **in the session scratchpad**; the project's `package.json` and dependencies are unchanged.

**Result: 4 errors in total, the same 4 pre-existing ones as the Phase 4 baseline** (`features/users/*` ×3 and `main.tsx`). **There are 0 errors in finance, the services and the new files.**

## 21. Build results

`npm run build` ✅ succeeds. The only warning is the pre-existing one about a chunk larger than 500 kB.

ESLint (the project rules without the prettier formatting plugin, with `typescript-eslint` from the scratchpad, since the project config imports a package that isn't installed) on `src/modules/finance` and `finance.service.ts`: **0 errors**, 4 pre-existing Phase 4 fast-refresh warnings.

## 22. Unit test results

`npm test` ✅ **73/73 pass**: the 57 existing tests plus **16 new Phase 5 tests**. The new tests check:
- **Invoices:** filters are sent to the server; creating an invoice sends only writable fields, as decimal strings, and strips smuggled fields such as `invoice_number`, `status` and `total_amount`; the lifecycle calls hit the right URLs and methods; immutability errors keep Django's message.
- **Invoice PDF:** the request is authenticated and returns a binary blob with the backend's filename scheme; a non-PDF response is rejected; Django's `detail` survives an error on a binary download.
- **Payments:** creating a payment is exactly one request, with no bank account and no income call; an advance payment leaves out `initial_allocations`; the void, allocate and reverse-allocation request bodies match the serializers.
- **Reports and exports:** only the given parameters are sent; exports keep the filters and add `export=…`; the filename falls back correctly and uses `Content-Disposition` when it's readable; a 400 on an export keeps the backend message.
- **Decimal helpers:** exact parsing and formatting, and half-up rounding (e.g. 1.50 × 0.33 → 0.50, 3 × 0.10 → 0.30 exactly).

## 23. Live backend verification results (`http://127.0.0.1:8000`, 2026-11-16)

Command: `node scripts/phase5-live.mjs` (no credentials).

| # | Check | Result |
|---|---|---|
| P0 | Backend reachable | ✅ PASS |
| P1 | SQLite opened read-only | ✅ PASS |
| S1 | Unauthenticated GET on invoice list, detail and PDF; payments; allocations; all 6 reports; P&L CSV export; GST PDF export → 401 | ✅ PASS (13/13) |
| F0 | Phase 4 records intact: Website Development ₹250,000.00 income, Tea ₹50.00 expense | ✅ PASS |
| F1 | Payment → income integrity | ✅ PASS (0 payments, nothing to check) |
| F2 | Allocation integrity | ✅ PASS (0 allocations, nothing to check) |
| — | CORS preflight from `http://localhost:3001` with `Authorization` | ✅ allowed (Content-Disposition isn't exposed, so the filename fallback is used) |
| A0, I1–I5, P1–P3, R1–R5, E1–E2, X1 | Authenticated read-only checks | ⏳ **NOT TESTED** (they need your admin credentials) |

Database snapshot (read-only): 0 invoices, 0 invoice items, 0 payments, 0 allocations, 1 income, 1 expense, 0 agency settings, 11 categories, 1 active client ("Promocraft").

**Authenticated read-only run:** start Django, then run this in your own terminal (the password isn't shown as you type):

```zsh
cd ~/Desktop/promocraft-admin/promocraft-agency-hub
read -r "E?Admin email: "; read -rs "P?Admin password: "; echo
PHASE5_EMAIL="$E" PHASE5_PASSWORD="$P" node scripts/phase5-live.mjs
unset E P
```

Optionally, set `PHASE5_NONADMIN_EMAIL` and `PHASE5_NONADMIN_PASSWORD` for an *existing* non-admin account to run X1 (it expects 403). The results go to `scripts/phase5-live-results.json`, which never contains credentials or tokens.

## 24. Financial integrity verification results

**Unit tests:**
- The frontend never sends invoice numbers, statuses or totals.
- It never creates income for a payment.
- Decimals are never converted to floats in requests.

**Live checks:**
- **Run and passed:** F0, F1 and F2. F1 and F2 had no records to examine.
- **Ready, waiting for the authenticated run:**
  - I2 and I3: invoice fields, totals and balances vs database allocations.
  - P2: payment balances.
  - R1–R5: P&L, income, expense, outstanding, payment and GST totals vs database sums.
  - E1: CSV totals vs JSON.

## 25. Failed tests

None. No check that actually ran has failed.

## 26. Untested workflows (NOT TESTED; your approval is needed)

None of these has been run live, because each one creates **permanent** records (issued invoices and payments can't be deleted through the API) and changes real totals:

1. Create a draft invoice; edit the draft; delete the draft.
2. Issue an invoice, check its number and immutability, and download the issued PDF.
3. GST: CGST/SGST vs IGST. This also needs Agency Settings configured with GST registered and tax enabled; there are currently 0 settings rows.
4. Record a payment: full, partial, multi-invoice and advance. Check that exactly one income record is created and that P&L and the overview increase once.
5. Allocate an advance later; reverse an allocation.
6. Void a payment: check the income record is deleted, the balances are restored, and the reports drop.
7. Cancel an invoice.
8. CSV/PDF export *contents* with real invoice and payment data.
9. **A logged-in browser walk-through of the pages.** The pages compile and are covered by unit tests, but I haven't viewed them while signed in.
10. A non-admin account being denied (X1).

**Proposed QA plan (only on your approval):**
- Create a draft "QA Phase 5 — do not use" for the existing client "Promocraft", with 1–2 lines.
- Issue it, record one partial payment allocated to it, then void the payment and cancel the invoice.

**Effects to accept:**
- It consumes `PC/2026-27/0001` and `PAY/2026-27/0001` (the **first** real numbers in this financial year).
- A cancelled invoice and a voided payment stay permanently.
- The income record is created and then deleted again by the void.

## 27. Unsupported backend features and discrepancies found

| # | Finding | Handling |
|---|---|---|
| 1 | Docs say invoice numbers are `INV/…` and assigned **on issue**. The backend assigns `PC/<FY>/<NNNN>` **when the draft is created**. | Followed the backend; the UI says so. |
| 2 | Docs list `PAID`/`PARTIALLY_PAID` as values of the invoice `status` filter. The backend `status` is only DRAFT/ISSUED/CANCELLED; payment state is the separate `payment_status` filter. | There are two separate filters. |
| 3 | Docs say every report supports `?export=pdf`. Only `profit-loss` and `tax-summary` do. | The PDF button is shown only for those two. |
| 4 | The outstanding-invoices report ignores `period`; it takes an optional issue-date range only. | Its tab shows date fields, not presets. |
| 5 | Payment PATCH/PUT is allowed for date, method, reference and notes, but **doesn't update the linked IncomeRecord**, so the two can drift. | **Payment editing isn't exposed.** Backend owner should fix this. |
| 6 | Payment DELETE is blocked only for CONFIRMED payments, so a **VOIDED** payment can be hard-deleted through the API, losing the audit record. | Not exposed. Backend owner should fix this. |
| 7 | Issuing recalculates totals using the *current* agency settings. A draft saved while GST was inactive gets GST added on issue if GST is enabled before issuing, and vice versa. | The issue dialog says totals are recalculated; the detail page shows the result. |
| 8 | Without AgencySettings, issuing snapshots placeholder agency details ("PromoCraft Agency", no address or GSTIN) permanently. | The form shows a warning. You may want to configure Settings before the first real issue. |
| 9 | Clients have no state or GSTIN fields. | Captured per invoice (`client_state`, `client_gstin`). |
| 10 | CORS doesn't expose `Content-Disposition`. | Filenames mirror the backend's scheme. |
| 11 | `PaymentService.create_payment` puts payment income in the "Service Revenue" category, and would create that category if it were missing (it exists: id 1). | Informational. |
| 12 | The earlier frontend report DTOs (`by_bank_account`, `status_counts`, `total_tax_collected`, …) didn't match the backend. | Replaced. |
| — | Not supported by the backend, so not built: invoice PUT; un-cancelling or un-issuing; payment un-void; bank accounts (out of scope and absent). | — |

## 28. Remaining limitations

1. Write workflows and GST splits haven't been verified live (§26).
2. GST is effectively off until Agency Settings exist and have `gst_registered` and `tax_enabled` set.
3. A draft's GST preview isn't calculated in the browser by design; the backend's figures appear after saving.
4. The payment allocation picker loads all of a client's issued invoices (every page). That's fine at agency scale but not optimised for thousands of invoices.
5. The linked-income lookup on a payment uses income search by payment number, because the backend has no `?payment=` filter.
6. Report tables show the full itemised lists the backend returns; there's no client-side pagination.
7. The Dashboard "New invoice" tile hidden in Phase 4 hasn't been restored. That's a separate UI change, not needed for this integration.

## 29. Backend files

**No backend files were modified.** No Django source, models, serializers, views, URLs, migrations, settings or database contents were changed, and no migrations were run.

## 30. Existing finance records

**No finance records were created, modified or deleted.** Every database access used `mode=ro` or `readOnly: true`, and every HTTP request I made was a GET or a CORS preflight; there was no login. The Phase 4 records are confirmed unchanged by F0:
- Website Development: ₹250,000.00 income
- Tea: ₹50.00 expense

The database still has 0 invoices, 0 payments and 0 allocations.
