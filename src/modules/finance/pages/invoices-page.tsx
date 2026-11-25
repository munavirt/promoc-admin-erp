import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, FileText, Pencil, Plus, Search, X } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FinanceFilterSelect } from "../components/finance-form-shell";
import { FinanceGuard } from "../components/finance-guard";
import { FinancePagination } from "../components/finance-pagination";
import { INVOICE_PAYMENT_STATUS_LABELS, INVOICE_STATUS_LABELS, InvoicePaymentBadge, InvoiceStatusBadge } from "../components/finance-status";
import { TableEmptyRow, TableErrorRow, TableLoadingRows } from "../components/finance-table-states";
import { MoneyDisplay } from "../components/money-display";
import { useFinanceClients, useInvoices } from "../hooks/use-invoices-payments";
import type { InvoiceListParams, InvoicePaymentStatus, InvoiceStatus } from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { centsToNumber, sumCents, toCents } from "../utils/decimal";
import { formatFinanceDate } from "../utils/formatters";

/** Backend PAGE_SIZE (REST_FRAMEWORK settings). */
const PAGE_SIZE = 10;
const COLS = 11;

const ORDERING_OPTIONS = [
  { label: "Newest first", value: "-created_at" },
  { label: "Issue date (newest)", value: "-issue_date" },
  { label: "Issue date (oldest)", value: "issue_date" },
  { label: "Due date (soonest)", value: "due_date" },
  { label: "Total (highest)", value: "-total_amount" },
  { label: "Total (lowest)", value: "total_amount" },
];

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const dateInputClass =
  "h-10 rounded-xl border border-border/70 bg-white px-3 text-[13px] text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10";

function InvoicesContent({ permissions }: { permissions: FinancePermissions }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim());
  const [clientFilter, setClientFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [payFilter, setPayFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [debouncedSearch, clientFilter, statusFilter, payFilter, fromDate, toDate, ordering]);

  // GET /api/finance/invoices/ — every filter, sort and page is applied by Django.
  const params: InvoiceListParams = {
    page,
    search: debouncedSearch || undefined,
    client: clientFilter !== "ALL" ? clientFilter : undefined,
    status: statusFilter !== "ALL" ? (statusFilter as InvoiceStatus) : undefined,
    payment_status: payFilter !== "ALL" ? (payFilter as InvoicePaymentStatus) : undefined,
    start_issue_date: fromDate || undefined,
    end_issue_date: toDate || undefined,
    ordering,
  };
  const listQuery = useInvoices(params);
  const clientsQuery = useFinanceClients();
  const invoices = listQuery.data?.results ?? [];
  const total = listQuery.data?.count ?? 0;

  const errStatus = (listQuery.error as { status?: number | null } | null)?.status;
  useEffect(() => {
    if (errStatus === 404 && page > 1) setPage((p) => p - 1);
  }, [errStatus, page]);

  const hasFilters = Boolean(search) || clientFilter !== "ALL" || statusFilter !== "ALL" || payFilter !== "ALL" || Boolean(fromDate) || Boolean(toDate);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Client invoices. Numbers, GST and totals are calculated by the backend.</p>
        </div>
        {permissions.canCreateInvoices && (
          <Button asChild className="h-10 gap-2 px-4 shadow-sm shadow-primary/20">
            <Link to="/finance/invoices/new">
              <Plus className="h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 rounded-2xl border border-border/70 bg-white px-5 py-3.5 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search invoices"
            placeholder="Search by invoice number, client or notes..."
            className="h-10 w-full rounded-xl border border-border/70 bg-white pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <FinanceFilterSelect
          ariaLabel="Filter by client"
          value={clientFilter}
          onChange={setClientFilter}
          options={[{ label: "Client: All", value: "ALL" }, ...(clientsQuery.data ?? []).map((c) => ({ label: c.company_name, value: String(c.id) }))]}
        />
        <FinanceFilterSelect
          ariaLabel="Filter by invoice status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[{ label: "Status: All", value: "ALL" }, ...Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ label, value }))]}
        />
        <FinanceFilterSelect
          ariaLabel="Filter by payment status"
          value={payFilter}
          onChange={setPayFilter}
          options={[{ label: "Payment: All", value: "ALL" }, ...Object.entries(INVOICE_PAYMENT_STATUS_LABELS).map(([value, label]) => ({ label, value }))]}
        />
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span>Issued</span>
          <input type="date" aria-label="Issue date from" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className={dateInputClass} />
          <span>to</span>
          <input type="date" aria-label="Issue date to" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className={dateInputClass} />
        </div>
        <FinanceFilterSelect ariaLabel="Sort invoices" value={ordering} onChange={setOrdering} options={ORDERING_OPTIONS} />
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setClientFilter("ALL");
              setStatusFilter("ALL");
              setPayFilter("ALL");
              setFromDate("");
              setToDate("");
            }}
            className="h-10 px-3 text-[12px] text-muted-foreground"
          >
            Reset
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
        <div className={cn("overflow-x-auto transition-opacity", listQuery.isFetching && !listQuery.isLoading && "opacity-70")}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/60 bg-slate-50/80">
                {["Invoice", "Client", "Issue Date", "Due Date"].map((h) => (
                  <th key={h} className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
                {["Subtotal", "Tax", "Total", "Paid", "Outstanding"].map((h) => (
                  <th key={h} className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
                <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</th>
                <th className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {listQuery.isLoading ? (
                <TableLoadingRows colSpan={COLS} />
              ) : listQuery.isError ? (
                <TableErrorRow colSpan={COLS} title="Unable to load invoices" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
              ) : invoices.length === 0 ? (
                <TableEmptyRow
                  colSpan={COLS}
                  icon={FileText}
                  title="No invoices found"
                  hint={hasFilters ? "Try adjusting your search or filters." : "Create a draft invoice for a client to get started."}
                />
              ) : (
                invoices.map((inv) => {
                  const tax = centsToNumber(sumCents([toCents(inv.cgst_amount), toCents(inv.sgst_amount), toCents(inv.igst_amount)]));
                  return (
                    <tr key={inv.id} onClick={() => navigate(`/finance/invoices/${inv.id}`)} className="group hover:bg-slate-50/70 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5 font-mono text-[12px] font-medium text-foreground whitespace-nowrap group-hover:text-primary">{inv.invoice_number}</td>
                      <td className="px-5 py-3.5 font-medium text-foreground whitespace-nowrap">{inv.client_name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{formatFinanceDate(inv.issue_date)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{formatFinanceDate(inv.due_date ?? undefined)}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap"><MoneyDisplay amount={Number(inv.taxable_amount)} /></td>
                      {/* Display of the backend's CGST + SGST + IGST for this row only. */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap text-muted-foreground"><MoneyDisplay amount={tax} /></td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap font-semibold"><MoneyDisplay amount={Number(inv.total_amount)} /></td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap text-emerald-700"><MoneyDisplay amount={Number(inv.total_paid)} /></td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {inv.status === "ISSUED" ? <MoneyDisplay amount={Number(inv.outstanding_amount)} className="text-amber-700" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <InvoiceStatusBadge status={inv.status} />
                          <InvoicePaymentBadge status={inv.payment_status} invoiceStatus={inv.status} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="View invoice" aria-label={`View invoice ${inv.invoice_number}`} onClick={() => navigate(`/finance/invoices/${inv.id}`)}>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          {permissions.canCreateInvoices && inv.status === "DRAFT" && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Edit draft" aria-label={`Edit draft ${inv.invoice_number}`} onClick={() => navigate(`/finance/invoices/${inv.id}/edit`)}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!listQuery.isError && <FinancePagination page={page} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setPage} />}
      </div>
    </div>
  );
}

export function InvoicesPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <InvoicesContent permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}
