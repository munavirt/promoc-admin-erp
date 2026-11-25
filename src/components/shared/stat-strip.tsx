import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconTile, type Pastel } from "./icon-tile";
import { SkeletonBlock } from "./states";

export interface StatItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Pastel;
  /** Renders the value in the negative tone (e.g. overdue counts). */
  alert?: boolean;
  onClick?: () => void;
}

function Cell({ item, children, className }: { item: StatItem; children: ReactNode; className?: string }) {
  return item.onClick ? (
    <button type="button" onClick={item.onClick} className={cn("text-left transition-colors hover:bg-[#f8faff]", className)}>
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
}

/**
 * One floating surface holding a page's headline figures. The first item leads on a soft blue
 * panel; the rest sit quietly beside it — avoiding rows of identical KPI cards.
 */
export function StatStrip({ items, loading, className }: { items: StatItem[]; loading?: boolean; className?: string }) {
  const [lead, ...rest] = items;

  return (
    <div className={cn("surface mb-6 grid animate-rise grid-cols-1 gap-1.5 p-1.5 sm:grid-cols-2 lg:grid-cols-[1.25fr_repeat(var(--n),minmax(0,1fr))] [&>*:first-child]:sm:col-span-2 [&>*:first-child]:lg:col-span-1", className)} style={{ ["--n" as string]: rest.length }}>
      {lead && (
        <Cell item={lead} className="flex items-center gap-4 rounded-[16px] bg-gradient-to-br from-[#f2f7ff] to-[#e8f1ff] p-4">
          <IconTile icon={lead.icon} tone={lead.tone ?? "blue"} size="lg" className="bg-white" />
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-[#004fcc]">{lead.label}</div>
            {loading ? <SkeletonBlock className="mt-1.5 h-8 w-16" /> : <div className="figure text-[30px] leading-tight font-extrabold tracking-[-0.03em] text-foreground">{lead.value}</div>}
            {lead.hint && <div className="truncate text-[11.5px] font-medium text-subtle">{lead.hint}</div>}
          </div>
        </Cell>
      )}
      {rest.map((item) => (
        <Cell key={item.label} item={item} className="flex items-center gap-3 rounded-[16px] p-4">
          <IconTile icon={item.icon} tone={item.tone ?? "blue"} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-muted-foreground">{item.label}</div>
            {loading ? (
              <SkeletonBlock className="mt-1 h-6 w-12" />
            ) : (
              <div className={cn("figure text-[22px] leading-tight font-extrabold", item.alert ? "text-negative" : "text-foreground")}>{item.value}</div>
            )}
            {item.hint && <div className="truncate text-[11.5px] font-medium text-subtle">{item.hint}</div>}
          </div>
        </Cell>
      ))}
    </div>
  );
}
