import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, Paperclip, Pencil, Plus, Receipt, RefreshCcw, Search, X } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { FinanceFilterSelect } from "../components/finance-form-shell";
import { FinanceGuard } from "../components/finance-guard";
import { FinancePagination } from "../components/finance-pagination";
import { MoneyDisplay } from "../components/money-display";
import { useExpenses, useFinanceCategories } from "../hooks/use-finance";
import { BACKEND_PAYMENT_METHODS, paymentMethodLabel, type FinanceListParams } from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { formatFinanceDate } from "../utils/formatters";

/** Backend PAGE_SIZE. */
const PAGE_SIZE = 10;

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function ExpensesContent({ permissions }: { permissions: FinancePermissions }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim());
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [debouncedSearch, categoryFilter, methodFilter]);

  // GET /api/finance/expenses/ — server-side search (description, vendor, reference, notes), category id, method, page.
  const params: FinanceListParams = {
    page,
    search: debouncedSearch || undefined,
    category: categoryFilter !== "ALL" ? categoryFilter : undefined,
    payment_method: methodFilter !== "ALL" ? methodFilter : undefined,
  };
  const listQuery = useExpenses(params);
  const categoriesQuery = useFinanceCategories("EXPENSE");
  const expenses = listQuery.data?.results ?? [];
  const total = listQuery.data?.count ?? 0;

  const errStatus = (listQuery.error as { status?: number | null } | null)?.status;
  useEffect(() => {
    if (errStatus === 404 && page > 1) setPage((p) => p - 1);
  }, [errStatus, page]);

  const hasFilters = Boolean(search) || categoryFilter !== "ALL" || methodFilter !== "ALL";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Expenses</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Manage and track agency expenses.</p>
        </div>
        {permissions.canManageExpenses && (
          <Button asChild className="h-10 gap-2 px-4 shadow-sm shadow-primary/20">
            <Link to="/finance/expenses/new">
              <Plus className="h-4 w-4" />
              Add Expense
            </Link>
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 rounded-2xl border border-border/70 bg-white px-5 py-3.5 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search expenses"
            placeholder="Search by expense title, vendor, or reference..."
            className="h-10 w-full rounded-xl border border-border/70 bg-white pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <FinanceFilterSelect
          ariaLabel="Filter expenses by category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { label: "Category: All", value: "ALL" },
            ...(categoriesQuery.data ?? []).map((c) => ({ label: c.is_active ? c.name : `${c.name} (inactive)`, value: String(c.id) })),
          ]}
        />
        <FinanceFilterSelect
          ariaLabel="Filter expenses by payment method"
          value={methodFilter}
          onChange={setMethodFilter}
          options={[
            { label: "Method: All", value: "ALL" },
            ...BACKEND_PAYMENT_METHODS.map((m) => ({ label: paymentMethodLabel(m), value: m })),
          ]}
        />

        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(""); setCategoryFilter("ALL"); setMethodFilter("ALL"); }} className="h-10 px-3 text-[12px] text-muted-foreground">
            Reset
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
        <div className={cn("overflow-x-auto transition-opacity", listQuery.isFetching && !listQuery.isLoading && "opacity-70")}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/60 bg-slate-50/80">
                {["Expense ID", "Expense Title", "Category", "Vendor"].map((h) => (
                  <th key={h} className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
                <th className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Expense Date</th>
                <th className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {listQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="h-14 px-5"><div className="h-4 w-full rounded bg-secondary/50 animate-pulse" /></td>
                  </tr>
                ))
              ) : listQuery.isError ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-7 w-7 text-red-400" />
                      <p className="text-[14px] font-medium text-foreground">Unable to load expenses</p>
                      <p className="text-[12px] text-muted-foreground">{extractApiErrorMessage(listQuery.error, "Please try again.").message}</p>
                      <Button size="sm" variant="outline" className="mt-1 h-8 gap-1.5 text-xs" onClick={() => void listQuery.refetch()}>
                        <RefreshCcw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                        <Receipt className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-[14px] font-medium text-foreground">No expenses found</p>
                      <p className="text-[12px] text-muted-foreground">
                        {hasFilters ? "Try adjusting your search or filters." : "Add an expense to track vendor payouts and operating costs."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} onClick={() => navigate(`/finance/expenses/${exp.id}`)} className="group hover:bg-slate-50/70 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5 font-mono text-[12px] font-medium text-foreground whitespace-nowrap">#{exp.id}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">{exp.description}</span>
                        {exp.receipt_file && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label="Has receipt" />}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{exp.category_name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{exp.vendor_name || "—"}</td>
                    <td className="px-5 py-3.5 text-right font-semibold whitespace-nowrap text-foreground"><MoneyDisplay amount={Number(exp.amount)} /></td>
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{formatFinanceDate(exp.expense_date)}</td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="View Expense" aria-label={`View expense #${exp.id}`} onClick={() => navigate(`/finance/expenses/${exp.id}`)}>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {permissions.canManageExpenses && (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Edit Expense" aria-label={`Edit expense #${exp.id}`} onClick={() => navigate(`/finance/expenses/${exp.id}/edit`)}>
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!listQuery.isError && <FinancePagination page={page} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setPage} />}
      </div>
    </div>
  );
}

export function ExpensesPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <ExpensesContent permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}
