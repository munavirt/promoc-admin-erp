import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyIllustration } from "./illustrations";

interface EmptyStateProps {
  title: string;
  description: ReactNode;
  /** Small icon (legacy) — ignored when an illustration is supplied. */
  icon?: ReactNode;
  illustration?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ title, description, icon, illustration, action, className, compact }: EmptyStateProps) {
  const art =
    illustration ??
    (compact && icon ? (
      <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-brand-soft text-primary">{icon}</span>
    ) : (
      <EmptyIllustration className={compact ? "h-16 w-20" : "h-24 w-[120px]"} />
    ));
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-6 py-8" : "surface px-6 py-14",
        className,
      )}
    >
      <div className="mb-3">{art}</div>
      <h3 className="text-[14px] font-bold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
