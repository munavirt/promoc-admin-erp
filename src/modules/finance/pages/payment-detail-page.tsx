import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { ConfirmActionDialog } from "../components/confirm-action-dialog";
import { FinanceSectionCard, financeInputClass, financeSelectClass } from "../components/finance-form-shell";
import { FinanceGuard } from "../components/finance-guard";
import { AllocationStatusBadge, PaymentStatusBadge } from "../components/finance-status";
import { DetailLoadError } from "../components/finance-table-states";
import { MoneyDisplay } from "../components/money-display";
import { useIncomes } from "../hooks/use-finance";
import { useAllocatePayment, useEligibleInvoices, usePayment, useReverseAllocation, useVoidPayment } from "../hooks/use-invoices-payments";
import { paymentMethodLabel, type PaymentAllocationDTO } from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { isDecimal2, toCents } from "../utils/decimal";
import { formatFinanceDate, formatFinanceDateTime } from "../utils/formatters";

const money = (v: string) => <MoneyDisplay amount={Number(v)} showDecimals />;

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 font-medium text-foreground", mono && "font-mono")}>{children}</dd>
    </div>
  );
}

function AllocateForm({ paymentId, clientId, unallocated }: { paymentId: string; clientId: number; unallocated: string }) {
  const eligibleQuery = useEligibleInvoices(String(clientId));
  const allocate = useAllocatePayment();
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const eligible = eligibleQuery.data ?? [];
  const selected = eligible.find((i) => String(i.id) === invoiceId);

  const submit = async () => {
    if (allocate.isPending) return;
    const v = amount.trim();
    if (!selected) return setError("Select an invoice.");
    if (!isDecimal2(v) || (toCents(v) ?? 0n) <= 0n) return setError("Enter an amount greater than zero.");
    if ((toCents(v) ?? 0n) > (toCents(unallocated) ?? 0n)) return setError(`Exceeds the unallocated balance (${unallocated}).`);
    if ((toCents(v) ?? 0n) > (toCents(selected.outstanding_amount) ?? 0n)) return setError(`Exceeds the invoice outstanding (${selected.outstanding_amount}).`);
    setError(null);
    try {
      await allocate.mutateAsync({ paymentId, invoiceId: selected.id, amount: v });
      setInvoiceId("");
      setAmount("");
    } catch (err) {
      setError(extractApiErrorMessage(err, "Allocation failed.").message);
      void eligibleQuery.refetch();
    }
  };

  if (eligibleQuery.isLoading) return <div className="h-12 rounded-xl bg-secondary/50 animate-pulse" />;
  if (eligibleQuery.isError) return <p className="text-[13px] text-red-600">Unable to load invoices: {extractApiErrorMessage(eligibleQuery.error).message}</p>;
  if (eligible.length === 0) return <p className="text-[13px] text-muted-foreground">This client has no issued invoices with an outstanding balance. The balance stays as an advance.</p>;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} aria-label="Invoice to allocate to" className={cn(financeSelectClass(), "h-10 flex-1 min-w-[220px]")}>
          <option value="">Select issued invoice</option>
          {eligible.map((i) => <option key={i.id} value={String(i.id)}>{`${i.invoice_number} — outstanding ₹${i.outstanding_amount}`}</option>)}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" aria-label="Allocation amount" className={cn(financeInputClass(), "h-10 w-36 text-right tabular-nums")} />
        <Button type="button" className="h-10 rounded-xl" onClick={() => void submit()} disabled={allocate.isPending}>{allocate.isPending ? "Allocating…" : "Allocate"}</Button>
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}

function PaymentDetailContent({ permissions }: { permissions: FinancePermissions }) {
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading, isError, error, refetch } = usePayment(id);
  const voidMutation = useVoidPayment();
  const reverseMutation = useReverseAllocation();
  const [voidOpen, setVoidOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<PaymentAllocationDTO | null>(null);

  // Income list searched by payment number: shows the IncomeRecord Django generated for this payment.
  const incomeQuery = useIncomes({ search: p?.payment_number || undefined }, Boolean(p?.payment_number));
  const linkedIncome = useMemo(
    () => (incomeQuery.data?.results ?? []).filter((r) => r.is_payment_receipt && r.payment_number === p?.payment_number),
    [incomeQuery.data, p?.payment_number],
  );

  if (isLoading) return <div className="h-64 rounded-2xl bg-secondary/50 animate-pulse" />;
  if (isError || !p) {
    return (
      <DetailLoadError
        error={error}
        notFoundTitle="Payment not found"
        errorTitle="Unable to load payment"
        onRetry={() => void refetch()}
        back={<Button asChild variant="outline" className="rounded-xl"><Link to="/finance/payments">Back to Payments</Link></Button>}
      />
    );
  }

  const confirmed = p.status === "CONFIRMED";
  const active = p.allocations.filter((a) => a.status === "ACTIVE");
  const hasUnallocated = confirmed && Number(p.unallocated_amount) > 0;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link to="/finance/payments" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Payments
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium text-muted-foreground">Payment</span>
              <PaymentStatusBadge status={p.status} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1 font-mono">{p.payment_number}</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">{p.client_name} · {formatFinanceDate(p.payment_date)} · {paymentMethodLabel(p.payment_method)}</p>
          </div>
          {permissions.canRecordPayments && confirmed && (
            <Button variant="outline" className="h-10 gap-2 rounded-xl border-border/70 text-rose-700 hover:text-rose-800" onClick={() => setVoidOpen(true)}>
              <Ban className="h-4 w-4" /> Void Payment
            </Button>
          )}
        </div>
      </div>

      {!confirmed && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 px-5 py-3.5 text-[13px] text-rose-900">
          Voided {formatFinanceDateTime(p.voided_at ?? undefined)}{p.void_reason ? ` — “${p.void_reason}”` : ""}. Its allocations were reversed and its income record was removed by the backend. Voided payments are kept for audit and can't be changed.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <FinanceSectionCard title="Payment Details">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 text-[13px]">
              <Row label="Amount"><span className="text-lg font-bold">{money(p.amount)}</span></Row>
              <Row label="Client">{p.client_name}</Row>
              <Row label="Payment Date">{formatFinanceDate(p.payment_date)}</Row>
              <Row label="Payment Method">{paymentMethodLabel(p.payment_method)}</Row>
              <Row label="Transaction Reference" mono>{p.reference_number || "—"}</Row>
              <Row label="Recorded By">{p.created_by_name || "—"}</Row>
              {p.notes && <div className="sm:col-span-2"><dt className="text-muted-foreground">Notes</dt><dd className="mt-1 whitespace-pre-line text-foreground">{p.notes}</dd></div>}
            </dl>
          </FinanceSectionCard>

          <FinanceSectionCard title="Allocations" subtitle="How this payment was applied to invoices (history is kept)">
            {p.allocations.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Not allocated to any invoice.</p>
            ) : (
              <ul className="divide-y divide-border/50 text-[13px]">
                {p.allocations.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/finance/invoices/${a.invoice}`} className="font-mono font-medium text-primary hover:underline">{a.invoice_number}</Link>
                        <AllocationStatusBadge status={a.status} />
                      </div>
                      <p className="text-[12px] text-muted-foreground">
                        Allocated {formatFinanceDateTime(a.allocated_at)}{a.created_by_name ? ` by ${a.created_by_name}` : ""}
                        {a.status === "REVERSED" && ` · reversed ${formatFinanceDateTime(a.reversed_at ?? undefined)}${a.reversed_by_name ? ` by ${a.reversed_by_name}` : ""}${a.reversal_reason ? ` — ${a.reversal_reason}` : ""}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-semibold", a.status === "REVERSED" ? "line-through text-muted-foreground" : "text-emerald-700")}>{money(a.allocated_amount)}</span>
                      {permissions.canAllocateAdvances && confirmed && a.status === "ACTIVE" && (
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-[12px]" onClick={() => setReverseTarget(a)}>
                          <Undo2 className="h-3.5 w-3.5" /> Reverse
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {permissions.canAllocateAdvances && hasUnallocated && (
              <div className="mt-5 border-t border-border/60 pt-5">
                <p className="mb-2 text-[13px] font-medium text-foreground">Allocate the unallocated balance ({money(p.unallocated_amount)})</p>
                <AllocateForm paymentId={p.id} clientId={p.client} unallocated={p.unallocated_amount} />
              </div>
            )}
          </FinanceSectionCard>
        </div>

        <div className="space-y-6">
          <FinanceSectionCard title="Balance">
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Payment amount</span>{money(p.amount)}</div>
              <div className="flex justify-between"><span className="text-muted-foreground">Allocated ({active.length})</span><span className="text-emerald-700">{money(p.allocated_amount)}</span></div>
              <div className="flex justify-between border-t border-border/60 pt-2 font-semibold"><span>Unallocated</span><span className={hasUnallocated ? "text-amber-700" : ""}>{money(p.unallocated_amount)}</span></div>
              <p className="pt-1 text-[11.5px] text-muted-foreground">From the backend. A voided payment has no allocated or unallocated balance.</p>
            </div>
          </FinanceSectionCard>

          <FinanceSectionCard title="Income Record" subtitle="Created by the backend for this payment">
            {incomeQuery.isLoading ? (
              <div className="h-10 rounded-lg bg-secondary/50 animate-pulse" />
            ) : incomeQuery.isError ? (
              <p className="text-[13px] text-red-600">{extractApiErrorMessage(incomeQuery.error).message}</p>
            ) : linkedIncome.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{confirmed ? "No linked income record was found." : "Removed when the payment was voided."}</p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {linkedIncome.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link to={`/finance/income/${r.id}`} className="font-medium text-primary hover:underline">Income #{r.id}</Link>
                    {money(r.amount)}
                  </li>
                ))}
                {linkedIncome.length > 1 && <li className="text-[12px] text-red-600">More than one income record references this payment — please report this.</li>}
              </ul>
            )}
          </FinanceSectionCard>

          <FinanceSectionCard title="Record">
            <dl className="space-y-3 text-[13px]">
              <Row label="Created">{formatFinanceDateTime(p.created_at)}</Row>
              <Row label="Last updated">{formatFinanceDateTime(p.updated_at)}</Row>
            </dl>
          </FinanceSectionCard>
        </div>
      </div>

      <ConfirmActionDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title={`Void payment ${p.payment_number}?`}
        description={<>This marks the payment of <strong>{money(p.amount)}</strong> from {p.client_name} as voided.</>}
        consequences={[
          `All ${active.length} active allocation(s) are reversed; the invoices' outstanding balances go back up.`,
          "The income record the backend created for this payment is deleted, so income, overview and reports drop by this amount.",
          "Voiding is permanent. The payment stays visible as a voided audit record and can't be reactivated.",
        ]}
        confirmLabel="Void Payment"
        destructive
        reason={{ label: "Reason for voiding", required: true, maxLength: 500, placeholder: "e.g. Cheque bounced" }}
        onConfirm={async (reason) => {
          try {
            await voidMutation.mutateAsync({ id: p.id, reason });
          } catch (err) {
            throw new Error(extractApiErrorMessage(err, "Could not void the payment.").message);
          }
        }}
      />
      <ConfirmActionDialog
        open={Boolean(reverseTarget)}
        onOpenChange={(o) => !o && setReverseTarget(null)}
        title={`Reverse allocation to ${reverseTarget?.invoice_number ?? ""}?`}
        description={<>The {reverseTarget ? money(reverseTarget.allocated_amount) : ""} returns to this payment's unallocated balance and the invoice's outstanding amount increases.</>}
        consequences={["The payment itself and its income record are not changed.", "The reversed allocation stays in the history; it can't be reactivated (allocate again instead)."]}
        confirmLabel="Reverse Allocation"
        destructive
        reason={{ label: "Reason (optional)", required: false, maxLength: 500 }}
        onConfirm={async (reason) => {
          if (!reverseTarget) return;
          try {
            await reverseMutation.mutateAsync({ paymentId: p.id, allocationId: reverseTarget.id, reason: reason || undefined });
          } catch (err) {
            toast.error(extractApiErrorMessage(err, "Could not reverse the allocation.").message);
            throw new Error(extractApiErrorMessage(err, "Could not reverse the allocation.").message);
          }
        }}
      />
    </div>
  );
}

export function PaymentDetailPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <PaymentDetailContent permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}
