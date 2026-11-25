import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Primary and secondary actions, rendered on the right. */
  children?: ReactNode;
  /** Small label above the title (module or context). */
  eyebrow?: ReactNode;
  /** Optional row rendered under the description (filters, tabs, meta). */
  below?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, eyebrow, below, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-8 animate-rise", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
          <h1 className="text-[24px] leading-tight font-extrabold tracking-[-0.03em] text-foreground sm:text-[30px]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
      </div>
      {below && <div className="mt-5">{below}</div>}
    </header>
  );
}
