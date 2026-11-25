import { cn } from "@/lib/utils";
import type { AllocationStatus, InvoicePaymentStatus, InvoiceStatus, PaymentStatus } from "../types/api-contracts";

const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap";

const INVOICE_STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-slate-100 text-slate-700" },
  ISSUED: { label: "Issued", cls: "bg-blue-50 text-blue-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-rose-50 text-rose-700" },
};

const PAYMENT_STATE: Record<InvoicePaymentStatus, { label: string; cls: string }> = {
  UNPAID: { label: "Unpaid", cls: "bg-amber-50 text-amber-700" },
  PARTIALLY_PAID: { label: "Partially paid", cls: "bg-sky-50 text-sky-700" },
  PAID: { label: "Paid", cls: "bg-emerald-50 text-emerald-700" },
};

export const INVOICE_STATUS_LABELS = Object.fromEntries(Object.entries(INVOICE_STATUS).map(([k, v]) => [k, v.label])) as Record<InvoiceStatus, string>;
export const INVOICE_PAYMENT_STATUS_LABELS = Object.fromEntries(Object.entries(PAYMENT_STATE).map(([k, v]) => [k, v.label])) as Record<InvoicePaymentStatus, string>;

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  const s = INVOICE_STATUS[status] ?? { label: status, cls: "bg-slate-100 text-slate-700" };
  return <span className={cn(base, s.cls, className)}>{s.label}</span>;
}

/** Backend `payment_status`. Not meaningful for drafts (always UNPAID) or cancelled invoices, so those show "—". */
export function InvoicePaymentBadge({ status, invoiceStatus, className }: { status: InvoicePaymentStatus; invoiceStatus?: InvoiceStatus; className?: string }) {
  if (invoiceStatus && invoiceStatus !== "ISSUED") return <span className="text-muted-foreground">—</span>;
  const s = PAYMENT_STATE[status] ?? { label: status, cls: "bg-slate-100 text-slate-700" };
  return <span className={cn(base, s.cls, className)}>{s.label}</span>;
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const voided = status === "VOIDED";
  return <span className={cn(base, voided ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700", className)}>{voided ? "Voided" : "Confirmed"}</span>;
}

export function AllocationStatusBadge({ status }: { status: AllocationStatus }) {
  const reversed = status === "REVERSED";
  return <span className={cn(base, reversed ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700")}>{reversed ? "Reversed" : "Active"}</span>;
}
