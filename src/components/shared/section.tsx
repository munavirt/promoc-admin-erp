import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** "plain" sits on the canvas; "surface" places content on a floating white panel. */
  variant?: "plain" | "surface";
  bodyClassName?: string;
  id?: string;
}

export function Section({ title, description, action, children, className, variant = "plain", bodyClassName, id }: SectionProps) {
  const hasHeader = title || description || action;
  return (
    <section id={id} className={cn("min-w-0 animate-rise", className)}>
      {hasHeader && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn(variant === "surface" && "surface", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Floating white panel — the one surface primitive used across the workspace. */
export function Surface({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={cn("surface", hover && "surface-hover", className)}>{children}</div>;
}
