/**
 * Readability helpers for income-vs-expense bar charts.
 *
 * Income and expenses share one Y axis, so a small expense next to large income
 * (e.g. ₹50 vs ₹3,00,000) renders as a sub-pixel bar. These helpers never change
 * the plotted values: they only decide how a non-zero bar is *drawn* and when to
 * tell the user that the scale hides small amounts.
 */

/** Minimum on-screen height (px) for a non-zero bar, so it is visible and hoverable. */
export const MIN_VISIBLE_BAR_PX = 3;

/**
 * Below this share of the largest income bar, expense bars are effectively
 * invisible on a shared axis (2% of a ~250px plot is ~5px).
 */
export const SMALL_SERIES_RATIO = 0.02;

/**
 * Recharts `minPointSize` callback: non-zero values get a minimum visible height;
 * zero (and missing) values stay flat so "no expenses" is never drawn as a bar.
 */
export function minVisibleBarSize(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value !== 0 ? MIN_VISIBLE_BAR_PX : 0;
}

function maxOf(values: Array<number | null | undefined>): number {
  return values.reduce<number>((m, v) => (typeof v === "number" && Number.isFinite(v) && v > m ? v : m), 0);
}

/**
 * True when expenses exist but are so small relative to income that, on a shared
 * axis, their bars would be barely visible.
 */
export function expensesDwarfedByIncome(
  income: Array<number | null | undefined>,
  expenses: Array<number | null | undefined>,
  ratio: number = SMALL_SERIES_RATIO,
): boolean {
  const maxIncome = maxOf(income);
  const maxExpense = maxOf(expenses);
  if (maxExpense <= 0 || maxIncome <= 0) return false;
  return maxExpense / maxIncome < ratio;
}
