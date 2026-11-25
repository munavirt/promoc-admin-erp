import { Info } from "lucide-react";

interface ExpenseScaleNoticeProps {
  /** Expenses exist but are tiny relative to income on the shared axis. */
  dwarfed: boolean;
  /** Income (and net) are hidden so the axis is scaled to expenses only. */
  expenseFocus: boolean;
  onExpenseFocusChange: (focus: boolean) => void;
}

/**
 * Explains when small expense bars are drawn at a minimum height and offers an
 * honest alternative view: expenses alone on their own (relabelled) axis.
 */
export function ExpenseScaleNotice({ dwarfed, expenseFocus, onExpenseFocusChange }: ExpenseScaleNoticeProps) {
  if (!dwarfed && !expenseFocus) return null;

  return (
    <div className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground" role="note">
      <Info className="mt-[3px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0">
        {expenseFocus
          ? "Showing expenses only. The scale is adjusted to expense amounts. "
          : "Expenses are very small next to income on this scale, so their bars are drawn at a minimum height. Hover a bar for exact amounts. "}
        <button
          type="button"
          className="font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
          onClick={() => onExpenseFocusChange(!expenseFocus)}
          aria-pressed={expenseFocus}
        >
          {expenseFocus ? "Show income" : "View expenses on their own scale"}
        </button>
      </p>
    </div>
  );
}
