import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  IndianRupee,
  Receipt,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { StatStrip } from "@/components/shared/stat-strip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { FinanceGuard } from "../components/finance-guard";
import { IncomeVsExpensesChart, type PerformancePeriod } from "../components/income-vs-expenses-chart";
import { MoneyDisplay } from "../components/money-display";
import { useOverviewSummary, useOverviewTrends, useRecentTransactions } from "../hooks/use-finance-workspace";
import type { OverviewQuery } from "../types/api-contracts";
import type { MonthlyPerformancePoint } from "../types/finance.types";
import { formatFinanceDate } from "../utils/formatters";

/** All figures come from Django (FinanceOverviewService) — nothing is computed from local records. */
const SUMMARY_QUERY: OverviewQuery = { period: "this_year" };
const CHART_QUERIES: Record<PerformancePeriod, OverviewQuery> = {
  last_6_months: { period: "6m", grouping: "month" },
  last_12_months: { period: "1y", grouping: "month" },
};

function monthLabel(key: string) {
  const m = /^(\d{4})-(\d{2})/.exec(key);
  if (!m) return key;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function OverviewContent() {
  const navigate = useNavigate();
  const [graphPeriod, setGraphPeriod] = useState<PerformancePeriod>("last_6_months");

  // GET /api/finance/overview/?period=this_year
  const summaryQ = useOverviewSummary(SUMMARY_QUERY);
  // GET /api/finance/overview/trends/?period=6m|1y&grouping=month
  const trendsQ = useOverviewTrends(CHART_QUERIES[graphPeriod]);
  // GET /api/finance/overview/recent-transactions/?limit=8
  const recentQ = useRecentTransactions(8);
  const s = summaryQ.data;

  // Map backend buckets onto the existing chart. Backend income already includes payment-generated income;
  // it is not split, so the whole amount is shown as income.
  const chartPoints = useMemo<MonthlyPerformancePoint[]>(
    () =>
      (trendsQ.data?.results ?? []).map((p) => ({
        monthKey: p.period,
        monthLabel: monthLabel(p.period),
        manualIncome: Number(p.income),
        invoicePayments: 0,
        totalIncome: Number(p.income),
        expenses: Number(p.expenses),
        netCashMovement: Number(p.net_cash_flow),
      })),
    [trendsQ.data],
  );

  const money = (v?: string) => (v === undefined ? "—" : <MoneyDisplay amount={Number(v)} />);
  const recent = recentQ.data?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Finance overview"
        description="Where the agency's cash came from and where it went — this calendar year."
      />

      {summaryQ.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <AlertCircle className="h-4 w-4" />
          Finance summary could not be loaded: {extractApiErrorMessage(summaryQ.error).message}
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => void summaryQ.refetch()}>Retry</Button>
        </div>
      )}

      <StatStrip
        loading={summaryQ.isLoading}
        className="mb-0"
        items={[
          {
            label: "Net cash movement",
            value: money(s?.net_cash_flow),
            hint: s ? `Income minus expenses · ${formatFinanceDate(s.period_start)} – ${formatFinanceDate(s.period_end)}` : "Income minus expenses",
            icon: Wallet,
            tone: "blue",
          },
          {
            label: "Income received",
            value: money(s?.total_income),
            hint: s ? `${s.income_transaction_count} record${s.income_transaction_count === 1 ? "" : "s"} this year` : "This year",
            icon: TrendingUp,
            tone: "mint",
            onClick: () => navigate("/finance/income"),
          },
          {
            label: "Expenses paid",
            value: money(s?.total_expenses),
            hint: s ? `${s.expense_transaction_count} record${s.expense_transaction_count === 1 ? "" : "s"} this year` : "This year",
            icon: TrendingDown,
            tone: "peach",
            onClick: () => navigate("/finance/expenses"),
          },
          {
            label: "Outstanding",
            value: "—",
            hint: "Not available — invoices are not connected yet",
            icon: Receipt,
            tone: "rose",
          },
        ]}
      />

      {/* Income vs Expenses Graph */}
      {trendsQ.isError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-white py-12 text-center shadow-sm">
          <AlertCircle className="h-6 w-6 text-red-400" />
          <p className="text-[14px] font-medium text-foreground">Income vs expenses could not be loaded</p>
          <p className="text-[12px] text-muted-foreground">{extractApiErrorMessage(trendsQ.error).message}</p>
          <Button size="sm" variant="outline" className="mt-1 h-8 gap-1.5 text-xs" onClick={() => void trendsQ.refetch()}><RefreshCcw className="h-3.5 w-3.5" /> Retry</Button>
        </div>
      ) : (
        <IncomeVsExpensesChart data={chartPoints} period={graphPeriod} onPeriodChange={setGraphPeriod} isLoading={trendsQ.isLoading} />
      )}

      {/* Recent Financial Activity */}
      <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border/60">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Recent Financial Activity</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Latest recorded income and agency expenses</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-[13px] font-medium text-primary hover:text-primary">
            <Link to="/finance/income">
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {recentQ.isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="h-10 w-10 rounded-full bg-secondary/60 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 rounded bg-secondary/60 animate-pulse" />
                  <div className="h-3 w-32 rounded bg-secondary/40 animate-pulse" />
                </div>
                <div className="h-4 w-24 rounded bg-secondary/60 animate-pulse" />
              </div>
            ))}
          </div>
        ) : recentQ.isError ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center px-6">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <p className="text-[14px] font-medium text-foreground">Recent activity could not be loaded</p>
            <p className="text-[12px] text-muted-foreground">{extractApiErrorMessage(recentQ.error).message}</p>
            <Button size="sm" variant="outline" className="mt-1 h-8 text-xs" onClick={() => void recentQ.refetch()}>Retry</Button>
          </div>
        ) : recent.length === 0 ? (
          <div className="py-12 text-center px-6">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
                <IndianRupee className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[14px] font-medium text-foreground">No financial activity recorded yet</p>
              <p className="text-[12px] text-muted-foreground">Income and expenses will appear here once they are recorded.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {recent.map((tx) => {
              const inflow = tx.type === "INCOME";
              const ActivityIcon = inflow ? ArrowUpRight : ArrowDownRight;
              return (
                <button
                  key={`${tx.type}-${tx.id}`}
                  type="button"
                  onClick={() => navigate(inflow ? `/finance/income/${tx.id}` : `/finance/expenses/${tx.id}`)}
                  className="group w-full flex items-center justify-between gap-4 px-6 py-3.5 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", inflow ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                      <ActivityIcon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">{tx.description}</p>
                      <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                        {inflow ? "Income" : tx.vendor_name || "Expense"} · {formatFinanceDate(tx.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn("hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium", inflow ? "bg-blue-50 text-blue-700 border-blue-200/70" : "bg-amber-50 text-amber-700 border-amber-200/70")}>
                      {tx.category_name}
                    </span>
                    <span className={cn("text-[14px] font-semibold tabular-nums whitespace-nowrap", inflow ? "text-emerald-700" : "text-foreground")}>
                      {inflow ? "+" : "-"}
                      <MoneyDisplay amount={Number(tx.amount)} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function FinanceOverviewPage() {
  return (
    <AppLayout>
      <FinanceGuard>{() => <OverviewContent />}</FinanceGuard>
    </AppLayout>
  );
}
