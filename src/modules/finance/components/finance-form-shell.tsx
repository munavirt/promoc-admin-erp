import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─── Stat Card (Matches ClientsPage / UsersPage) ─────── */
export function FinanceStatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sub,
  trendPct,
  invertTrendColor = false,
}: {
  label: string;
  value: ReactNode;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: string;
  trendPct?: number | null;
  invertTrendColor?: boolean;
}) {
  const hasTrend = trendPct !== null && trendPct !== undefined && Number.isFinite(trendPct);
  const isPositive = (trendPct ?? 0) >= 0;
  const isGood = invertTrendColor ? !isPositive : isPositive;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-white px-5 py-4 shadow-sm">
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          iconBg,
          iconColor,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-muted-foreground truncate">{label}</p>
          {hasTrend && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                isGood
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700",
              )}
              title="Compared to previous month"
            >
              {isPositive ? "+" : ""}
              {trendPct}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground leading-tight mt-0.5 tabular-nums truncate">
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Filter Select (Matches ClientsPage / UsersPage) ─── */
export function FinanceFilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-xl border border-border/70 bg-white pl-3 pr-8 text-[13px] font-medium text-foreground outline-none transition-colors hover:border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/10 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}

/* ─── Form Shell Helpers (Matches AddClientPage / CreateProjectPage) ── */
export function FinanceBackHeader({
  backTo,
  backLabel,
  title,
  description,
  actions,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}

export function FinanceSectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-border/50">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}

export function FinanceField({
  label,
  error,
  required,
  children,
  hint,
  className,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-[13px] font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-500 mt-0.5">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export const financeInputClass = (error?: string) =>
  cn(
    "h-11 w-full rounded-xl border bg-white px-4 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all",
    "focus:border-primary/60 focus:ring-2 focus:ring-primary/10",
    error
      ? "border-red-400 focus:border-red-400 focus:ring-red-500/10"
      : "border-border/70 hover:border-border",
  );

export const financeSelectClass = (error?: string) =>
  cn(financeInputClass(error), "appearance-none pr-9 cursor-pointer");

export const financeTextareaClass = (error?: string) =>
  cn(
    "w-full rounded-xl border bg-white p-3.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all resize-none",
    "focus:border-primary/60 focus:ring-2 focus:ring-primary/10",
    error
      ? "border-red-400 focus:border-red-400 focus:ring-red-500/10"
      : "border-border/70 hover:border-border",
  );

export function FinanceLeadIcon({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
      {children}
    </span>
  );
}

export function FinanceFixedFooter({
  onCancel,
  cancelLabel = "Cancel",
  submitLabel,
  isSubmitting = false,
  secondaryAction,
}: {
  onCancel: () => void;
  cancelLabel?: string;
  submitLabel: string;
  isSubmitting?: boolean;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-white/95 backdrop-blur-sm px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="mx-auto max-w-[1600px] lg:pl-[240px] flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-10 rounded-xl px-5 border-border/70"
        >
          {cancelLabel}
        </Button>
        <div className="flex items-center gap-2.5">
          {secondaryAction}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-10 rounded-xl px-6 shadow-sm shadow-primary/20 font-semibold"
          >
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
