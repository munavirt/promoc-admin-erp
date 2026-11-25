import type { ElementType } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";

/** Loading / error / empty table rows matching the Phase 4 Income & Expense tables. */
export function TableLoadingRows({ colSpan, rows = 4 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={colSpan} className="h-14 px-5">
            <div className="h-4 w-full rounded bg-secondary/50 animate-pulse" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function TableErrorRow({ colSpan, title, error, onRetry }: { colSpan: number; title: string; error: unknown; onRetry: () => void }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-14 text-center">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="h-7 w-7 text-red-400" />
          <p className="text-[14px] font-medium text-foreground">{title}</p>
          <p className="text-[12px] text-muted-foreground">{extractApiErrorMessage(error, "Please try again.").message}</p>
          <Button size="sm" variant="outline" className="mt-1 h-8 gap-1.5 text-xs" onClick={onRetry}>
            <RefreshCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function TableEmptyRow({ colSpan, icon: Icon, title, hint }: { colSpan: number; icon: ElementType; title: string; hint: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-16 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-[14px] font-medium text-foreground">{title}</p>
          <p className="text-[12px] text-muted-foreground">{hint}</p>
        </div>
      </td>
    </tr>
  );
}

/** Full-card error with retry, for detail pages. 404 renders as "not found". */
export function DetailLoadError({ error, notFoundTitle, errorTitle, onRetry, back }: {
  error: unknown;
  notFoundTitle: string;
  errorTitle: string;
  onRetry: () => void;
  back: React.ReactNode;
}) {
  const status = (error as { status?: number | null } | null)?.status;
  const notFound = status === 404 || !error;
  const forbidden = status === 403;
  return (
    <div className="rounded-2xl border border-border/70 bg-white p-10 text-center shadow-sm">
      {!notFound && <AlertCircle className="mx-auto mb-2 h-7 w-7 text-red-400" />}
      <h2 className="text-lg font-semibold text-foreground">{notFound ? notFoundTitle : forbidden ? "Access denied" : errorTitle}</h2>
      {!notFound && <p className="mt-1 text-[13px] text-muted-foreground">{extractApiErrorMessage(error, "Please try again.").message}</p>}
      <div className="mt-4 flex justify-center gap-2">
        {!notFound && !forbidden && (
          <Button variant="outline" className="rounded-xl gap-1.5" onClick={onRetry}>
            <RefreshCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
        {back}
      </div>
    </div>
  );
}
