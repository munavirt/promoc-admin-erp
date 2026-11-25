import { cn } from "@/lib/utils";

export type StatusType =
  | "Active" | "Pending" | "In Progress" | "Cancelled" | "Archived"
  | "Planning" | "Review" | "Completed" | "Todo" | "Doing" | "Done" | "Online" | "Offline" | "In a meeting";

export type StatusTone = "neutral" | "info" | "positive" | "caution" | "negative";

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

const TONE_STYLES: Record<StatusTone, { text: string; bg: string; dot: string }> = {
  neutral: { text: "text-muted-foreground", bg: "bg-secondary", dot: "bg-subtle" },
  info: { text: "text-info", bg: "bg-info-soft", dot: "bg-info" },
  positive: { text: "text-positive", bg: "bg-positive-soft", dot: "bg-positive" },
  caution: { text: "text-caution", bg: "bg-caution-soft", dot: "bg-[#f0a020]" },
  negative: { text: "text-negative", bg: "bg-negative-soft", dot: "bg-negative" },
};

const statusTone: Record<string, StatusTone> = {
  Active: "positive",
  Online: "positive",
  Completed: "positive",
  Done: "positive",
  Pending: "caution",
  Review: "caution",
  "In a meeting": "caution",
  Planning: "info",
  "In Progress": "info",
  Doing: "info",
  Cancelled: "negative",
  Archived: "neutral",
  Todo: "neutral",
  Offline: "neutral",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = TONE_STYLES[statusTone[status] || "neutral"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap",
        s.bg,
        s.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {status}
    </span>
  );
}

/** Text-only status with a coloured dot — for dense tables where pills add noise. */
export function StatusDot({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const s = TONE_STYLES[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] font-medium whitespace-nowrap text-foreground", className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} />
      {children}
    </span>
  );
}
