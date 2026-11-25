import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Pencil, RefreshCcw } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { FinanceSectionCard } from "../components/finance-form-shell";
import { FinanceGuard } from "../components/finance-guard";
import { MoneyDisplay } from "../components/money-display";
import { useIncome } from "../hooks/use-finance";
import { paymentMethodLabel } from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { formatFinanceDate, formatFinanceDateTime } from "../utils/formatters";

function IncomeDetailContent({ permissions }: { permissions: FinancePermissions }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // GET /api/finance/income/{id}/
  const { data: income, isLoading, isError, error, refetch, isFetching } = useIncome(id);

  if (isLoading) {
    return <div className="h-64 rounded-2xl bg-secondary/50 animate-pulse" />;
  }

  if (isError || !income) {
    const notFound = (error as { status?: number | null } | null)?.status === 404 || !isError;
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-10 text-center shadow-sm">
        {!notFound && <AlertCircle className="mx-auto mb-2 h-7 w-7 text-red-400" />}
        <h2 className="text-lg font-semibold text-foreground">{notFound ? "Income record not found" : "Unable to load income record"}</h2>
        {!notFound && <p className="mt-1 text-[13px] text-muted-foreground">{extractApiErrorMessage(error, "Please try again.").message}</p>}
        <div className="mt-4 flex justify-center gap-2">
          {!notFound && (
            <Button variant="outline" className="rounded-xl gap-1.5" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/finance/income">Back to Income</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link to="/finance/income" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Income
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-medium text-muted-foreground">Income #{income.id}</span>
              {income.is_payment_receipt && (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                  From client payment{income.payment_number ? ` ${income.payment_number}` : ""}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">{income.description}</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Received on {formatFinanceDate(income.received_date)} · {income.category_name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {permissions.canManageIncome && !income.is_payment_receipt && (
              <Button variant="outline" className="h-10 gap-2 rounded-xl border-border/70" onClick={() => navigate(`/finance/income/${income.id}/edit`)}>
                <Pencil className="h-4 w-4" />
                Edit Income
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <FinanceSectionCard title="Transaction Details">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 text-[13px]">
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="mt-1 text-lg font-bold text-emerald-700"><MoneyDisplay amount={Number(income.amount)} showDecimals /></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Category</dt>
                <dd className="mt-1 font-medium text-foreground">{income.category_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Received Date</dt>
                <dd className="mt-1 font-medium text-foreground">{formatFinanceDate(income.received_date)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Payment Method</dt>
                <dd className="mt-1 font-medium text-foreground">{paymentMethodLabel(income.payment_method)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Transaction Reference</dt>
                <dd className="mt-1 font-mono font-medium text-foreground">{income.reference_number || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Recorded By</dt>
                <dd className="mt-1 font-medium text-foreground">{income.created_by_name || "—"}</dd>
              </div>
              {income.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="mt-1 text-foreground whitespace-pre-line">{income.notes}</dd>
                </div>
              )}
            </dl>
          </FinanceSectionCard>
        </div>

        <div className="space-y-6">
          <FinanceSectionCard title="Record">
            <dl className="space-y-4 text-[13px]">
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-1 font-medium text-foreground">{formatFinanceDateTime(income.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last Updated</dt>
                <dd className="mt-1 font-medium text-foreground">{formatFinanceDateTime(income.updated_at)}</dd>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Income records cannot be deleted; the backend keeps them for the financial audit trail.
              </p>
            </dl>
          </FinanceSectionCard>
        </div>
      </div>
    </div>
  );
}

export function IncomeDetailPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <IncomeDetailContent permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}
