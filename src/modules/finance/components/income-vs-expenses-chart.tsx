import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyPerformancePoint } from "../types/finance.types";
import { formatINR } from "../utils/money";
import { expensesDwarfedByIncome, minVisibleBarSize } from "../utils/chart-scale";
import { ExpenseScaleNotice } from "./expense-scale-notice";
import { FinanceFilterSelect } from "./finance-form-shell";

const SERIES_COLORS = {
  income: "#0062ff",
  expenses: "var(--chart-expense)",
};

export type PerformancePeriod = "last_6_months" | "last_12_months";

interface IncomeVsExpensesChartProps {
  data: MonthlyPerformancePoint[];
  period: PerformancePeriod;
  onPeriodChange: (period: PerformancePeriod) => void;
  isLoading?: boolean;
}

function CustomChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: MonthlyPerformancePoint;
  }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  // Read exact amounts from the data row so both series are listed even when one is hidden.
  const entries: Array<[string, number, string]> = [
    ["Income", row.totalIncome, SERIES_COLORS.income],
    ["Expenses", row.expenses, SERIES_COLORS.expenses],
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-white px-3.5 py-2.5 shadow-md text-[12px]">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      <div className="space-y-1">
        {entries.map(([name, value, color]) => (
          <div key={name} className="flex items-center justify-between gap-5">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              {name}
            </span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatINR(Number(value) || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IncomeVsExpensesChart({
  data,
  period,
  onPeriodChange,
  isLoading = false,
}: IncomeVsExpensesChartProps) {
  const hasActivity = data.some((point) => point.totalIncome > 0 || point.expenses > 0);
  const [expenseFocus, setExpenseFocus] = useState(false);
  const dwarfed = useMemo(
    () => expensesDwarfedByIncome(data.map((p) => p.totalIncome), data.map((p) => p.expenses)),
    [data],
  );

  return (
    <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border/60">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Income vs Expenses</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Monthly financial performance.
          </p>
        </div>

        <FinanceFilterSelect
          ariaLabel="Select monthly performance period"
          value={period}
          onChange={(val) => onPeriodChange(val as PerformancePeriod)}
          options={[
            { label: "Last 6 months", value: "last_6_months" },
            { label: "Last 12 months", value: "last_12_months" },
          ]}
        />
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="h-[280px] sm:h-[320px] w-full rounded-xl bg-secondary/40 animate-pulse" />
        ) : !hasActivity ? (
          <div className="flex h-[260px] flex-col items-center justify-center text-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-medium text-foreground">
              No financial activity for this period
            </p>
            <p className="text-[12px] text-muted-foreground max-w-sm">
              Recorded income, received client payments, and active expenses will appear here once
              logged.
            </p>
          </div>
        ) : (
          <div className="h-[280px] sm:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f7" />
                <XAxis
                  dataKey="monthLabel"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: "#929db0", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={68}
                  tick={{ fill: "#929db0", fontSize: 12 }}
                  tickFormatter={(value) => formatINR(Number(value), { compact: true })}
                />
                <Tooltip
                  cursor={{ fill: "#f2f7ff" }}
                  content={<CustomChartTooltip />}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: 16, fontSize: 12 }}
                />
                <Bar
                  dataKey="totalIncome"
                  name="Income"
                  fill={SERIES_COLORS.income}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={26}
                  minPointSize={minVisibleBarSize}
                  hide={expenseFocus}
                />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill={SERIES_COLORS.expenses}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={26}
                  minPointSize={minVisibleBarSize}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {!isLoading && hasActivity && (
          <ExpenseScaleNotice dwarfed={dwarfed} expenseFocus={expenseFocus} onExpenseFocusChange={setExpenseFocus} />
        )}
      </div>
    </div>
  );
}
