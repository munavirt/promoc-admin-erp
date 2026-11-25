import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinancePermissions } from "../hooks/use-finance";
import type { FinancePermissions } from "../types/finance.types";

interface FinanceGuardProps {
  children: (permissions: FinancePermissions) => ReactNode;
}

export function FinanceGuard({ children }: FinanceGuardProps) {
  const { data, isLoading } = useFinancePermissions();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-56 rounded-xl bg-secondary/60 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-secondary/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.permissions.canViewFinance) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border/70 bg-white p-8 text-center shadow-sm mt-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Finance Access Restricted</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Your current role does not have permission to view agency financial records, invoices,
          or payment data.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children(data.permissions)}</>;
}
