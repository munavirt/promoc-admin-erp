import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Plus, Search, Wallet, X } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FinanceFilterSelect } from "../components/finance-form-shell";
import { FinanceGuard } from "../components/finance-guard";
import { FinancePagination } from "../components/finance-pagination";
import { PaymentStatusBadge } from "../components/finance-status";
import { TableEmptyRow, TableErrorRow, TableLoadingRows } from "../components/finance-table-states";
import { MoneyDisplay } from "../components/money-display";
import { useFinanceClients, usePayments } from "../hooks/use-invoices-payments";
import { BACKEND_PAYMENT_METHODS, paymentMethodLabel, type BackendPaymentMethod, type PaymentListParams, type PaymentStatus } from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { formatFinanceDate } from "../utils/formatters";

const PAGE_SIZE = 10;
const COLS = 9;

const ORDERING_OPTIONS = [
  { label: "Payment date (newest)", value: "-payment_date" },
  { label: "Payment date (oldest)", value: "payment_date" },
  { label: "Amount (highest)", value: "-amount" },
  { label: "Amount (lowest)", value: "amount" },
  { label: "Recorded (newest)", value: "-created_at" },
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

function PaymentsContent({ permissions }: { permissions: FinancePermissions }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim());
  const [clientFilter, setClientFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [allocFilter, setAllocFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [ordering, setOrdering] = useState("-payment_date");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [debouncedSearch, clientFilter, methodFilter, statusFilter, allocFilter, fromDate, toDate, ordering]);

  // GET /api/finance/payments/ — all filtering, sorting and paging by Django.
  const params: PaymentListParams = {
    page,
    search: debouncedSearch || undefined,
    client: clientFilter !== "ALL" ? clientFilter : undefined,
    payment_method: methodFilter !== "ALL" ? (methodFilter as BackendPaymentMethod) : undefined,
    status: statusFilter !== "ALL" ? (statusFilter as PaymentStatus) : undefined,
    has_unallocated: allocFilter === "ALL" ? undefined : allocFilter === "YES",
    start_date: fromDate || undefined,
    end_date: toDate || undefined,
    ordering,
  };
  const listQuery = usePayments(params);
  const clientsQuery = useFinanceClients();
  const payments = listQuery.data?.results ?? [];
  const total = listQuery.data?.count ?? 0;

  const errStatus = (listQuery.error as { status?: number | null } | null)?.status;
  useEffect(() => {
    if (errStatus === 404 && page > 1) setPage((p) => p - 1);
  }, [errStatus, page]);

  const hasFilters = Boolean(search) || clientFilter !== "ALL" || methodFilter !== "ALL" || statusFilter !== "ALL" || allocFilter !== "ALL" || Boolean(fromDate) || Boolean(toDate);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payments</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Client payments received and their allocation to invoices.</p>
        </div>
        {permissions.canRecordPayments && (
          <Button asChild className="h-10 gap-2 px-4 shadow-sm shadow-primary/20">
            <Link to="/finance/payments/new">
              <Plus className="h-4 w-4" />
              Record Payment
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
            aria-label="Search payments"
            placeholder="Search by payment number, reference, client or notes..."
            className="h-10 w-full rounded-xl border border-border/70 bg-white pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <FinanceFilterSelect ariaLabel="Filter by client" value={clientFilter} onChange={setClientFilter}
          options={[{ label: "Client: All", value: "ALL" }, ...(clientsQuery.data ?? []).map((c) => ({ label: c.company_name, value: String(c.id) }))]} />
        <FinanceFilterSelect ariaLabel="Filter by payment method" value={methodFilter} onChange={setMethodFilter}
          options={[{ label: "Method: All", value: "ALL" }, ...BACKEND_PAYMENT_METHODS.map((m) => ({ label: paymentMethodLabel(m), value: m }))]} />
        <FinanceFilterSelect ariaLabel="Filter by status" value={statusFilter} onChange={setStatusFilter}
          options={[{ label: "Status: All", value: "ALL" }, { label: "Confirmed", value: "CONFIRMED" }, { label: "Voided", value: "VOIDED" }]} />
        <FinanceFilterSelect ariaLabel="Filter by unallocated balance" value={allocFilter} onChange={setAllocFilter}
          options={[{ label: "Allocation: All", value: "ALL" }, { label: "Has unallocated balance", value: "YES" }, { label: "Fully allocated / voided", value: "NO" }]} />
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span>Paid</span>
          <input type="date" aria-label="Payment date from" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className={dateInputClass} />
          <span>to</span>
          <input type="date" aria-label="Payment date to" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className={dateInputClass} />
        </div>
        <FinanceFilterSelect ariaLabel="Sort payments" value={ordering} onChange={setOrdering} options={ORDERING_OPTIONS} />
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" className="h-10 px-3 text-[12px] text-muted-foreground"
            onClick={() => { setSearch(""); setClientFilter("ALL"); setMethodFilter("ALL"); setStatusFilter("ALL"); setAllocFilter("ALL"); setFromDate(""); setToDate(""); }}>
            Reset
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
        <div className={cn("overflow-x-auto transition-opacity", listQuery.isFetching && !listQuery.isLoading && "opacity-70")}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/60 bg-slate-50/80">
                {["Payment", "Client", "Payment Date", "Method", "Invoices"].map((h) => (
                  <th key={h} className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
                {["Amount", "Unallocated"].map((h) => (
                  <th key={h} className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
                <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {listQuery.isLoading ? (
                <TableLoadingRows colSpan={COLS} />
              ) : listQuery.isError ? (
                <TableErrorRow colSpan={COLS} title="Unable to load payments" error={listQuery.error} onRetry={() => void listQuery.refetch()} />
              ) : payments.length === 0 ? (
                <TableEmptyRow colSpan={COLS} icon={Wallet} title="No payments found"
                  hint={hasFilters ? "Try adjusting your search or filters." : "Record a client payment to allocate it to issued invoices."} />
              ) : (
                payments.map((p) => {
                  const active = p.allocations.filter((a) => a.status === "ACTIVE");
                  return (
                    <tr key={p.id} onClick={() => navigate(`/finance/payments/${p.id}`)} className={cn("group hover:bg-slate-50/70 transition-colors cursor-pointer", p.status === "VOIDED" && "opacity-70")}>
                      <td className="px-5 py-3.5 font-mono text-[12px] font-medium text-foreground whitespace-nowrap group-hover:text-primary">
                        {p.payment_number}
                        {p.reference_number && <div className="font-sans text-[11px] font-normal text-muted-foreground">Ref {p.reference_number}</div>}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground whitespace-nowrap">{p.client_name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{formatFinanceDate(p.payment_date)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{paymentMethodLabel(p.payment_method)}</td>
                      <td className="px-5 py-3.5 text-[12px] text-muted-foreground">
                        {active.length === 0 ? "—" : active.map((a) => a.invoice_number).join(", ")}
                      </td>
                      <td className={cn("px-5 py-3.5 text-right font-semibold whitespace-nowrap", p.status === "VOIDED" ? "line-through text-muted-foreground" : "text-emerald-700")}>
                        <MoneyDisplay amount={Number(p.amount)} />
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {p.status === "VOIDED" ? <span className="text-muted-foreground">—</span> : <MoneyDisplay amount={Number(p.unallocated_amount)} className={Number(p.unallocated_amount) > 0 ? "text-amber-700" : "text-muted-foreground"} />}
                      </td>
                      <td className="px-5 py-3.5"><PaymentStatusBadge status={p.status} /></td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="View payment" aria-label={`View payment ${p.payment_number}`} onClick={() => navigate(`/finance/payments/${p.id}`)}>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
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

export function PaymentsPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <PaymentsContent permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}
