import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FinancePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function FinancePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  className,
}: FinancePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  const pages: number[] = [];
  const windowStart = Math.max(1, safePage - 1);
  const windowEnd = Math.min(totalPages, safePage + 1);

  if (windowStart > 1) pages.push(1);
  if (windowStart > 2) pages.push(-1);
  for (let p = windowStart; p <= windowEnd; p += 1) {
    pages.push(p);
  }
  if (windowEnd < totalPages - 1) pages.push(-2);
  if (windowEnd < totalPages) pages.push(totalPages);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-slate-50/40 px-5 py-3 text-[12px]",
        className,
      )}
    >
      <p className="text-muted-foreground tabular-nums">
        Showing <span className="font-semibold text-foreground">{startItem}</span>–
        <span className="font-semibold text-foreground">{endItem}</span> of{" "}
        <span className="font-semibold text-foreground">{totalItems}</span>
      </p>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="h-8 w-8 p-0 rounded-lg"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((p, idx) =>
          p < 0 ? (
            <span key={`ellipsis-${idx}`} className="px-1.5 text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              type="button"
              variant={p === safePage ? "default" : "ghost"}
              size="sm"
              onClick={() => onPageChange(p)}
              className={cn(
                "h-8 min-w-8 px-2.5 rounded-lg text-[12px] font-medium tabular-nums",
                p === safePage ? "shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="h-8 w-8 p-0 rounded-lg"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
