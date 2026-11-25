import type { BackendPaymentMethod, Decimal } from "../types/api-contracts";
import type { PaymentMethod } from "../types/finance.types";
import { formatINR } from "./money";

/** Converts a DRF decimal string to a number for display. Never use the result to re-total figures. */
export function toAmount(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Serialises a number the way DRF does for DecimalField(decimal_places=2). */
export function toDecimal(value: number): Decimal {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function formatDecimalINR(value: Decimal | number | null | undefined, opts?: { compact?: boolean }) {
  return formatINR(toAmount(value), opts);
}

export const PAYMENT_METHOD_LABELS: Record<BackendPaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CREDIT_CARD: "Credit card",
  DEBIT_CARD: "Debit card",
  CHEQUE: "Cheque",
  CASH: "Cash",
  OTHER: "Other",
};

export function paymentMethodLabel(code?: string | null): string {
  if (!code) return "—";
  return PAYMENT_METHOD_LABELS[code as BackendPaymentMethod] || code;
}

const FRONTEND_TO_BACKEND_METHOD: Record<PaymentMethod, BackendPaymentMethod> = {
  "Bank Transfer": "BANK_TRANSFER",
  UPI: "UPI",
  Cash: "CASH",
  Other: "OTHER",
};

export function toBackendPaymentMethod(method: PaymentMethod | string): BackendPaymentMethod {
  return FRONTEND_TO_BACKEND_METHOD[method as PaymentMethod] || "OTHER";
}

/** Formats a backend percentage string ("70.0%") or number consistently. */
export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value.endsWith("%") ? value : `${value}%`;
  return `${Math.round(value * 10) / 10}%`;
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
