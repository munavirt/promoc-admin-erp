import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, BarChart3, Download, FileSpreadsheet, IndianRupee, Loader2, Receipt, RefreshCcw, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { financeApiService } from "@/services/api/finance.service";
import { FinanceFilterSelect, FinanceSectionCard, FinanceStatCard } from "../components/finance-form-shell";
import { FinanceGuard } from "../components/finance-guard";
import { InvoicePaymentBadge, PaymentStatusBadge } from "../components/finance-status";
import { MoneyDisplay } from "../components/money-display";
import { useFinanceCategories } from "../hooks/use-finance";
import { useAgencySettings } from "../hooks/use-finance-workspace";
import { useFinanceClients } from "../hooks/use-invoices-payments";
import { useFinancialReport } from "../hooks/use-reports";
import {
  BACKEND_PAYMENT_METHODS,
  REPORTS_WITH_PDF,
  paymentMethodLabel,
  type BackendPaymentMethod,
  type ExpenseReportDTO,
  type IncomeReportDTO,
  type OutstandingInvoicesReportDTO,
  type PaymentStatus,
  type PaymentsReportDTO,
  type ProfitLossReportDTO,
  type ReportKind,
  type ReportPeriod,
  type ReportQuery,
  type TaxSummaryReportDTO,
} from "../types/api-contracts";
import { formatFinanceDate } from "../utils/formatters";
import { saveDownloadedFile } from "../utils/save-file";

const TABS: { kind: ReportKind; label: string }[] = [
  { kind: "profit-loss", label: "Profit & Loss" },
  { kind: "income", label: "Income" },
  { kind: "expenses", label: "Expenses" },
  { kind: "outstanding-invoices", label: "Outstanding Invoices" },
  { kind: "payments", label: "Payments" },
  { kind: "tax-summary", label: "GST Summary" },
];

/** parse_report_date_range presets (finance/reports.py). */
const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "current_month", label: "Current month" },
  { value: "previous_month", label: "Previous month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "current_fy", label: "Current financial year" },
  { value: "previous_fy", label: "Previous financial year" },
  { value: "current_year", label: "Current calendar year" },
  { value: "custom", label: "Custom range" },
];

/** Which filters each report endpoint actually reads (unsupported ones are not offered). */
const SUPPORTS: Record<ReportKind, { period: boolean; method: boolean; client: boolean; category: "INCOME" | "EXPENSE" | null; status: boolean; vendor: boolean }> = {
  "profit-loss": { period: true, method: true, client: false, category: null, status: false, vendor: false },
  income: { period: true, method: true, client: true, category: "INCOME", status: false, vendor: false },
  expenses: { period: true, method: true, client: false, category: "EXPENSE", status: false, vendor: true },
  "outstanding-invoices": { period: false, method: false, client: true, category: null, status: false, vendor: false },
  payments: { period: true, method: true, client: true, category: null, status: true, vendor: false },
  "tax-summary": { period: true, method: false, client: true, category: null, status: false, vendor: false },
};

const m = (v: string | number) => <MoneyDisplay amount={Number(v)} showDecimals />;
const dateInputClass = "h-10 rounded-xl border border-border/70 bg-white px-3 text-[13px] text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10";

function Table({ head, rightFrom, children, empty }: { head: string[]; rightFrom: number; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto -mx-6">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border/60 bg-slate-50/80">
            {head.map((h, i) => (
              <th key={h} className={cn("h-10 px-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap", i >= rightFrom ? "text-right" : "text-left")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {empty ? (
            <tr><td colSpan={head.length} className="px-6 py-8 text-center text-[13px] text-muted-foreground">No records for the selected filters.</td></tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}
const td = "px-6 py-3";
const tdr = "px-6 py-3 text-right whitespace-nowrap tabular-nums";

function PeriodLine({ r }: { r: { period?: string; start_date?: string; end_date?: string } }) {
  if (!r.start_date) return null;
  return <p className="text-[12px] text-muted-foreground">{r.period} · {formatFinanceDate(r.start_date)} – {formatFinanceDate(r.end_date)}</p>;
}

/* ─── Report renderers (every figure comes from the response) ─── */

function ProfitLossView({ r }: { r: ProfitLossReportDTO }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FinanceStatCard label="Total income" value={m(r.total_income)} icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" sub={`${r.income_transaction_count} records`} />
        <FinanceStatCard label="Total expenses" value={m(r.total_expenses)} icon={TrendingDown} iconBg="bg-rose-50" iconColor="text-rose-600" sub={`${r.expense_transaction_count} records`} />
        <FinanceStatCard label={Number(r.net_profit) < 0 ? "Net loss" : "Net profit"} value={m(r.net_profit)} icon={IndianRupee} iconBg="bg-blue-50" iconColor="text-blue-600" sub={`Margin ${r.profit_margin_percentage}`} />
      </div>
      <p className="text-[12px] text-muted-foreground">{r.disclaimer} Client payments are counted once, through the income record the backend creates for each payment.</p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {[{ t: "Income by category", rows: r.income_by_category }, { t: "Expenses by category", rows: r.expenses_by_category }].map(({ t, rows }) => (
          <FinanceSectionCard key={t} title={t}>
            <Table head={["Category", "Records", "Amount", "Share"]} rightFrom={1} empty={rows.length === 0}>
              {rows.map((c) => (
                <tr key={`${c.category_id}-${c.category_name}`}><td className={td}>{c.category_name}</td><td className={tdr}>{c.transaction_count}</td><td className={tdr}>{m(c.amount)}</td><td className={tdr}>{c.percentage}</td></tr>
              ))}
            </Table>
          </FinanceSectionCard>
        ))}
      </div>
      <FinanceSectionCard title="Monthly comparison">
        <Table head={["Month", "Income", "Expenses", "Net"]} rightFrom={1} empty={r.monthly_comparison.length === 0}>
          {r.monthly_comparison.map((row) => (
            <tr key={row.month}><td className={td}>{row.month}</td><td className={tdr}>{m(row.income)}</td><td className={tdr}>{m(row.expenses)}</td><td className={cn(tdr, Number(row.net_profit) < 0 ? "text-rose-700" : "text-emerald-700")}>{m(row.net_profit)}</td></tr>
          ))}
        </Table>
      </FinanceSectionCard>
    </div>
  );
}

function BreakdownCards({ categories, methods, months }: { categories: { category_name: string; amount: string; count: number }[]; methods: { payment_method: string; payment_method_display: string; amount: string; count: number }[]; months: { month: string; amount: string; count: number }[] }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <FinanceSectionCard title="By category">
        <Table head={["Category", "Records", "Amount"]} rightFrom={1} empty={categories.length === 0}>
          {categories.map((c) => <tr key={c.category_name}><td className={td}>{c.category_name}</td><td className={tdr}>{c.count}</td><td className={tdr}>{m(c.amount)}</td></tr>)}
        </Table>
      </FinanceSectionCard>
      <FinanceSectionCard title="By payment method">
        <Table head={["Method", "Records", "Amount"]} rightFrom={1} empty={methods.length === 0}>
          {methods.map((r) => <tr key={r.payment_method}><td className={td}>{r.payment_method_display}</td><td className={tdr}>{r.count}</td><td className={tdr}>{m(r.amount)}</td></tr>)}
        </Table>
      </FinanceSectionCard>
      <FinanceSectionCard title="Monthly trend">
        <Table head={["Month", "Records", "Amount"]} rightFrom={1} empty={months.length === 0}>
          {months.map((r) => <tr key={r.month}><td className={td}>{r.month}</td><td className={tdr}>{r.count}</td><td className={tdr}>{m(r.amount)}</td></tr>)}
        </Table>
      </FinanceSectionCard>
    </div>
  );
}

function IncomeView({ r }: { r: IncomeReportDTO }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FinanceStatCard label="Total income received" value={m(r.total_received)} icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" sub={`${r.transaction_count} records`} />
        <FinanceStatCard label="Manual income" value={m(r.manual_income_total)} icon={Receipt} iconBg="bg-slate-100" iconColor="text-slate-600" sub={`${r.manual_income_count} records`} />
        <FinanceStatCard label="From client payments" value={m(r.payment_income_total)} icon={Wallet} iconBg="bg-blue-50" iconColor="text-blue-600" sub={`${r.payment_income_count} payments`} />
      </div>
      <BreakdownCards categories={r.category_breakdown} methods={r.payment_method_breakdown} months={r.monthly_trends} />
      <FinanceSectionCard title="Income records" subtitle={`${r.transactions.length} records in the period`}>
        <Table head={["Date", "Description", "Category", "Method", "Source", "Amount"]} rightFrom={5} empty={r.transactions.length === 0}>
          {r.transactions.map((t) => (
            <tr key={t.id}>
              <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatFinanceDate(t.received_date)}</td>
              <td className={td}><Link to={`/finance/income/${t.id}`} className="font-medium hover:text-primary">{t.description}</Link></td>
              <td className={cn(td, "text-muted-foreground")}>{t.category_name ?? "—"}</td>
              <td className={cn(td, "text-muted-foreground whitespace-nowrap")}>{paymentMethodLabel(t.payment_method)}</td>
              <td className={cn(td, "text-muted-foreground whitespace-nowrap")}>{t.is_payment_receipt ? `Payment ${t.payment_number}` : "Manual"}</td>
              <td className={tdr}>{m(t.amount)}</td>
            </tr>
          ))}
        </Table>
      </FinanceSectionCard>
    </div>
  );
}

function ExpenseView({ r }: { r: ExpenseReportDTO }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FinanceStatCard label="Total expenses" value={m(r.total_expenses)} icon={TrendingDown} iconBg="bg-rose-50" iconColor="text-rose-600" sub={`${r.transaction_count} records`} />
        <FinanceStatCard label="Vendors" value={String(r.vendor_summary.length)} icon={Receipt} iconBg="bg-slate-100" iconColor="text-slate-600" sub="with spend in the period" />
      </div>
      <BreakdownCards categories={r.category_breakdown} methods={r.payment_method_breakdown} months={r.monthly_trends} />
      <FinanceSectionCard title="Expense records" subtitle={`${r.transactions.length} records in the period`}>
        <Table head={["Date", "Description", "Vendor", "Category", "Method", "Amount"]} rightFrom={5} empty={r.transactions.length === 0}>
          {r.transactions.map((t) => (
            <tr key={t.id}>
              <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatFinanceDate(t.expense_date)}</td>
              <td className={td}><Link to={`/finance/expenses/${t.id}`} className="font-medium hover:text-primary">{t.description}</Link></td>
              <td className={cn(td, "text-muted-foreground")}>{t.vendor_name || "—"}</td>
              <td className={cn(td, "text-muted-foreground")}>{t.category_name ?? "—"}</td>
              <td className={cn(td, "text-muted-foreground whitespace-nowrap")}>{paymentMethodLabel(t.payment_method)}</td>
              <td className={tdr}>{m(t.amount)}</td>
            </tr>
          ))}
        </Table>
      </FinanceSectionCard>
    </div>
  );
}

function OutstandingView({ r }: { r: OutstandingInvoicesReportDTO }) {
  const open = r.invoices.filter((i) => Number(i.outstanding_amount) > 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <FinanceStatCard label="Total outstanding" value={m(r.total_outstanding_amount)} icon={AlertCircle} iconBg="bg-amber-50" iconColor="text-amber-600" sub={`${r.total_invoices_count} issued invoices`} />
        <FinanceStatCard label="Invoiced" value={m(r.total_invoiced_value)} icon={Receipt} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <FinanceStatCard label="Received" value={m(r.total_received_amount)} icon={Wallet} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <FinanceStatCard label="Overdue" value={m(r.overdue_invoices_amount)} icon={AlertCircle} iconBg="bg-rose-50" iconColor="text-rose-600" sub={`${r.overdue_invoices_count} invoices`} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <FinanceSectionCard title="Aging">
          <Table head={["Bucket", "Invoices", "Outstanding"]} rightFrom={1}>
            {r.aging_summary.map((b) => <tr key={b.bucket_key}><td className={td}>{b.label}</td><td className={tdr}>{b.count}</td><td className={tdr}>{m(b.amount)}</td></tr>)}
          </Table>
        </FinanceSectionCard>
        <FinanceSectionCard title="By client">
          <Table head={["Client", "Invoices", "Invoiced", "Paid", "Outstanding"]} rightFrom={1} empty={r.client_breakdown.length === 0}>
            {r.client_breakdown.map((c) => <tr key={c.client_id}><td className={td}>{c.client_name}</td><td className={tdr}>{c.invoice_count}</td><td className={tdr}>{m(c.invoiced_amount)}</td><td className={tdr}>{m(c.paid_amount)}</td><td className={tdr}>{m(c.outstanding_amount)}</td></tr>)}
          </Table>
        </FinanceSectionCard>
      </div>
      <FinanceSectionCard title="Issued invoices" subtitle={`${open.length} with a balance due · ${r.invoices.length} in total`}>
        <Table head={["Invoice", "Client", "Due", "Aging", "Status", "Total", "Paid", "Outstanding"]} rightFrom={5} empty={r.invoices.length === 0}>
          {r.invoices.map((i) => (
            <tr key={i.id}>
              <td className={cn(td, "font-mono text-[12px]")}><Link to={`/finance/invoices/${i.id}`} className="hover:text-primary">{i.invoice_number}</Link></td>
              <td className={td}>{i.client_name}</td>
              <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatFinanceDate(i.due_date ?? undefined)}</td>
              <td className={cn(td, "whitespace-nowrap", i.is_overdue ? "text-rose-700" : "text-muted-foreground")}>{i.aging_bucket}</td>
              <td className={td}><InvoicePaymentBadge status={i.payment_status} /></td>
              <td className={tdr}>{m(i.total_amount)}</td>
              <td className={tdr}>{m(i.total_paid)}</td>
              <td className={cn(tdr, "font-semibold")}>{m(i.outstanding_amount)}</td>
            </tr>
          ))}
        </Table>
      </FinanceSectionCard>
    </div>
  );
}

function PaymentsView({ r }: { r: PaymentsReportDTO }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <FinanceStatCard label="Confirmed payments" value={m(r.total_confirmed_amount)} icon={Wallet} iconBg="bg-emerald-50" iconColor="text-emerald-600" sub={`${r.total_confirmed_payments_count} payments`} />
        <FinanceStatCard label="Allocated" value={m(r.total_allocated_amount)} icon={Receipt} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <FinanceStatCard label="Unallocated (advances)" value={m(r.total_unallocated_amount)} icon={IndianRupee} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <FinanceStatCard label="Voided" value={m(r.total_voided_amount)} icon={AlertCircle} iconBg="bg-rose-50" iconColor="text-rose-600" sub={`${r.total_voided_payments_count} voided · ${r.total_reversed_allocations_count} reversed allocations`} />
      </div>
      <p className="text-[12px] text-muted-foreground">These are the same receipts that appear as payment income in the Income report — don't add the two together.</p>
      <FinanceSectionCard title="By payment method">
        <Table head={["Method", "Payments", "Amount"]} rightFrom={1} empty={r.payment_method_breakdown.length === 0}>
          {r.payment_method_breakdown.map((x) => <tr key={x.payment_method}><td className={td}>{x.payment_method_display}</td><td className={tdr}>{x.count}</td><td className={tdr}>{m(x.amount)}</td></tr>)}
        </Table>
      </FinanceSectionCard>
      <FinanceSectionCard title="Payments" subtitle={`${r.payments.length} in the period`}>
        <Table head={["Payment", "Client", "Date", "Method", "Status", "Amount", "Allocated", "Unallocated"]} rightFrom={5} empty={r.payments.length === 0}>
          {r.payments.map((p) => (
            <tr key={p.id}>
              <td className={cn(td, "font-mono text-[12px]")}><Link to={`/finance/payments/${p.id}`} className="hover:text-primary">{p.payment_number}</Link></td>
              <td className={td}>{p.client_name}</td>
              <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatFinanceDate(p.payment_date)}</td>
              <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{paymentMethodLabel(p.payment_method)}</td>
              <td className={td}><PaymentStatusBadge status={p.status} /></td>
              <td className={tdr}>{m(p.amount)}</td>
              <td className={tdr}>{m(p.allocated_amount)}</td>
              <td className={tdr}>{m(p.unallocated_amount)}</td>
            </tr>
          ))}
        </Table>
      </FinanceSectionCard>
    </div>
  );
}

function TaxView({ r, gstNote }: { r: TaxSummaryReportDTO; gstNote: string | null }) {
  const j = r.jurisdiction_summary;
  return (
    <div className="space-y-6">
      {gstNote && <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-3.5 text-[13px] text-amber-900">{gstNote}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <FinanceStatCard label="Taxable value" value={m(r.total_taxable_value)} icon={Receipt} iconBg="bg-blue-50" iconColor="text-blue-600" sub={`${r.total_issued_invoices_count} issued invoices`} />
        <FinanceStatCard label="CGST" value={m(r.total_cgst)} icon={IndianRupee} iconBg="bg-slate-100" iconColor="text-slate-600" />
        <FinanceStatCard label="SGST" value={m(r.total_sgst)} icon={IndianRupee} iconBg="bg-slate-100" iconColor="text-slate-600" />
        <FinanceStatCard label="IGST" value={m(r.total_igst)} icon={IndianRupee} iconBg="bg-slate-100" iconColor="text-slate-600" />
        <FinanceStatCard label="Total GST" value={m(r.total_gst)} icon={BarChart3} iconBg="bg-emerald-50" iconColor="text-emerald-600" sub={`Invoice value ${Number(r.total_invoice_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
      </div>
      <p className="text-[12px] text-muted-foreground">{r.disclaimer}</p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <FinanceSectionCard title="Intra-state (CGST + SGST)">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <dt className="text-muted-foreground">Invoices</dt><dd className="text-right tabular-nums">{j.intra_state.count}</dd>
            <dt className="text-muted-foreground">Taxable value</dt><dd className="text-right">{m(j.intra_state.taxable_value)}</dd>
            <dt className="text-muted-foreground">CGST</dt><dd className="text-right">{m(j.intra_state.cgst)}</dd>
            <dt className="text-muted-foreground">SGST</dt><dd className="text-right">{m(j.intra_state.sgst)}</dd>
          </dl>
        </FinanceSectionCard>
        <FinanceSectionCard title="Inter-state (IGST)">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <dt className="text-muted-foreground">Invoices</dt><dd className="text-right tabular-nums">{j.inter_state.count}</dd>
            <dt className="text-muted-foreground">Taxable value</dt><dd className="text-right">{m(j.inter_state.taxable_value)}</dd>
            <dt className="text-muted-foreground">IGST</dt><dd className="text-right">{m(j.inter_state.igst)}</dd>
            <dt className="text-muted-foreground">Cancelled (excluded)</dt><dd className="text-right">{r.cancelled_invoices_excluded.count} · {m(r.cancelled_invoices_excluded.total_amount)}</dd>
          </dl>
        </FinanceSectionCard>
      </div>
      <FinanceSectionCard title="Issued invoices">
        <Table head={["Invoice", "Client", "State", "Date", "Taxable", "CGST", "SGST", "IGST", "GST", "Total"]} rightFrom={4} empty={r.invoices.length === 0}>
          {r.invoices.map((i) => (
            <tr key={i.id}>
              <td className={cn(td, "font-mono text-[12px]")}><Link to={`/finance/invoices/${i.id}`} className="hover:text-primary">{i.invoice_number}</Link></td>
              <td className={td}>{i.client_name}</td>
              <td className={cn(td, "text-muted-foreground")}>{i.client_state || "—"}</td>
              <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatFinanceDate(i.issue_date)}</td>
              <td className={tdr}>{m(i.taxable_amount)}</td><td className={tdr}>{m(i.cgst_amount)}</td><td className={tdr}>{m(i.sgst_amount)}</td><td className={tdr}>{m(i.igst_amount)}</td><td className={tdr}>{m(i.total_gst)}</td><td className={cn(tdr, "font-semibold")}>{m(i.total_amount)}</td>
            </tr>
          ))}
        </Table>
      </FinanceSectionCard>
    </div>
  );
}

/* ─── Page ─── */

function ReportsContent() {
  const [kind, setKind] = useState<ReportKind>("profit-loss");
  const [period, setPeriod] = useState<ReportPeriod>("current_fy");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [method, setMethod] = useState("ALL");
  const [client, setClient] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [vendor, setVendor] = useState("");
  const [exporting, setExporting] = useState<null | "csv" | "pdf">(null);

  const sup = SUPPORTS[kind];
  const clientsQuery = useFinanceClients();
  const categoriesQuery = useFinanceCategories(sup.category ?? undefined);
  const settingsQuery = useAgencySettings();

  const customIncomplete = (sup.period && period === "custom" && (!startDate || !endDate)) || (startDate && endDate && endDate < startDate);

  // Only the params the selected endpoint reads; the same object drives the JSON view and the exports.
  const query: ReportQuery = useMemo(() => {
    const q: ReportQuery = {};
    if (sup.period) {
      q.period = period;
      if (period === "custom") { q.start_date = startDate || undefined; q.end_date = endDate || undefined; }
    } else {
      // Outstanding report: optional issue-date window, no period presets.
      q.start_date = startDate || undefined;
      q.end_date = endDate || undefined;
    }
    if (sup.method && method !== "ALL") q.payment_method = method as BackendPaymentMethod;
    if (sup.client && client !== "ALL") q.client = client;
    if (sup.category && category !== "ALL") q.category = category;
    if (sup.status && status !== "ALL") q.status = status as PaymentStatus;
    if (sup.vendor && vendor.trim()) q.vendor = vendor.trim();
    return q;
  }, [sup, period, startDate, endDate, method, client, category, status, vendor]);

  const reportQuery = useFinancialReport(kind, query, !customIncomplete);
  const data = reportQuery.data;

  const doExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      saveDownloadedFile(await financeApiService.exportReport(kind, query, format));
    } catch (err) {
      toast.error(extractApiErrorMessage(err, `Could not export the ${format.toUpperCase()} file.`).message);
    } finally {
      setExporting(null);
    }
  };

  const settings = settingsQuery.data;
  const gstNote = settingsQuery.isLoading
    ? null
    : !settings
      ? "Agency settings are not configured, so GST is not applied to invoices. GST figures below come from the issued invoices' stored tax values."
      : !(settings.tax_enabled && settings.gst_registered)
        ? "GST is not active in Agency Settings. GST figures below come from the issued invoices' stored tax values."
        : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial Reports</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Cash-basis reports generated by the backend from saved records.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 gap-2 rounded-xl border-border/70" onClick={() => void doExport("csv")} disabled={Boolean(exporting) || Boolean(customIncomplete)}>
            {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Export CSV
          </Button>
          {REPORTS_WITH_PDF.has(kind) && (
            <Button variant="outline" className="h-10 gap-2 rounded-xl border-border/70" onClick={() => void doExport("pdf")} disabled={Boolean(exporting) || Boolean(customIncomplete)}>
              {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export PDF
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-border/70 bg-white p-1.5 shadow-sm" role="tablist">
        {TABS.map((t) => (
          <button key={t.kind} type="button" role="tab" aria-selected={kind === t.kind} onClick={() => { setKind(t.kind); setCategory("ALL"); }}
            className={cn("rounded-xl px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer", kind === t.kind ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-slate-50 hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 rounded-2xl border border-border/70 bg-white px-5 py-3.5 shadow-sm">
        {sup.period ? (
          <FinanceFilterSelect ariaLabel="Report period" value={period} onChange={(v) => setPeriod(v as ReportPeriod)} options={PERIODS} />
        ) : (
          <span className="text-[12px] text-muted-foreground">Issue date (optional)</span>
        )}
        {(!sup.period || period === "custom") && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <input type="date" aria-label="Start date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} className={dateInputClass} />
            <span>to</span>
            <input type="date" aria-label="End date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={dateInputClass} />
          </div>
        )}
        {sup.client && (
          <FinanceFilterSelect ariaLabel="Client" value={client} onChange={setClient}
            options={[{ label: "Client: All", value: "ALL" }, ...(clientsQuery.data ?? []).map((c) => ({ label: c.company_name, value: String(c.id) }))]} />
        )}
        {sup.category && (
          <FinanceFilterSelect ariaLabel="Category" value={category} onChange={setCategory}
            options={[{ label: "Category: All", value: "ALL" }, ...(categoriesQuery.data ?? []).map((c) => ({ label: c.name, value: String(c.id) }))]} />
        )}
        {sup.method && (
          <FinanceFilterSelect ariaLabel="Payment method" value={method} onChange={setMethod}
            options={[{ label: "Method: All", value: "ALL" }, ...BACKEND_PAYMENT_METHODS.map((x) => ({ label: paymentMethodLabel(x), value: x }))]} />
        )}
        {sup.status && (
          <FinanceFilterSelect ariaLabel="Payment status" value={status} onChange={setStatus}
            options={[{ label: "Status: All", value: "ALL" }, { label: "Confirmed", value: "CONFIRMED" }, { label: "Voided", value: "VOIDED" }]} />
        )}
        {sup.vendor && (
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor contains…" aria-label="Vendor"
            className="h-10 w-44 rounded-xl border border-border/70 bg-white px-3 text-[13px] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10" />
        )}
        {data && "start_date" in data && <div className="ml-auto"><PeriodLine r={data as { period?: string; start_date?: string; end_date?: string }} /></div>}
      </div>

      {customIncomplete ? (
        <div className="rounded-2xl border border-border/70 bg-white p-8 text-center text-[13px] text-muted-foreground shadow-sm">Choose a valid start and end date for the custom range.</div>
      ) : reportQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-secondary/60 animate-pulse" />)}</div>
          <div className="h-64 rounded-2xl bg-secondary/50 animate-pulse" />
        </div>
      ) : reportQuery.isError ? (
        <div className="rounded-2xl border border-border/70 bg-white p-10 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-2 h-7 w-7 text-red-400" />
          <p className="text-[14px] font-medium text-foreground">Unable to load the report</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{extractApiErrorMessage(reportQuery.error, "Please try again.").message}</p>
          <Button size="sm" variant="outline" className="mt-3 h-8 gap-1.5 text-xs" onClick={() => void reportQuery.refetch()}><RefreshCcw className="h-3.5 w-3.5" /> Retry</Button>
        </div>
      ) : data ? (
        <div className={cn("transition-opacity", reportQuery.isFetching && "opacity-70")}>
          {kind === "profit-loss" && <ProfitLossView r={data as ProfitLossReportDTO} />}
          {kind === "income" && <IncomeView r={data as IncomeReportDTO} />}
          {kind === "expenses" && <ExpenseView r={data as ExpenseReportDTO} />}
          {kind === "outstanding-invoices" && <OutstandingView r={data as OutstandingInvoicesReportDTO} />}
          {kind === "payments" && <PaymentsView r={data as PaymentsReportDTO} />}
          {kind === "tax-summary" && <TaxView r={data as TaxSummaryReportDTO} gstNote={gstNote} />}
        </div>
      ) : null}
    </div>
  );
}

export function FinancialReportsPage() {
  return (
    <AppLayout>
      <FinanceGuard>{() => <ReportsContent />}</FinanceGuard>
    </AppLayout>
  );
}
