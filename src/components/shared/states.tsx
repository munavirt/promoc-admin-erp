import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "This view couldn't load",
  description = "Something went wrong while fetching data. Try again in a moment.",
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-[16px] bg-negative-soft px-5 py-4", className)}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
        <div>
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>
        </div>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="ml-6.5 gap-1.5">
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <span className={cn("skeleton block h-4", className)} aria-hidden />;
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-hairline", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <SkeletonBlock className="h-3.5 w-1/3" />
          <SkeletonBlock className="h-3.5 w-1/5" />
          <SkeletonBlock className="ml-auto h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}
