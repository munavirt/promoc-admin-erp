import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Download, Paperclip, Pencil, RefreshCcw } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { downloadProtectedFile, protectedFilePaths } from "@/infrastructure/protectedDownload";
import { FinanceSectionCard } from "../components/finance-form-shell";
import { FinanceGuard } from "../components/finance-guard";
import { MoneyDisplay } from "../components/money-display";
import { useExpense } from "../hooks/use-finance";
import { paymentMethodLabel } from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { formatFinanceDate, formatFinanceDateTime } from "../utils/formatters";

function fileName(url: string) {
  try {
    return decodeURIComponent(new URL(url, window.location.origin).pathname.split("/").pop() || url);
  } catch {
    return url;
  }
}

function ExpenseDetailContent({ permissions }: { permissions: FinancePermissions }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // GET /api/finance/expenses/{id}/
  const { data: expense, isLoading, isError, error, refetch, isFetching } = useExpense(id);

  if (isLoading) {
    return <div className="h-64 rounded-2xl bg-secondary/50 animate-pulse" />;
  }

  if (isError || !expense) {
    const notFound = (error as { status?: number | null } | null)?.status === 404 || !isError;
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-10 text-center shadow-sm">
        {!notFound && <AlertCircle className="mx-auto mb-2 h-7 w-7 text-red-400" />}
        <h2 className="text-lg font-semibold text-foreground">{notFound ? "Expense not found" : "Unable to load expense"}</h2>
        {!notFound && <p className="mt-1 text-[13px] text-muted-foreground">{extractApiErrorMessage(error, "Please try again.").message}</p>}
        <div className="mt-4 flex justify-center gap-2">
          {!notFound && (
            <Button variant="outline" className="rounded-xl gap-1.5" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Button asChild variant="outline" className="rounded-xl"><Link to="/finance/expenses">Back to Expenses</Link></Button>
        </div>
      </div>
    );
  }

  const receiptUrl = expense.receipt_file || null;
  const downloadReceipt = () => {
    if (!receiptUrl) return;
    downloadProtectedFile(protectedFilePaths.expenseReceipt(expense.id), fileName(receiptUrl)).catch((err) =>
      toast.error(extractApiErrorMessage(err, "The receipt could not be downloaded.").message),
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link to="/finance/expenses" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Expenses
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="font-mono text-xs font-medium text-muted-foreground">Expense #{expense.id}</span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">{expense.description}</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {expense.vendor_name ? `Paid to ${expense.vendor_name} on ` : "Paid on "}
              {formatFinanceDate(expense.expense_date)} · {expense.category_name}
            </p>
          </div>
          {permissions.canManageExpenses && (
            <Button variant="outline" className="h-10 gap-2 rounded-xl border-border/70" onClick={() => navigate(`/finance/expenses/${expense.id}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit Expense
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <FinanceSectionCard title="Expense Details">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 text-[13px]">
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="mt-1 text-lg font-bold text-foreground"><MoneyDisplay amount={Number(expense.amount)} showDecimals /></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Category</dt>
                <dd className="mt-1 font-medium text-foreground">{expense.category_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Vendor / Paid To</dt>
                <dd className="mt-1 font-medium text-foreground">{expense.vendor_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expense Date</dt>
                <dd className="mt-1 font-medium text-foreground">{formatFinanceDate(expense.expense_date)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Payment Method</dt>
                <dd className="mt-1 font-medium text-foreground">{paymentMethodLabel(expense.payment_method)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Transaction Reference</dt>
                <dd className="mt-1 font-mono font-medium text-foreground">{expense.reference_number || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Recorded By</dt>
                <dd className="mt-1 font-medium text-foreground">{expense.created_by_name || "—"}</dd>
              </div>
              {expense.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd className="mt-1 text-foreground whitespace-pre-line">{expense.notes}</dd>
                </div>
              )}
            </dl>
          </FinanceSectionCard>
        </div>

        <div className="space-y-6">
          <FinanceSectionCard title="Receipt Attachment">
            {receiptUrl ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-slate-50/60 p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Paperclip className="h-4 w-4" />
                  </div>
                  <p className="truncate text-[13px] font-medium text-foreground" title={fileName(receiptUrl)}>{fileName(receiptUrl)}</p>
                </div>
                <button type="button" onClick={downloadReceipt} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white hover:text-primary" title="Download receipt" aria-label="Download receipt">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">No receipt uploaded.</p>
            )}
          </FinanceSectionCard>

          <FinanceSectionCard title="Record">
            <dl className="space-y-4 text-[13px]">
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-1 font-medium text-foreground">{formatFinanceDateTime(expense.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last Updated</dt>
                <dd className="mt-1 font-medium text-foreground">{formatFinanceDateTime(expense.updated_at)}</dd>
              </div>
              <p className="text-[12px] text-muted-foreground">Expense records cannot be deleted; the backend keeps them for the financial audit trail.</p>
            </dl>
          </FinanceSectionCard>
        </div>
      </div>
    </div>
  );
}

export function ExpenseDetailPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <ExpenseDetailContent permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}
