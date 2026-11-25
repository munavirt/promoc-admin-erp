/**
 * Real Finance service — Django `finance` + `agency_settings` apps. Every endpoint is ADMIN-only (IsAdmin).
 *
 *   GET/POST/PATCH /settings/                      singleton (GET 404 until configured; POST creates once)
 *   GET   /finance/categories/                     ?type, is_active, search, ordering, page
 *   GET/POST /finance/income/                      ?page, search (description, reference_number, notes), category,
 *                                                  payment_method, received_date, start_date, end_date, ordering
 *   GET/PATCH /finance/income/{id}/                (no DELETE — preserved for audit)
 *   GET/POST /finance/expenses/                    + vendor_name filter; receipt_file via multipart
 *   GET/PATCH /finance/expenses/{id}/              (no DELETE)
 *   GET   /finance/overview/                       ?period | start_date & end_date
 *   GET   /finance/overview/trends/                ?period, grouping
 *   GET   /finance/overview/recent-transactions/   ?limit (≤100), type, period
 *
 * Phase 5 (verified against finance/api/views.py, serializers.py, services.py, reports.py):
 *   GET/POST /finance/invoices/                    ?page, search (invoice_number, client name, notes), client, status,
 *                                                  payment_status, start/end_issue_date, start/end_due_date, ordering
 *   GET/PATCH/DELETE /finance/invoices/{id}/       PATCH + DELETE only while DRAFT (400 otherwise)
 *   POST  /finance/invoices/{id}/issue/            DRAFT → ISSUED (snapshots frozen, totals recalculated)
 *   POST  /finance/invoices/{id}/cancel/           { reason? } — DRAFT/ISSUED without ACTIVE allocations
 *   GET   /finance/invoices/{id}/pdf/              application/pdf
 *   GET/POST /finance/payments/                    ?page, search, client, status, payment_method, start/end_date,
 *                                                  has_unallocated, ordering — POST auto-creates ONE IncomeRecord
 *   GET   /finance/payments/{id}/
 *   POST  /finance/payments/{id}/void/             { reason } — reverses allocations, DELETES the linked IncomeRecord
 *   POST  /finance/payments/{id}/allocate/         { invoice, amount }
 *   POST  /finance/payments/{id}/reverse-allocation/ { allocation_id, reason? }
 *   GET   /finance/reports/{kind}/                 ?period … ; ?export=csv (all) | ?export=pdf (profit-loss, tax-summary)
 *
 * Not used on purpose: payment PATCH/PUT (doesn't re-sync the linked IncomeRecord), payment DELETE (voided
 * payments are audit records), invoice PUT.
 */
import type { AxiosProgressEvent, AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios";
import type {
  AgencySettingsDTO,
  AgencySettingsPatch,
  CategoryType,
  DownloadedFile,
  ExpenseRecordDTO,
  ExpenseWritePayload,
  FinanceCategoryDTO,
  FinanceListParams,
  IncomeRecordDTO,
  IncomeWritePayload,
  InvoiceDTO,
  InvoiceListParams,
  InvoiceWritePayload,
  OverviewQuery,
  OverviewSummaryDTO,
  OverviewTrendsDTO,
  PaymentAllocationDTO,
  PaymentCreatePayload,
  PaymentDTO,
  PaymentListParams,
  RecentTransactionsDTO,
  ReportDTOMap,
  ReportKind,
  ReportQuery,
} from "@/modules/finance/types/api-contracts";
import { ApiError, apiClient, cleanParams, isPaginated, type Paginated } from "@/infrastructure/apiClient";

const MAX_PAGES = 100;

async function walk<T>(url: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<T[]> {
  const { data } = await apiClient.get<Paginated<T> | T[]>(url, { params: cleanParams(params), signal });
  if (!isPaginated<T>(data)) return Array.isArray(data) ? data : [];
  const all = [...data.results];
  let next = data.next;
  let pages = 1;
  while (next && pages < MAX_PAGES) {
    const res = await apiClient.get<Paginated<T>>(next, { signal });
    all.push(...res.data.results);
    next = res.data.next;
    pages += 1;
  }
  return all;
}

async function page<T>(url: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<Paginated<T>> {
  const { data } = await apiClient.get<Paginated<T> | T[]>(url, { params: cleanParams(params), signal });
  if (isPaginated<T>(data)) return data;
  const list = Array.isArray(data) ? data : [];
  return { count: list.length, next: null, previous: null, results: list };
}

const INCOME_FIELDS = ["category", "description", "amount", "received_date", "payment_method", "reference_number", "notes"] as const;
const EXPENSE_FIELDS = ["category", "description", "amount", "expense_date", "payment_method", "vendor_name", "reference_number", "notes"] as const;

function pick<T extends object>(payload: Partial<T>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = (payload as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** JSON body, or multipart when a receipt file is attached (no manual Content-Type: the browser sets the boundary). */
function expenseBody(payload: Partial<ExpenseWritePayload>, receipt?: File | null): Record<string, unknown> | FormData {
  const fields = pick(payload, EXPENSE_FIELDS);
  if (!receipt) return fields;
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, String(v ?? "")));
  form.append("receipt_file", receipt, receipt.name);
  return form;
}

const uploadOpts = (onProgress?: (f: number) => void) => ({
  timeout: 120000,
  onUploadProgress: (e: AxiosProgressEvent) => {
    if (onProgress && e.total) onProgress(Math.min(1, e.loaded / e.total));
  },
});

const INVOICE_FIELDS = ["client", "issue_date", "due_date", "client_state", "client_gstin", "notes", "terms", "items"] as const;
const INVOICE_ITEM_FIELDS = ["description", "hsn_sac", "quantity", "unit_price", "discount_amount", "gst_rate"] as const;
const PAYMENT_FIELDS = ["client", "amount", "payment_date", "payment_method", "reference_number", "notes", "initial_allocations"] as const;

function invoiceBody(payload: Partial<InvoiceWritePayload>): Record<string, unknown> {
  const body = pick(payload, INVOICE_FIELDS);
  if (payload.items) body.items = payload.items.map((it) => pick(it, INVOICE_ITEM_FIELDS));
  return body;
}

const id = (v: number | string) => encodeURIComponent(String(v));

/* ─── Binary downloads ─── */

/** Filenames Django sets in Content-Disposition (CORS doesn't expose that header cross-origin, so mirror them). */
export const REPORT_FILENAMES: Record<ReportKind, string> = {
  "profit-loss": "Profit-and-Loss-Report",
  income: "Income-Report",
  expenses: "Expense-Report",
  "outstanding-invoices": "Outstanding-Invoices-Report",
  payments: "Payments-Report",
  "tax-summary": "GST-Tax-Summary-Report",
};

export function invoicePdfFilename(invoiceNumber: string): string {
  return `Invoice-${invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
}

function filenameFromHeaders(headers: AxiosResponseHeaders | RawAxiosResponseHeaders | undefined): string | null {
  const raw = headers && (headers["content-disposition"] as string | undefined);
  if (!raw) return null;
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(raw);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Authenticated GET of a binary file through the shared apiClient (JWT header + refresh/replay).
 * Error bodies arrive as bytes; they are decoded back to JSON so ApiError keeps Django's `detail`.
 */
async function downloadFile(
  url: string,
  params: Record<string, unknown>,
  expect: "pdf" | "csv",
  fallbackName: string,
  signal?: AbortSignal,
): Promise<DownloadedFile> {
  const res = await apiClient.get<ArrayBuffer>(url, {
    params: cleanParams(params),
    signal,
    timeout: 60000,
    responseType: "arraybuffer",
    // DRF negotiates Accept against its renderers (JSON / browsable API) BEFORE the view runs; a bare
    // "application/pdf" or "text/csv" is answered 406 "Could not satisfy the request Accept header."
    // Listing application/json as a fallback lets negotiation succeed; the view's HttpResponse (PDF/CSV)
    // is returned untouched, and error bodies stay JSON. The content-type check below still enforces the file type.
    headers: { Accept: `${expect === "pdf" ? "application/pdf" : "text/csv"}, application/json;q=0.9` },
    transformResponse: [
      (data: unknown, _headers?: unknown, status?: number) => {
        if (status && status >= 400 && data instanceof ArrayBuffer) {
          const text = new TextDecoder().decode(data);
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        }
        return data;
      },
    ],
  });
  const contentType = String(res.headers["content-type"] || "");
  const expected = expect === "pdf" ? "application/pdf" : "text/csv";
  if (!contentType.toLowerCase().startsWith(expected)) {
    throw new ApiError(`The server returned ${contentType || "an unknown type"} instead of a ${expect.toUpperCase()} file.`, { kind: "server", status: res.status });
  }
  return {
    blob: new Blob([res.data], { type: contentType }),
    filename: filenameFromHeaders(res.headers) || fallbackName,
    contentType,
  };
}

export const financeApiService = {
  /* ─── Agency settings ─── */

  /** Returns null when the singleton has not been configured yet (backend answers 404). */
  async getAgencySettings(signal?: AbortSignal): Promise<AgencySettingsDTO | null> {
    try {
      const { data } = await apiClient.get<AgencySettingsDTO>("/settings/", { signal });
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
  async createAgencySettings(payload: AgencySettingsPatch): Promise<AgencySettingsDTO> {
    const { data } = await apiClient.post<AgencySettingsDTO>("/settings/", payload);
    return data;
  },
  async updateAgencySettings(patch: AgencySettingsPatch): Promise<AgencySettingsDTO> {
    const { data } = await apiClient.patch<AgencySettingsDTO>("/settings/", patch);
    return data;
  },

  /* ─── Categories ─── */
  listCategories(params: { type?: CategoryType; is_active?: boolean } = {}, signal?: AbortSignal): Promise<FinanceCategoryDTO[]> {
    return walk<FinanceCategoryDTO>("/finance/categories/", { ordering: "name", ...params }, signal);
  },

  /* ─── Income ─── */
  listIncome: (params: FinanceListParams = {}, signal?: AbortSignal) => page<IncomeRecordDTO>("/finance/income/", { ...params }, signal),
  async getIncome(id: number | string, signal?: AbortSignal): Promise<IncomeRecordDTO> {
    const { data } = await apiClient.get<IncomeRecordDTO>(`/finance/income/${encodeURIComponent(String(id))}/`, { signal });
    return data;
  },
  async createIncome(payload: IncomeWritePayload): Promise<IncomeRecordDTO> {
    const { data } = await apiClient.post<IncomeRecordDTO>("/finance/income/", pick(payload, INCOME_FIELDS));
    return data;
  },
  async updateIncome(id: number | string, payload: Partial<IncomeWritePayload>): Promise<IncomeRecordDTO> {
    const { data } = await apiClient.patch<IncomeRecordDTO>(`/finance/income/${encodeURIComponent(String(id))}/`, pick(payload, INCOME_FIELDS));
    return data;
  },

  /* ─── Expenses ─── */
  listExpenses: (params: FinanceListParams = {}, signal?: AbortSignal) => page<ExpenseRecordDTO>("/finance/expenses/", { ...params }, signal),
  async getExpense(id: number | string, signal?: AbortSignal): Promise<ExpenseRecordDTO> {
    const { data } = await apiClient.get<ExpenseRecordDTO>(`/finance/expenses/${encodeURIComponent(String(id))}/`, { signal });
    return data;
  },
  async createExpense(payload: ExpenseWritePayload, receipt?: File | null, onProgress?: (f: number) => void): Promise<ExpenseRecordDTO> {
    const { data } = await apiClient.post<ExpenseRecordDTO>("/finance/expenses/", expenseBody(payload, receipt), receipt ? uploadOpts(onProgress) : undefined);
    return data;
  },
  async updateExpense(id: number | string, payload: Partial<ExpenseWritePayload>, receipt?: File | null, onProgress?: (f: number) => void): Promise<ExpenseRecordDTO> {
    const { data } = await apiClient.patch<ExpenseRecordDTO>(
      `/finance/expenses/${encodeURIComponent(String(id))}/`,
      expenseBody(payload, receipt),
      receipt ? uploadOpts(onProgress) : undefined,
    );
    return data;
  },

  /* ─── Overview ─── */
  async getOverviewSummary(q: OverviewQuery, signal?: AbortSignal): Promise<OverviewSummaryDTO> {
    const { grouping: _g, ...params } = q;
    const { data } = await apiClient.get<OverviewSummaryDTO>("/finance/overview/", { params: cleanParams(params), signal });
    return data;
  },
  async getOverviewTrends(q: OverviewQuery, signal?: AbortSignal): Promise<OverviewTrendsDTO> {
    const { data } = await apiClient.get<OverviewTrendsDTO>("/finance/overview/trends/", { params: cleanParams({ ...q }), signal });
    return data;
  },
  async getRecentTransactions(params: { limit?: number; type?: CategoryType } = {}, signal?: AbortSignal): Promise<RecentTransactionsDTO> {
    const { data } = await apiClient.get<RecentTransactionsDTO>("/finance/overview/recent-transactions/", { params: cleanParams(params), signal });
    return data;
  },

  /* ─── Invoices (Phase 5) ─── */
  listInvoices: (params: InvoiceListParams = {}, signal?: AbortSignal) => page<InvoiceDTO>("/finance/invoices/", { ...params }, signal),
  /** Every invoice matching the filters (all pages) — used for the payment allocation picker. */
  listAllInvoices: (params: Omit<InvoiceListParams, "page"> = {}, signal?: AbortSignal) => walk<InvoiceDTO>("/finance/invoices/", { ...params }, signal),
  async getInvoice(invoiceId: number | string, signal?: AbortSignal): Promise<InvoiceDTO> {
    const { data } = await apiClient.get<InvoiceDTO>(`/finance/invoices/${id(invoiceId)}/`, { signal });
    return data;
  },
  /** Creates a DRAFT. Django assigns the invoice number and computes all totals. */
  async createInvoice(payload: InvoiceWritePayload): Promise<InvoiceDTO> {
    const { data } = await apiClient.post<InvoiceDTO>("/finance/invoices/", invoiceBody(payload));
    return data;
  },
  async updateInvoice(invoiceId: number | string, patch: Partial<InvoiceWritePayload>): Promise<InvoiceDTO> {
    const { data } = await apiClient.patch<InvoiceDTO>(`/finance/invoices/${id(invoiceId)}/`, invoiceBody(patch));
    return data;
  },
  async deleteDraftInvoice(invoiceId: number | string): Promise<void> {
    await apiClient.delete(`/finance/invoices/${id(invoiceId)}/`);
  },
  async issueInvoice(invoiceId: number | string): Promise<InvoiceDTO> {
    const { data } = await apiClient.post<InvoiceDTO>(`/finance/invoices/${id(invoiceId)}/issue/`, {});
    return data;
  },
  async cancelInvoice(invoiceId: number | string, reason?: string): Promise<InvoiceDTO> {
    const { data } = await apiClient.post<InvoiceDTO>(`/finance/invoices/${id(invoiceId)}/cancel/`, reason ? { reason } : {});
    return data;
  },
  downloadInvoicePdf(invoice: Pick<InvoiceDTO, "id" | "invoice_number">, signal?: AbortSignal): Promise<DownloadedFile> {
    return downloadFile(`/finance/invoices/${id(invoice.id)}/pdf/`, {}, "pdf", invoicePdfFilename(invoice.invoice_number), signal);
  },

  /* ─── Payments (Phase 5) ─── */
  listPayments: (params: PaymentListParams = {}, signal?: AbortSignal) => page<PaymentDTO>("/finance/payments/", { ...params }, signal),
  async getPayment(paymentId: string, signal?: AbortSignal): Promise<PaymentDTO> {
    const { data } = await apiClient.get<PaymentDTO>(`/finance/payments/${id(paymentId)}/`, { signal });
    return data;
  },
  /**
   * Django creates the linked IncomeRecord in the same transaction — never create income for a payment here.
   * Pass the same `idempotencyKey` for every attempt of one form submission: the backend then records
   * the payment at most once and replays the original on retries / double clicks.
   */
  async createPayment(payload: PaymentCreatePayload, options: { idempotencyKey?: string } = {}): Promise<PaymentDTO> {
    const body = pick(payload, PAYMENT_FIELDS);
    if (!payload.initial_allocations?.length) delete body.initial_allocations;
    const headers = options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : undefined;
    const { data } = await apiClient.post<PaymentDTO>("/finance/payments/", body, { headers });
    return data;
  },
  async voidPayment(paymentId: string, reason: string): Promise<PaymentDTO> {
    const { data } = await apiClient.post<PaymentDTO>(`/finance/payments/${id(paymentId)}/void/`, { reason });
    return data;
  },
  async allocatePayment(paymentId: string, invoiceId: number, amount: string): Promise<PaymentAllocationDTO> {
    const { data } = await apiClient.post<PaymentAllocationDTO>(`/finance/payments/${id(paymentId)}/allocate/`, { invoice: invoiceId, amount });
    return data;
  },
  async reverseAllocation(paymentId: string, allocationId: string, reason?: string): Promise<PaymentAllocationDTO> {
    const { data } = await apiClient.post<PaymentAllocationDTO>(`/finance/payments/${id(paymentId)}/reverse-allocation/`, {
      allocation_id: allocationId,
      ...(reason ? { reason } : {}),
    });
    return data;
  },

  /* ─── Financial reports (Phase 5) ─── */
  async getReport<K extends ReportKind>(kind: K, q: ReportQuery, signal?: AbortSignal): Promise<ReportDTOMap[K]> {
    const { data } = await apiClient.get<ReportDTOMap[K]>(`/finance/reports/${kind}/`, { params: cleanParams({ ...q }), signal });
    return data;
  },
  exportReport(kind: ReportKind, q: ReportQuery, format: "csv" | "pdf", signal?: AbortSignal): Promise<DownloadedFile> {
    return downloadFile(`/finance/reports/${kind}/`, { ...q, export: format }, format, `${REPORT_FILENAMES[kind]}.${format}`, signal);
  },
};
