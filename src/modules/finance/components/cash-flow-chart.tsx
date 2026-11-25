import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { TrendPointDTO } from "../types/api-contracts";
import { toAmount } from "../utils/contract-format";
import { formatINR } from "../utils/money";
import { expensesDwarfedByIncome, minVisibleBarSize } from "../utils/chart-scale";
import { ExpenseScaleNotice } from "./expense-scale-notice";

interface CashFlowChartProps {
  points: TrendPointDTO[];
  grouping: "day" | "month";
  height?: number;
  showNet?: boolean;
  /** Show expenses alone on their own scale (hides income and net). Controlled when provided. */
  expenseFocus?: boolean;
  onExpenseFocusChange?: (focus: boolean) => void;
}

const COLORS = {
  income: "var(--chart-income)",
  expenses: "var(--chart-expense)",
  net: "var(--chart-net)",
};

function labelFor(period: string, grouping: "day" | "month", long = false) {
  if (grouping === "month") {
    const d = new Date(`${period}-01T00:00:00`);
    return d.toLocaleDateString("en-IN", { month: long ? "long" : "short", ...(long ? { year: "numeric" } : {}) });
  }
  const d = new Date(`${period}T00:00:00`);
  return d.toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });
}

function ChartTooltip({ active, payload, label, grouping }: TooltipProps<number, string> & { grouping: "day" | "month" }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { income: number; expenses: number; net: number; period: string };
  return (
    <div className="min-w-[180px] rounded-[12px] bg-[#202b3c] px-3.5 py-2.5 text-[12px] text-white shadow-xl">
      <div className="mb-1.5 font-medium text-background/70">{labelFor(String(label ?? row.period), grouping, true)}</div>
      {[
        ["Income", row.income, COLORS.income],
        ["Expenses", row.expenses, COLORS.expenses],
      ].map(([name, value, color]) => (
        <div key={String(name)} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: String(color) }} />
            {name}
          </span>
          <span className="figure font-medium">{formatINR(Number(value))}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-background/15 pt-1.5">
        <span>Net</span>
        <span className="figure font-semibold">{formatINR(row.net)}</span>
      </div>
    </div>
  );
}

/** Income vs expenses bars with a net cash-flow line, fed by /api/finance/overview/trends/. */
export function CashFlowChart({
  points,
  grouping,
  height = 260,
  showNet = true,
  expenseFocus: expenseFocusProp,
  onExpenseFocusChange,
}: CashFlowChartProps) {
  const [expenseFocusState, setExpenseFocusState] = useState(false);
  const expenseFocus = expenseFocusProp ?? expenseFocusState;
  const setExpenseFocus = (focus: boolean) => {
    if (expenseFocusProp === undefined) setExpenseFocusState(focus);
    onExpenseFocusChange?.(focus);
  };
  const data = useMemo(
    () =>
      points.map((p) => ({
        period: p.period,
        income: toAmount(p.income),
        expenses: toAmount(p.expenses),
        net: toAmount(p.net_cash_flow),
      })),
    [points],
  );
  const dense = data.length > 16;
  const hasActivity = data.some((d) => d.income !== 0 || d.expenses !== 0);
  const dwarfed = useMemo(
    () => expensesDwarfedByIncome(data.map((d) => d.income), data.map((d) => d.expenses)),
    [data],
  );

  return (
    <>
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap={dense ? "18%" : "28%"}>
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis
            dataKey="period"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--subtle)" }}
            tickFormatter={(v) => labelFor(String(v), grouping)}
            interval="preserveStartEnd"
            minTickGap={18}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: "var(--subtle)" }}
            tickFormatter={(v) => (v === 0 ? "0" : formatINR(Number(v), { compact: true }))}
          />
          <Tooltip
            cursor={{ fill: "rgba(16,24,40,0.04)" }}
            content={(props) => <ChartTooltip {...(props as TooltipProps<number, string>)} grouping={grouping} />}
          />
          <Bar dataKey="income" fill={COLORS.income} radius={[6, 6, 2, 2]} maxBarSize={28} animationDuration={500} minPointSize={minVisibleBarSize} hide={expenseFocus} />
          <Bar dataKey="expenses" fill={COLORS.expenses} radius={[6, 6, 2, 2]} maxBarSize={28} animationDuration={500} minPointSize={minVisibleBarSize} />
          {showNet && (
            <Line
              hide={expenseFocus}
              type="monotone"
              dataKey="net"
              stroke={COLORS.net}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
              animationDuration={600}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    {hasActivity && (
      <ExpenseScaleNotice dwarfed={dwarfed} expenseFocus={expenseFocus} onExpenseFocusChange={setExpenseFocus} />
    )}
    </>
  );
}

export function CashFlowLegend({ showNet = true, expenseFocus = false }: { showNet?: boolean; expenseFocus?: boolean }) {
  const items: Array<[string, string, "bar" | "line"]> = [
    ["Income", COLORS.income, "bar"],
    ["Expenses", COLORS.expenses, "bar"],
    ...(showNet ? ([["Net cash flow", COLORS.net, "line"]] as Array<[string, string, "line"]>) : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
      {items.map(([label, color, kind]) => (
        <span key={label} className={`flex items-center gap-1.5${expenseFocus && label !== "Expenses" ? " opacity-40" : ""}`}>
          {kind === "bar" ? (
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
          ) : (
            <span className="h-[2px] w-3.5 rounded-full" style={{ background: color }} />
          )}
          {label}
        </span>
      ))}
    </div>
  );
}
