import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, IndianRupee, Pencil, Plus, RefreshCcw, Search, X } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { FinanceFilterSelect } from "../components/finance-form-shell";
import { FinanceGuard } from "../components/finance-guard";
import { FinancePagination } from "../components/finance-pagination";
import { MoneyDisplay } from "../components/money-display";
import { useFinanceCategories, useIncomes } from "../hooks/use-finance";
import { BACKEND_PAYMENT_METHODS, paymentMethodLabel, type FinanceListParams } from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { formatFinanceDate } from "../utils/formatters";

/** Backend PAGE_SIZE (REST_FRAMEWORK settings). */
const PAGE_SIZE = 10;

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function IncomeContent({ permissions }: { permissions: FinancePermissions }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim());
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [debouncedSearch, categoryFilter, methodFilter]);

  // GET /api/finance/income/ — server-side search (description, reference, notes), category id, method, page.
  const params: FinanceListParams = {
    page,
    search: debouncedSearch || undefined,
    category: categoryFilter !== "ALL" ? categoryFilter : undefined,
    payment_method: methodFilter !== "ALL" ? methodFilter : undefined,
  };
  const listQuery = useIncomes(params);
  const categoriesQuery = useFinanceCategories("INCOME");
  const incomes = listQuery.data?.results ?? [];
  const total = listQuery.data?.count ?? 0;

  const errStatus = (listQuery.error as { status?: number | null } | null)?.status;
  useEffect(() => {
    if (errStatus === 404 && page > 1) setPage((p) => p - 1);
  }, [errStatus, page]);

  const hasFilters = Boolean(search) || categoryFilter !== "ALL" || methodFilter !== "ALL";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Income</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Track income received by PromoCraft.
          </p>
        </div>
        {permissions.canManageIncome && (
          <Button asChild className="h-10 gap-2 px-4 shadow-sm shadow-primary/20">
            <Link to="/finance/income/new">
              <Plus className="h-4 w-4" />
              Add Income
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
            aria-label="Search income"
            placeholder="Search by description, reference, or notes..."
            className="h-10 w-full rounded-xl border border-border/70 bg-white pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <FinanceFilterSelect
          ariaLabel="Filter income by category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { label: "Category: All", value: "ALL" },
            ...(categoriesQuery.data ?? []).map((c) => ({ label: c.is_active ? c.name : `${c.name} (inactive)`, value: String(c.id) })),
          ]}
        />
        <FinanceFilterSelect
          ariaLabel="Filter income by payment method"
          value={methodFilter}
          onChange={setMethodFilter}
          options={[
            { label: "Method: All", value: "ALL" },
            ...BACKEND_PAYMENT_METHODS.map((m) => ({ label: paymentMethodLabel(m), value: m })),
          ]}
        />

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setCategoryFilter("ALL");
              setMethodFilter("ALL");
            }}
            className="h-10 px-3 text-[12px] text-muted-foreground"
          >
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
                {["Record", "Description", "Payment Method", "Category"].map((h) => (
                  <th key={h} className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
                <th className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Received Date</th>
                <th className="h-11 px-5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {listQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="h-14 px-5">
                      <div className="h-4 w-full rounded bg-secondary/50 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : listQuery.isError ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-7 w-7 text-red-400" />
                      <p className="text-[14px] font-medium text-foreground">Unable to load income records</p>
                      <p className="text-[12px] text-muted-foreground">{extractApiErrorMessage(listQuery.error, "Please try again.").message}</p>
                      <Button size="sm" variant="outline" className="mt-1 h-8 gap-1.5 text-xs" onClick={() => void listQuery.refetch()}>
                        <RefreshCcw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : incomes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                        <IndianRupee className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-[14px] font-medium text-foreground">No income records found</p>
                      <p className="text-[12px] text-muted-foreground">
                        {hasFilters
                          ? "Try adjusting your search or filters."
                          : "Add your first income record to start tracking non-invoice inflows."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                incomes.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => navigate(`/finance/income/${inc.id}`)}
                    className="group hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-mono text-[12px] font-medium text-foreground whitespace-nowrap">#{inc.id}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors">{inc.description}</span>
                      {inc.is_payment_receipt && (
                        <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700">Client payment</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{paymentMethodLabel(inc.payment_method)}</td>
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{inc.category_name}</td>
                    <td className="px-5 py-3.5 text-right font-semibold whitespace-nowrap text-emerald-700">
                      <MoneyDisplay amount={Number(inc.amount)} />
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{formatFinanceDate(inc.received_date)}</td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="View Income" aria-label={`View income #${inc.id}`} onClick={() => navigate(`/finance/income/${inc.id}`)}>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {permissions.canManageIncome && !inc.is_payment_receipt && (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Edit Income" aria-label={`Edit income #${inc.id}`} onClick={() => navigate(`/finance/income/${inc.id}/edit`)}>
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
        {!listQuery.isError && (
          <FinancePagination page={page} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}

export function IncomePage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <IncomeContent permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}
