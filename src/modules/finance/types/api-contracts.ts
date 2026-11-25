/**
 * Backend API contracts (Django REST Framework).
 *
 * These types mirror the JSON returned by the PromoCraft Django backend verbatim —
 * snake_case keys, decimal values serialised as strings, upper-case enum codes.
 * Sources: STAGE_2_1 (agency settings), STAGE_2_4 (overview trends),
 * STAGE_3_3 (financial reports) API documentation.
 *
 * Keep these aligned with the backend. UI code converts decimals with `toAmount()`
 * only for display; totals are taken from the response, never re-summed in React.
 */

/** A decimal serialised by DRF, e.g. "50000.00". */
export type Decimal = string;

/** Standard DRF PageNumberPagination envelope. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type BackendPaymentMethod =
  | "BANK_TRANSFER"
  | "UPI"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "CHEQUE"
  | "CASH"
  | "OTHER";

/* ─── Agency settings — /api/settings/ ─────────────────────────────────── */

export interface AgencySettingsDTO {
  id: number;
  agency_name: string;
  legal_name: string;
  email: string;
  phone: string;
  website: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  pan: string;
  gst_registered: boolean;
  gstin: string;
  tax_enabled: boolean;
  default_currency: "INR";
  default_invoice_terms: string;
  created_at: string;
  updated_at: string;
}

export type AgencySettingsPatch = Partial<Omit<AgencySettingsDTO, "id" | "created_at" | "updated_at">>;

/* ─── Overview trends — /api/finance/overview/trends/ ──────────────────── */

export type OverviewPeriod = "7d" | "30d" | "3m" | "6m" | "1y" | "this_month" | "this_year" | "custom";

export interface OverviewQuery {
  period: OverviewPeriod;
  start_date?: string;
  end_date?: string;
  grouping?: "day" | "month";
}

export interface OverviewSummaryDTO {
  total_income: Decimal;
  total_expenses: Decimal;
  net_cash_flow: Decimal;
  income_transaction_count: number;
  expense_transaction_count: number;
  total_transaction_count: number;
  selected_period: OverviewPeriod;
  period_start: string;
  period_end: string;
}

export interface TrendPointDTO {
  /** `YYYY-MM-DD` for day grouping, `YYYY-MM` for month grouping. */
  period: string;
  income: Decimal;
  expenses: Decimal;
  net_cash_flow: Decimal;
}

export interface OverviewTrendsDTO {
  period: OverviewPeriod;
  grouping: "day" | "month";
  period_start: string;
  period_end: string;
  results: TrendPointDTO[];
}

/* ─── Phase 5: financial reports — /api/finance/reports/* (finance/reports.py FinancialReportService) ──
 * Field names verified against the running backend; the earlier draft DTOs (bank-account breakdowns,
 * by_category/by_vendor, status_counts…) did not match it and were removed. */

/** parse_report_date_range — note these differ from the overview presets. Default: last_30_days. */
export type ReportPeriod =
  | "current_month"
  | "previous_month"
  | "last_30_days"
  | "last_90_days"
  | "current_fy"
  | "previous_fy"
  | "current_year"
  | "custom";

export type ReportKind = "profit-loss" | "income" | "expenses" | "outstanding-invoices" | "payments" | "tax-summary";

/** Only these report endpoints honour `?export=pdf`; every report honours `?export=csv`. */
export const REPORTS_WITH_PDF: ReadonlySet<ReportKind> = new Set<ReportKind>(["profit-loss", "tax-summary"]);

/** Query params accepted by the report endpoints. Unsupported params are ignored by Django, but we only send what each report reads. */
export interface ReportQuery {
  period?: ReportPeriod;
  start_date?: string;
  end_date?: string;
  payment_method?: BackendPaymentMethod;
  client?: number | string;
  category?: number | string;
  vendor?: string;
  status?: PaymentStatus;
}

export interface PLCategoryRowDTO {
  category_id: number | null;
  category_name: string;
  amount: Decimal;
  transaction_count: number;
  percentage: string;
}

export interface ProfitLossReportDTO {
  report_name: string;
  disclaimer: string;
  period: string;
  start_date: string;
  end_date: string;
  total_income: Decimal;
  income_transaction_count: number;
  total_expenses: Decimal;
  expense_transaction_count: number;
  net_profit: Decimal;
  profit_margin_percentage: string;
  income_by_category: PLCategoryRowDTO[];
  expenses_by_category: PLCategoryRowDTO[];
  monthly_comparison: Array<{ month: string; income: Decimal; expenses: Decimal; net_profit: Decimal }>;
}

export interface ReportCategoryRowDTO { category_id: number | null; category_name: string; amount: Decimal; count: number }
export interface ReportMethodRowDTO { payment_method: BackendPaymentMethod; payment_method_display: string; amount: Decimal; count: number }
export interface ReportMonthRowDTO { month: string; amount: Decimal; count: number }

export interface IncomeReportDTO {
  period: string;
  start_date: string;
  end_date: string;
  total_received: Decimal;
  transaction_count: number;
  manual_income_total: Decimal;
  manual_income_count: number;
  payment_income_total: Decimal;
  payment_income_count: number;
  category_breakdown: ReportCategoryRowDTO[];
  payment_method_breakdown: ReportMethodRowDTO[];
  monthly_trends: ReportMonthRowDTO[];
  transactions: Array<{
    id: number;
    received_date: string;
    description: string;
    category_name: string | null;
    amount: Decimal;
    payment_method: BackendPaymentMethod;
    reference_number: string;
    is_payment_receipt: boolean;
    payment_number: string | null;
    client_name: string | null;
  }>;
}

export interface ExpenseReportDTO {
  period: string;
  start_date: string;
  end_date: string;
  total_expenses: Decimal;
  transaction_count: number;
  category_breakdown: ReportCategoryRowDTO[];
  payment_method_breakdown: ReportMethodRowDTO[];
  vendor_summary: Array<{ vendor_name: string; amount: Decimal; count: number }>;
  monthly_trends: ReportMonthRowDTO[];
  transactions: Array<{
    id: number;
    expense_date: string;
    description: string;
    category_name: string | null;
    vendor_name: string;
    amount: Decimal;
    payment_method: BackendPaymentMethod;
    reference_number: string;
    has_receipt: boolean;
  }>;
}

export interface OutstandingInvoicesReportDTO {
  total_invoices_count: number;
  total_invoiced_value: Decimal;
  total_received_amount: Decimal;
  total_outstanding_amount: Decimal;
  unpaid_invoices_count: number;
  unpaid_invoices_amount: Decimal;
  partially_paid_invoices_count: number;
  partially_paid_invoices_amount: Decimal;
  paid_invoices_count: number;
  paid_invoices_amount: Decimal;
  overdue_invoices_count: number;
  overdue_invoices_amount: Decimal;
  aging_summary: Array<{ bucket_key: string; label: string; count: number; amount: Decimal }>;
  client_breakdown: Array<{
    client_id: string;
    client_name: string;
    invoiced_amount: Decimal;
    paid_amount: Decimal;
    outstanding_amount: Decimal;
    overdue_amount: Decimal;
    invoice_count: number;
  }>;
  invoices: Array<{
    id: number;
    invoice_number: string;
    client_id: string;
    client_name: string;
    issue_date: string;
    due_date: string | null;
    total_amount: Decimal;
    total_paid: Decimal;
    outstanding_amount: Decimal;
    payment_status: InvoicePaymentStatus;
    days_overdue: number;
    is_overdue: boolean;
    aging_bucket: string;
  }>;
}

export interface PaymentsReportDTO {
  period: string;
  start_date: string;
  end_date: string;
  total_confirmed_payments_count: number;
  total_confirmed_amount: Decimal;
  total_voided_payments_count: number;
  total_voided_amount: Decimal;
  total_allocated_amount: Decimal;
  total_unallocated_amount: Decimal;
  total_reversed_allocations_count: number;
  total_reversed_amount: Decimal;
  payment_method_breakdown: ReportMethodRowDTO[];
  payments: Array<{
    id: string;
    payment_number: string;
    client_id: string;
    client_name: string;
    payment_date: string;
    payment_method: BackendPaymentMethod;
    reference_number: string;
    notes: string;
    amount: Decimal;
    allocated_amount: Decimal;
    unallocated_amount: Decimal;
    status: PaymentStatus;
    voided_at: string | null;
    void_reason: string;
    allocations: Array<{ id: string; invoice_number: string; allocated_amount: Decimal; status: AllocationStatus; allocated_at: string; reversed_at: string | null; reversal_reason: string }>;
  }>;
}

export interface TaxSummaryReportDTO {
  report_name: string;
  disclaimer: string;
  period: string;
  start_date: string;
  end_date: string;
  total_issued_invoices_count: number;
  total_taxable_value: Decimal;
  total_cgst: Decimal;
  total_sgst: Decimal;
  total_igst: Decimal;
  total_gst: Decimal;
  total_invoice_value: Decimal;
  jurisdiction_summary: {
    intra_state: { count: number; taxable_value: Decimal; cgst: Decimal; sgst: Decimal; total_gst: Decimal };
    inter_state: { count: number; taxable_value: Decimal; igst: Decimal; total_gst: Decimal };
  };
  cancelled_invoices_excluded: { count: number; taxable_value: Decimal; gst_amount: Decimal; total_amount: Decimal };
  invoices: Array<{
    id: number;
    invoice_number: string;
    client_name: string;
    client_state: string;
    client_gstin: string;
    issue_date: string;
    taxable_amount: Decimal;
    cgst_amount: Decimal;
    sgst_amount: Decimal;
    igst_amount: Decimal;
    total_gst: Decimal;
    total_amount: Decimal;
  }>;
}

export interface ReportDTOMap {
  "profit-loss": ProfitLossReportDTO;
  income: IncomeReportDTO;
  expenses: ExpenseReportDTO;
  "outstanding-invoices": OutstandingInvoicesReportDTO;
  payments: PaymentsReportDTO;
  "tax-summary": TaxSummaryReportDTO;
}

/* ─── Phase 5: invoices — /api/finance/invoices/ (InvoiceSerializer) ───────────────── */

export type InvoiceStatus = "DRAFT" | "ISSUED" | "CANCELLED";
export type InvoicePaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

/** finance/services.py SUPPORTED_GST_RATES — any other rate is rejected by the backend. */
export const SUPPORTED_GST_RATES = ["0.00", "0.10", "0.25", "1.50", "3.00", "5.00", "12.00", "18.00", "28.00"] as const;

export interface InvoiceItemDTO {
  id: number;
  description: string;
  hsn_sac: string;
  quantity: Decimal;
  unit_price: Decimal;
  discount_amount: Decimal;
  taxable_amount: Decimal;
  gst_rate: Decimal;
  cgst_amount: Decimal;
  sgst_amount: Decimal;
  igst_amount: Decimal;
  line_total: Decimal;
  created_at: string;
  updated_at: string;
}

export interface InvoicePaymentHistoryDTO {
  allocation_id: string;
  payment_id: string;
  payment_number: string;
  payment_date: string;
  payment_method: BackendPaymentMethod;
  allocated_amount: Decimal;
  allocated_at: string;
  created_by_name: string | null;
}

export interface InvoiceDTO {
  id: number;
  client: number;
  client_name: string;
  created_by: string;
  created_by_name: string;
  /** Generated by Django when the DRAFT is created (InvoiceSequence, e.g. PC/2026-27/0001). */
  invoice_number: string;
  status: InvoiceStatus;
  payment_status: InvoicePaymentStatus;
  issue_date: string;
  due_date: string | null;
  currency: string;
  subtotal: Decimal;
  discount_amount: Decimal;
  taxable_amount: Decimal;
  cgst_amount: Decimal;
  sgst_amount: Decimal;
  igst_amount: Decimal;
  total_amount: Decimal;
  total_paid: Decimal;
  outstanding_amount: Decimal;
  client_state: string;
  client_gstin: string;
  notes: string;
  terms: string;
  agency_snapshot: Record<string, unknown>;
  client_snapshot: Record<string, unknown>;
  payment_instructions_snapshot: Record<string, unknown>;
  issued_at: string | null;
  cancelled_at: string | null;
  items: InvoiceItemDTO[];
  payment_history: InvoicePaymentHistoryDTO[];
  created_at: string;
  updated_at: string;
}

/** Writable item fields; totals are always computed by InvoiceCalculationService. */
export interface InvoiceItemWrite {
  description: string;
  hsn_sac?: string;
  quantity: Decimal;
  unit_price: Decimal;
  discount_amount?: Decimal;
  gst_rate?: Decimal;
}

/** Writable invoice fields. Status, number and totals are read-only. Only DRAFT invoices accept PATCH. */
export interface InvoiceWritePayload {
  client: number;
  issue_date: string;
  due_date?: string | null;
  client_state?: string;
  client_gstin?: string;
  notes?: string;
  terms?: string;
  /** When present, replaces every line item (sync_invoice_items). */
  items?: InvoiceItemWrite[];
}

export interface InvoiceListParams {
  page?: number;
  search?: string;
  client?: number | string;
  status?: InvoiceStatus;
  payment_status?: InvoicePaymentStatus;
  start_issue_date?: string;
  end_issue_date?: string;
  start_due_date?: string;
  end_due_date?: string;
  /** issue_date | due_date | total_amount | created_at | status (prefix "-" for desc) */
  ordering?: string;
}

/* ─── Phase 5: payments — /api/finance/payments/ (PaymentSerializer) ───────────────── */

export type PaymentStatus = "CONFIRMED" | "VOIDED";
export type AllocationStatus = "ACTIVE" | "REVERSED";

export interface PaymentAllocationDTO {
  id: string;
  payment: string;
  payment_number: string;
  invoice: number;
  invoice_number: string;
  allocated_amount: Decimal;
  status: AllocationStatus;
  allocated_at: string;
  created_by: string;
  created_by_name: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  reversed_by_name: string | null;
  reversal_reason: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentDTO {
  id: string;
  /** Generated by Django (PaymentSequence, e.g. PAY/2026-27/0001). */
  payment_number: string;
  client: number;
  client_name: string;
  amount: Decimal;
  payment_date: string;
  payment_method: BackendPaymentMethod;
  reference_number: string;
  notes: string;
  status: PaymentStatus;
  voided_at: string | null;
  void_reason: string;
  created_by: string;
  created_by_name: string | null;
  allocated_amount: Decimal;
  unallocated_amount: Decimal;
  allocations: PaymentAllocationDTO[];
  created_at: string;
  updated_at: string;
}

/**
 * POST body. No bank account (out of product scope; the backend has none either).
 * Django creates the linked IncomeRecord itself — the frontend must never create one.
 */
export interface PaymentCreatePayload {
  client: number;
  amount: Decimal;
  payment_date: string;
  payment_method: BackendPaymentMethod;
  reference_number?: string;
  notes?: string;
  initial_allocations?: Array<{ invoice: number; amount: Decimal }>;
}

export interface PaymentListParams {
  page?: number;
  search?: string;
  client?: number | string;
  status?: PaymentStatus;
  payment_method?: BackendPaymentMethod;
  start_date?: string;
  end_date?: string;
  has_unallocated?: boolean;
  /** payment_date | amount | created_at */
  ordering?: string;
}

/** A file streamed by Django (invoice PDF, report CSV/PDF). */
export interface DownloadedFile {
  blob: Blob;
  filename: string;
  contentType: string;
}

/* ─── Phase 4: categories, income, expenses, overview extras (backend serializers) ── */

export const PAYMENT_METHOD_LABELS: Record<BackendPaymentMethod, string> = {
  BANK_TRANSFER: "Bank Transfer (NEFT/RTGS/IMPS)",
  UPI: "UPI",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  CHEQUE: "Cheque",
  CASH: "Cash",
  OTHER: "Other",
};
export const BACKEND_PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as BackendPaymentMethod[];
export const paymentMethodLabel = (m?: string | null) =>
  (m && (PAYMENT_METHOD_LABELS as Record<string, string>)[m]) || m || "—";

export type CategoryType = "INCOME" | "EXPENSE";

/** finance.api.serializers.FinanceCategorySerializer */
export interface FinanceCategoryDTO {
  id: number;
  name: string;
  type: CategoryType;
  description: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** finance.api.serializers.IncomeRecordSerializer */
export interface IncomeRecordDTO {
  id: number;
  category: number;
  category_name: string;
  created_by: string;
  created_by_name: string;
  description: string;
  amount: Decimal;
  received_date: string;
  payment_method: BackendPaymentMethod;
  reference_number: string;
  notes: string;
  /** Set when the income was generated by a client payment (read-only; such records cannot be edited). */
  payment: number | string | null;
  payment_number: string | null;
  is_payment_receipt: boolean;
  created_at: string;
  updated_at: string;
}

/** Writable IncomeRecord fields. amount: Decimal(12,2) > 0. */
export interface IncomeWritePayload {
  category: number;
  description: string;
  amount: Decimal;
  received_date: string;
  payment_method: BackendPaymentMethod;
  reference_number?: string;
  notes?: string;
}

/** finance.api.serializers.ExpenseRecordSerializer */
export interface ExpenseRecordDTO {
  id: number;
  category: number;
  category_name: string;
  created_by: string;
  created_by_name: string;
  description: string;
  amount: Decimal;
  expense_date: string;
  payment_method: BackendPaymentMethod;
  vendor_name: string;
  reference_number: string;
  /** URL of the stored receipt, or null. */
  receipt_file: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseWritePayload {
  category: number;
  description: string;
  amount: Decimal;
  expense_date: string;
  payment_method: BackendPaymentMethod;
  vendor_name?: string;
  reference_number?: string;
  notes?: string;
}

export interface FinanceListParams {
  page?: number;
  search?: string;
  category?: number | string;
  payment_method?: string;
  start_date?: string;
  end_date?: string;
  /** income: received_date | amount | created_at; expense: expense_date | amount | created_at */
  ordering?: string;
  vendor_name?: string;
}

/** GET /api/finance/overview/recent-transactions/ */
export interface RecentTransactionDTO {
  id: number;
  type: CategoryType;
  description: string;
  amount: Decimal;
  date: string;
  category: number;
  category_name: string;
  payment_method: BackendPaymentMethod;
  vendor_name: string | null;
  reference_number: string;
  created_at: string;
}
export interface RecentTransactionsDTO {
  count: number;
  limit: number;
  results: RecentTransactionDTO[];
}
