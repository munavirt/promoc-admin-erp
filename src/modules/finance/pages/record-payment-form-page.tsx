import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { AlertCircle, Calendar, ChevronDown, Hash, IndianRupee, Info, RefreshCcw } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import {
  FinanceBackHeader,
  FinanceField,
  FinanceFixedFooter,
  FinanceLeadIcon,
  FinanceSectionCard,
  financeInputClass,
  financeSelectClass,
  financeTextareaClass,
} from "../components/finance-form-shell";
import { FinanceGuard } from "../components/finance-guard";
import { InvoicePaymentBadge } from "../components/finance-status";
import { MoneyDisplay } from "../components/money-display";
import { useCreatePayment, useEligibleInvoices, useFinanceClients } from "../hooks/use-invoices-payments";
import { BACKEND_PAYMENT_METHODS, paymentMethodLabel, type BackendPaymentMethod, type PaymentCreatePayload } from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { centsToDecimal, centsToNumber, isDecimal2, sumCents, toCents } from "../utils/decimal";
import { formatFinanceDate, getTodayISO } from "../utils/formatters";
import { newIdempotencyKey } from "../utils/idempotency";

/* PaymentSerializer (writable): client, amount (>0, Decimal 14,2), payment_date, payment_method, reference_number ≤100,
 * notes, initial_allocations[{invoice, amount}]. No bank account field exists — and none is needed. */
const schema = z.object({
  client: z.string().min(1, "Select a client"),
  amount: z.string().trim()
    .refine((v) => isDecimal2(v) && v.split(".")[0].length <= 12, "Enter an amount with up to 2 decimals")
    .refine((v) => (toCents(v) ?? 0n) > 0n, "Amount must be greater than zero"),
  payment_date: z.string().min(1, "Payment date is required"),
  payment_method: z.enum(BACKEND_PAYMENT_METHODS as [BackendPaymentMethod, ...BackendPaymentMethod[]]),
  reference_number: z.string().trim().max(100, "Max 100 characters"),
  notes: z.string(),
});
type FormValues = z.infer<typeof schema>;
const FORM_FIELDS = new Set(Object.keys(schema.shape));

function RecordPaymentInner({ permissions }: { permissions: FinancePermissions }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetInvoice = searchParams.get("invoice");
  const clientsQuery = useFinanceClients();
  const createMutation = useCreatePayment();
  // One key per payment being recorded: retries and double clicks reuse it, so the backend
  // records the payment at most once. A new key is generated only after a successful save.
  const idempotencyKeyRef = useRef(newIdempotencyKey());

  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client: searchParams.get("client") ?? "",
      amount: "",
      payment_date: getTodayISO(),
      payment_method: "BANK_TRANSFER",
      reference_number: "",
      notes: "",
    },
  });
  const clientId = useWatch({ control, name: "client" });
  const amountStr = useWatch({ control, name: "amount" });
  const eligibleQuery = useEligibleInvoices(clientId || undefined);
  const eligible = useMemo(() => eligibleQuery.data ?? [], [eligibleQuery.data]);

  /** invoiceId → allocation amount string, for selected invoices only. */
  const [alloc, setAlloc] = useState<Record<number, string>>({});
  const [allocErrors, setAllocErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Changing the client clears allocations (backend requires invoice.client == payment.client).
  const lastClient = useRef(clientId);
  useEffect(() => {
    if (lastClient.current !== clientId) {
      setAlloc({});
      setAllocErrors({});
      lastClient.current = clientId;
    }
  }, [clientId]);

  // Pre-select the invoice the user came from (Record Payment on an invoice page).
  const presetApplied = useRef(false);
  useEffect(() => {
    if (presetApplied.current || !presetInvoice || !eligibleQuery.data) return;
    const inv = eligibleQuery.data.find((i) => String(i.id) === presetInvoice);
    if (inv) setAlloc({ [inv.id]: inv.outstanding_amount });
    presetApplied.current = true;
  }, [presetInvoice, eligibleQuery.data]);

  const amountCents = isDecimal2(amountStr || "") ? toCents(amountStr) : null;
  const allocatedCents = sumCents(Object.values(alloc).map((v) => (isDecimal2(v) ? toCents(v) : 0n)));
  const remainingCents = amountCents !== null ? amountCents - allocatedCents : null;

  if (!permissions.canRecordPayments) {
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-8 text-center shadow-sm">
        <p className="text-[14px] font-medium text-foreground">You do not have permission to record payments.</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/finance/payments")}>Back to Payments</Button>
      </div>
    );
  }

  const toggle = (invoiceId: number, on: boolean) => {
    setAlloc((a) => {
      const next = { ...a };
      if (on) next[invoiceId] = "";
      else delete next[invoiceId];
      return next;
    });
    setAllocErrors((e) => {
      const next = { ...e };
      delete next[invoiceId];
      return next;
    });
  };

  /** Fills an allocation with min(outstanding, what's left of the payment). */
  const fillMax = (invoiceId: number, outstanding: string) => {
    const out = toCents(outstanding) ?? 0n;
    const othersCents = sumCents(Object.entries(alloc).filter(([k]) => Number(k) !== invoiceId).map(([, v]) => (isDecimal2(v) ? toCents(v) : 0n)));
    const left = amountCents !== null ? amountCents - othersCents : out;
    const value = left > 0n ? (left < out ? left : out) : out;
    setAlloc((a) => ({ ...a, [invoiceId]: centsToDecimal(value) }));
  };

  /** UI feedback only; the backend re-validates every allocation (outstanding, client, ISSUED, total ≤ amount). */
  const validateAllocations = (): boolean => {
    const errs: Record<number, string> = {};
    for (const [key, raw] of Object.entries(alloc)) {
      const invId = Number(key);
      const inv = eligible.find((i) => i.id === invId);
      const v = raw.trim();
      if (!inv) { errs[invId] = "This invoice is no longer eligible. Refresh the list."; continue; }
      if (!isDecimal2(v) || (toCents(v) ?? 0n) <= 0n) { errs[invId] = "Enter an amount greater than zero"; continue; }
      if ((toCents(v) ?? 0n) > (toCents(inv.outstanding_amount) ?? 0n)) errs[invId] = `Exceeds outstanding ${inv.outstanding_amount}`;
    }
    setAllocErrors(errs);
    if (Object.keys(errs).length) return false;
    if (amountCents !== null && allocatedCents > amountCents) {
      setFormError(`Allocations (${centsToDecimal(allocatedCents)}) exceed the payment amount (${centsToDecimal(amountCents)}).`);
      return false;
    }
    setFormError(null);
    return true;
  };

  const onSubmit = async (values: FormValues) => {
    if (!validateAllocations()) return;
    const payload: PaymentCreatePayload = {
      client: Number(values.client),
      amount: values.amount.trim(),
      payment_date: values.payment_date,
      payment_method: values.payment_method,
      reference_number: values.reference_number.trim(),
      notes: values.notes.trim(),
      initial_allocations: Object.entries(alloc).map(([invoice, amount]) => ({ invoice: Number(invoice), amount: amount.trim() })),
    };
    try {
      const saved = await createMutation.mutateAsync({ payload, idempotencyKey: idempotencyKeyRef.current });
      idempotencyKeyRef.current = newIdempotencyKey();
      navigate(`/finance/payments/${saved.id}`);
    } catch (err) {
      const { message, fieldErrors } = extractApiErrorMessage(err, "Failed to record payment.");
      let mapped = false;
      const other: string[] = [];
      for (const [k, msgs] of Object.entries(fieldErrors ?? {})) {
        if (!msgs.length) continue;
        if (FORM_FIELDS.has(k)) {
          setError(k as keyof FormValues, { type: "server", message: msgs[0] });
          mapped = true;
        } else other.push(msgs[0]);
      }
      const msg = other.length ? other.join(" · ") : mapped ? "Please correct the highlighted fields." : message;
      setFormError(other.length || !mapped ? msg : null);
      toast.error(msg);
      // Balances may have changed (another payment) — refetch the backend's outstanding amounts.
      void eligibleQuery.refetch();
    }
  };

  const isPending = isSubmitting || createMutation.isPending;
  const clients = clientsQuery.data ?? [];
  const clientHint = clientsQuery.isError
    ? `Clients could not be loaded: ${extractApiErrorMessage(clientsQuery.error).message}`
    : !clientsQuery.isLoading && clients.length === 0
      ? "No active clients exist. Add a client first."
      : undefined;

  return (
    <div>
      <FinanceBackHeader backTo="/finance/payments" backLabel="Back to Payments" title="Record Payment" description="Record money received from a client and optionally allocate it to issued invoices." />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 pb-24">
        <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 px-5 py-4 text-[13px] text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Saving a payment is permanent: the backend assigns the payment number and <strong>automatically creates one income record</strong> for it
            (don't add it again under Income). Payments can't be deleted; a mistake is corrected by voiding the payment, which also removes that income record.
          </p>
        </div>

        <FinanceSectionCard title="Payment Details" subtitle="Who paid, how much, and how">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FinanceField label="Client" required error={errors.client?.message ?? clientHint} className="md:col-span-2">
              <div className="relative">
                <select {...register("client")} aria-label="Client" disabled={clientsQuery.isLoading || clients.length === 0} className={financeSelectClass(errors.client?.message ?? clientHint)}>
                  <option value="">{clientsQuery.isLoading ? "Loading clients..." : "Select client"}</option>
                  {clients.map((c) => <option key={c.id} value={String(c.id)}>{c.company_name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </FinanceField>
            <FinanceField label="Amount Received (INR)" required error={errors.amount?.message}>
              <div className="relative">
                <FinanceLeadIcon><IndianRupee className="h-4 w-4" /></FinanceLeadIcon>
                <input {...register("amount")} inputMode="decimal" aria-label="Amount" placeholder="0.00" className={`${financeInputClass(errors.amount?.message)} pl-10 tabular-nums`} />
              </div>
            </FinanceField>
            <FinanceField label="Payment Date" required error={errors.payment_date?.message}>
              <div className="relative">
                <FinanceLeadIcon><Calendar className="h-4 w-4" /></FinanceLeadIcon>
                <input type="date" aria-label="Payment date" {...register("payment_date")} className={`${financeInputClass(errors.payment_date?.message)} pl-10`} />
              </div>
            </FinanceField>
            <FinanceField label="Payment Method" required error={errors.payment_method?.message}>
              <div className="relative">
                <select {...register("payment_method")} aria-label="Payment method" className={financeSelectClass(errors.payment_method?.message)}>
                  {BACKEND_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </FinanceField>
            <FinanceField label="Transaction Reference (Optional)" error={errors.reference_number?.message}>
              <div className="relative">
                <FinanceLeadIcon><Hash className="h-4 w-4" /></FinanceLeadIcon>
                <input {...register("reference_number")} maxLength={100} aria-label="Transaction reference" placeholder="UTR / cheque no. / UPI ref" className={`${financeInputClass(errors.reference_number?.message)} pl-10`} />
              </div>
            </FinanceField>
            <FinanceField label="Notes" error={errors.notes?.message} className="md:col-span-2">
              <textarea rows={2} aria-label="Notes" {...register("notes")} className={financeTextareaClass()} placeholder="Internal notes (optional)" />
            </FinanceField>
          </div>
        </FinanceSectionCard>

        <FinanceSectionCard
          title="Allocate to Invoices"
          subtitle="Optional. Anything not allocated stays on the payment as an advance you can allocate later."
          action={clientId ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => void eligibleQuery.refetch()} disabled={eligibleQuery.isFetching}>
              <RefreshCcw className={cn("h-3.5 w-3.5", eligibleQuery.isFetching && "animate-spin")} /> Refresh balances
            </Button>
          ) : undefined}
        >
          {!clientId ? (
            <p className="text-[13px] text-muted-foreground">Select a client to see their issued invoices with an outstanding balance.</p>
          ) : eligibleQuery.isLoading ? (
            <div className="h-24 rounded-xl bg-secondary/50 animate-pulse" />
          ) : eligibleQuery.isError ? (
            <div className="flex items-center gap-2 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4" /> Unable to load invoices: {extractApiErrorMessage(eligibleQuery.error).message}
            </div>
          ) : eligible.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">This client has no issued invoices with an outstanding balance. The full amount will be kept as an unallocated advance.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border/60 bg-slate-50/80">
                    <th className="h-10 w-10 px-6" />
                    {["Invoice", "Due"].map((h) => <th key={h} className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>)}
                    {["Total", "Paid", "Outstanding"].map((h) => <th key={h} className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>)}
                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="h-10 px-6 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Allocate (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {eligible.map((inv) => {
                    const selected = inv.id in alloc;
                    return (
                      <tr key={inv.id} className={selected ? "bg-blue-50/40" : undefined}>
                        <td className="px-6 py-3">
                          <input type="checkbox" checked={selected} onChange={(e) => toggle(inv.id, e.target.checked)} aria-label={`Allocate to ${inv.invoice_number}`} className="h-4 w-4 accent-primary" />
                        </td>
                        <td className="px-3 py-3 font-mono text-[12px] font-medium">{inv.invoice_number}</td>
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{formatFinanceDate(inv.due_date ?? undefined)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap"><MoneyDisplay amount={Number(inv.total_amount)} showDecimals /></td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-emerald-700"><MoneyDisplay amount={Number(inv.total_paid)} showDecimals /></td>
                        <td className="px-3 py-3 text-right whitespace-nowrap font-semibold text-amber-700"><MoneyDisplay amount={Number(inv.outstanding_amount)} showDecimals /></td>
                        <td className="px-3 py-3"><InvoicePaymentBadge status={inv.payment_status} invoiceStatus={inv.status} /></td>
                        <td className="px-6 py-3">
                          {selected && (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1.5">
                                <input
                                  value={alloc[inv.id]}
                                  onChange={(e) => setAlloc((a) => ({ ...a, [inv.id]: e.target.value }))}
                                  inputMode="decimal"
                                  aria-label={`Allocation amount for ${inv.invoice_number}`}
                                  placeholder="0.00"
                                  className={cn(financeInputClass(allocErrors[inv.id]), "h-9 w-32 text-right tabular-nums")}
                                />
                                <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg px-2.5 text-[11.5px]" onClick={() => fillMax(inv.id, inv.outstanding_amount)}>Max</Button>
                              </div>
                              {allocErrors[inv.id] && <p className="text-[11px] text-red-500">{allocErrors[inv.id]}</p>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 ml-auto w-full max-w-sm space-y-1.5 rounded-xl border border-border/70 bg-white p-4 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Payment amount</span><span>{amountCents !== null ? <MoneyDisplay amount={centsToNumber(amountCents)} showDecimals /> : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Allocated to invoices</span><MoneyDisplay amount={centsToNumber(allocatedCents)} showDecimals /></div>
            <div className={cn("flex justify-between font-semibold", remainingCents !== null && remainingCents < 0n && "text-red-600")}>
              <span>Unallocated (advance)</span>
              <span>{remainingCents !== null ? <MoneyDisplay amount={centsToNumber(remainingCents)} showDecimals /> : "—"}</span>
            </div>
            {remainingCents !== null && remainingCents < 0n && <p className="text-[11.5px] text-red-600">Allocations exceed the payment amount.</p>}
          </div>
          {formError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{formError}</p>}
        </FinanceSectionCard>

        <FinanceFixedFooter onCancel={() => navigate("/finance/payments")} submitLabel="Record Payment" isSubmitting={isPending} />
      </form>
    </div>
  );
}

export function RecordPaymentFormPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <RecordPaymentInner permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}
