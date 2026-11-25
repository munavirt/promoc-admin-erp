import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Download, Loader2, Lock, Pencil, Send, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { financeApiService } from "@/services/api/finance.service";
import { ConfirmActionDialog } from "../components/confirm-action-dialog";
import { FinanceSectionCard } from "../components/finance-form-shell";
import { FinanceGuard } from "../components/finance-guard";
import { InvoicePaymentBadge, InvoiceStatusBadge } from "../components/finance-status";
import { DetailLoadError } from "../components/finance-table-states";
import { MoneyDisplay } from "../components/money-display";
import { useCancelInvoice, useDeleteDraftInvoice, useInvoice, useIssueInvoice } from "../hooks/use-invoices-payments";
import { paymentMethodLabel } from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { formatFinanceDate, formatFinanceDateTime } from "../utils/formatters";
import { saveDownloadedFile } from "../utils/save-file";

const money = (v: string) => <MoneyDisplay amount={Number(v)} showDecimals />;

function TotalsRow({ label, value, strong, muted }: { label: string; value: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-semibold text-foreground" : muted ? "text-muted-foreground" : "text-foreground"}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function snap(obj: Record<string, unknown>, key: string): string {
  const v = obj?.[key];
  return typeof v === "string" ? v : "";
}

function InvoiceDetailContent({ permissions }: { permissions: FinancePermissions }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: inv, isLoading, isError, error, refetch } = useInvoice(id);
  const issueMutation = useIssueInvoice();
  const cancelMutation = useCancelInvoice();
  const deleteMutation = useDeleteDraftInvoice();
  const [dialog, setDialog] = useState<null | "issue" | "cancel" | "delete">(null);
  const [downloading, setDownloading] = useState(false);

  if (isLoading) return <div className="h-64 rounded-2xl bg-secondary/50 animate-pulse" />;
  if (isError || !inv) {
    return (
      <DetailLoadError
        error={error}
        notFoundTitle="Invoice not found"
        errorTitle="Unable to load invoice"
        onRetry={() => void refetch()}
        back={<Button asChild variant="outline" className="rounded-xl"><Link to="/finance/invoices">Back to Invoices</Link></Button>}
      />
    );
  }

  const isDraft = inv.status === "DRAFT";
  const isIssued = inv.status === "ISSUED";
  const hasActiveAllocations = inv.payment_history.length > 0;
  const outstanding = Number(inv.outstanding_amount);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      saveDownloadedFile(await financeApiService.downloadInvoicePdf(inv));
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Could not download the invoice PDF.").message);
    } finally {
      setDownloading(false);
    }
  };

  // Issued invoices show the frozen snapshot; drafts show the live client record.
  const cs = inv.client_snapshot ?? {};
  const billedName = (isDraft ? inv.client_name : snap(cs, "company_name")) || inv.client_name;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link to="/finance/invoices" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Invoices
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-muted-foreground">Invoice</span>
              <InvoiceStatusBadge status={inv.status} />
              <InvoicePaymentBadge status={inv.payment_status} invoiceStatus={inv.status} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1 font-mono">{inv.invoice_number}</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {inv.client_name} · Issued {formatFinanceDate(inv.issue_date)}
              {inv.due_date ? ` · Due ${formatFinanceDate(inv.due_date)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-10 gap-2 rounded-xl border-border/70" onClick={() => void downloadPdf()} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDraft ? "Draft PDF" : "Download PDF"}
            </Button>
            {permissions.canCreateInvoices && isDraft && (
              <Button variant="outline" className="h-10 gap-2 rounded-xl border-border/70" onClick={() => navigate(`/finance/invoices/${inv.id}/edit`)}>
                <Pencil className="h-4 w-4" /> Edit Draft
              </Button>
            )}
            {permissions.canRecordPayments && isIssued && outstanding > 0 && (
              <Button variant="outline" className="h-10 gap-2 rounded-xl border-border/70" onClick={() => navigate(`/finance/payments/new?client=${inv.client}&invoice=${inv.id}`)}>
                <Wallet className="h-4 w-4" /> Record Payment
              </Button>
            )}
            {permissions.canIssueInvoices && isDraft && (
              <Button className="h-10 gap-2 rounded-xl shadow-sm shadow-primary/20" onClick={() => setDialog("issue")} disabled={inv.items.length === 0} title={inv.items.length === 0 ? "Add at least one line item first" : undefined}>
                <Send className="h-4 w-4" /> Issue Invoice
              </Button>
            )}
          </div>
        </div>
      </div>

      {!isDraft && (
        <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-slate-50 px-5 py-3.5 text-[13px] text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          {isIssued
            ? `Issued ${formatFinanceDateTime(inv.issued_at ?? undefined)}. Issued invoices are immutable: items, totals and the agency/client snapshot can't be edited.`
            : `Cancelled ${formatFinanceDateTime(inv.cancelled_at ?? undefined)}. The record and its number are kept for audit and can't be modified.`}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <FinanceSectionCard title="Line Items" subtitle="Amounts calculated by the backend">
            {inv.items.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No line items yet. Edit the draft to add at least one item before issuing.</p>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60 bg-slate-50/80">
                      {["Description", "HSN/SAC"].map((h) => <th key={h} className="h-10 px-6 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>)}
                      {["Qty", "Unit Price", "Discount", "Taxable", "GST", "Tax", "Line Total"].map((h) => <th key={h} className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {inv.items.map((it) => {
                      const tax = [it.cgst_amount, it.sgst_amount, it.igst_amount];
                      return (
                        <tr key={it.id}>
                          <td className="px-6 py-3 font-medium text-foreground">{it.description}</td>
                          <td className="px-6 py-3 text-muted-foreground font-mono text-[12px]">{it.hsn_sac || "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{Number(it.quantity)}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">{money(it.unit_price)}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground">{money(it.discount_amount)}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">{money(it.taxable_amount)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{Number(it.gst_rate)}%</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-[12px] text-muted-foreground">
                            {Number(it.igst_amount) > 0 ? <>IGST {money(it.igst_amount)}</> : Number(it.cgst_amount) > 0 ? <>C {money(it.cgst_amount)} · S {money(it.sgst_amount)}</> : tax.every((t) => Number(t) === 0) ? "—" : null}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap font-semibold">{money(it.line_total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </FinanceSectionCard>

          <FinanceSectionCard title="Payment History" subtitle="Active allocations from confirmed payments">
            {inv.payment_history.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{isIssued ? "No payments allocated yet." : "Payments can be allocated only to issued invoices."}</p>
            ) : (
              <ul className="divide-y divide-border/50 text-[13px]">
                {inv.payment_history.map((p) => (
                  <li key={p.allocation_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <Link to={`/finance/payments/${p.payment_id}`} className="font-mono font-medium text-primary hover:underline">{p.payment_number}</Link>
                      <p className="text-[12px] text-muted-foreground">{formatFinanceDate(p.payment_date)} · {paymentMethodLabel(p.payment_method)}{p.created_by_name ? ` · by ${p.created_by_name}` : ""}</p>
                    </div>
                    <span className="font-semibold text-emerald-700">{money(p.allocated_amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </FinanceSectionCard>

          {(inv.notes || inv.terms) && (
            <FinanceSectionCard title="Notes & Terms">
              <dl className="space-y-4 text-[13px]">
                {inv.notes && (<div><dt className="text-muted-foreground">Notes</dt><dd className="mt-1 whitespace-pre-line text-foreground">{inv.notes}</dd></div>)}
                {inv.terms && (<div><dt className="text-muted-foreground">Terms & Conditions</dt><dd className="mt-1 whitespace-pre-line text-foreground">{inv.terms}</dd></div>)}
              </dl>
            </FinanceSectionCard>
          )}
        </div>

        <div className="space-y-6">
          <FinanceSectionCard title="Totals">
            <div className="space-y-2 text-[13px]">
              <TotalsRow label="Subtotal" value={money(inv.subtotal)} />
              <TotalsRow label="Discount" value={money(inv.discount_amount)} muted />
              <TotalsRow label="Taxable value" value={money(inv.taxable_amount)} />
              <TotalsRow label="CGST" value={money(inv.cgst_amount)} muted />
              <TotalsRow label="SGST" value={money(inv.sgst_amount)} muted />
              <TotalsRow label="IGST" value={money(inv.igst_amount)} muted />
              <div className="border-t border-border/60 pt-2"><TotalsRow label="Invoice total" value={money(inv.total_amount)} strong /></div>
              {isIssued && (
                <>
                  <TotalsRow label="Paid" value={<span className="text-emerald-700">{money(inv.total_paid)}</span>} />
                  <TotalsRow label="Outstanding" value={<span className="text-amber-700">{money(inv.outstanding_amount)}</span>} strong />
                </>
              )}
              <p className="pt-1 text-[11.5px] text-muted-foreground">{inv.currency} · all figures from the backend{isDraft ? "; recalculated again on issue" : ""}.</p>
            </div>
          </FinanceSectionCard>

          <FinanceSectionCard title="Billed To" subtitle={isDraft ? "Live client record" : "Snapshot frozen at issue"}>
            <dl className="space-y-3 text-[13px]">
              <div><dt className="text-muted-foreground">Client</dt><dd className="mt-0.5 font-medium text-foreground">{billedName}</dd></div>
              {!isDraft && snap(cs, "contact_person") && <div><dt className="text-muted-foreground">Contact</dt><dd className="mt-0.5 text-foreground">{snap(cs, "contact_person")}</dd></div>}
              {!isDraft && snap(cs, "billing_address") && <div><dt className="text-muted-foreground">Billing address</dt><dd className="mt-0.5 whitespace-pre-line text-foreground">{snap(cs, "billing_address")}</dd></div>}
              {!isDraft && snap(cs, "email") && <div><dt className="text-muted-foreground">Email</dt><dd className="mt-0.5 text-foreground">{snap(cs, "email")}</dd></div>}
              <div><dt className="text-muted-foreground">State (place of supply)</dt><dd className="mt-0.5 text-foreground">{inv.client_state || "—"}</dd></div>
              <div><dt className="text-muted-foreground">GSTIN</dt><dd className="mt-0.5 font-mono text-foreground">{inv.client_gstin || "—"}</dd></div>
            </dl>
          </FinanceSectionCard>

          <FinanceSectionCard title="Record">
            <dl className="space-y-3 text-[13px]">
              <div><dt className="text-muted-foreground">Created by</dt><dd className="mt-0.5 font-medium text-foreground">{inv.created_by_name || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Created</dt><dd className="mt-0.5 text-foreground">{formatFinanceDateTime(inv.created_at)}</dd></div>
              <div><dt className="text-muted-foreground">Last updated</dt><dd className="mt-0.5 text-foreground">{formatFinanceDateTime(inv.updated_at)}</dd></div>
            </dl>
            {(isDraft || isIssued) && (permissions.canCancelInvoices || permissions.canCreateInvoices) && (
              <div className="mt-5 space-y-2 border-t border-border/60 pt-4">
                {permissions.canCancelInvoices && (
                  <>
                    <Button variant="outline" className="w-full gap-2 rounded-xl text-rose-700 hover:text-rose-800" onClick={() => setDialog("cancel")} disabled={hasActiveAllocations}>
                      <Ban className="h-4 w-4" /> Cancel Invoice
                    </Button>
                    {hasActiveAllocations && <p className="text-[11.5px] text-muted-foreground">This invoice has active payment allocations. Reverse them from the payment page before cancelling.</p>}
                  </>
                )}
                {permissions.canCreateInvoices && isDraft && (
                  <Button variant="ghost" className="w-full gap-2 rounded-xl text-red-600 hover:text-red-700" onClick={() => setDialog("delete")}>
                    <Trash2 className="h-4 w-4" /> Delete Draft
                  </Button>
                )}
              </div>
            )}
          </FinanceSectionCard>
        </div>
      </div>

      <ConfirmActionDialog
        open={dialog === "issue"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Issue invoice ${inv.invoice_number}?`}
        description="The backend recalculates the totals, freezes the agency and client details, and marks the invoice as issued."
        consequences={[
          "Issued invoices are immutable: line items, amounts, dates and notes can no longer be edited.",
          "An issued invoice can't be returned to draft or deleted; it can only be cancelled.",
          "Payments can be allocated to it once it is issued.",
        ]}
        confirmLabel="Issue Invoice"
        onConfirm={async () => {
          try {
            await issueMutation.mutateAsync(inv.id);
          } catch (err) {
            throw new Error(extractApiErrorMessage(err, "Could not issue the invoice.").message);
          }
        }}
      />
      <ConfirmActionDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Cancel invoice ${inv.invoice_number}?`}
        description="The invoice is kept with its number for audit, marked cancelled, and excluded from outstanding and GST totals."
        consequences={["This can't be undone. A cancelled invoice can't be issued, edited or paid.", "The reason (if given) is appended to the invoice notes."]}
        confirmLabel="Cancel Invoice"
        destructive
        reason={{ label: "Reason (optional)", required: false, maxLength: 500, placeholder: "e.g. Raised in error" }}
        onConfirm={async (reason) => {
          try {
            await cancelMutation.mutateAsync({ id: inv.id, reason: reason || undefined });
          } catch (err) {
            throw new Error(extractApiErrorMessage(err, "Could not cancel the invoice.").message);
          }
        }}
      />
      <ConfirmActionDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Delete draft ${inv.invoice_number}?`}
        description="The draft and its line items are permanently removed."
        consequences={["Its invoice number has already been used by the sequence and will not be reused.", "Only drafts can be deleted; this can't be undone."]}
        confirmLabel="Delete Draft"
        destructive
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync({ id: inv.id, invoiceNumber: inv.invoice_number });
            navigate("/finance/invoices");
          } catch (err) {
            throw new Error(extractApiErrorMessage(err, "Could not delete the draft.").message);
          }
        }}
      />
    </div>
  );
}

export function InvoiceDetailPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <InvoiceDetailContent permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}

