import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listAllClients } from "@/api/clients.api";
import { financeApiService } from "@/services/api/finance.service";
import type {
  InvoiceListParams,
  InvoiceWritePayload,
  PaymentCreatePayload,
  PaymentListParams,
} from "../types/api-contracts";
import { invalidateFinance } from "./use-finance";

/**
 * Invoice & payment hooks — Django only (Phase 5). No optimistic updates: every financial mutation waits
 * for the backend response and then invalidates the whole ["finance"] tree, so invoice balances, payment
 * allocations, income (payment-generated records), the overview, dashboard and reports re-fetch.
 *
 * Keys: ["finance","invoices","list",params] · ["finance","invoices",id] · ["finance","invoices","eligible",clientId]
 *       ["finance","payments","list",params] · ["finance","payments",id] · ["finance","clients"]
 */
export const invoicePaymentKeys = {
  invoiceList: (p: InvoiceListParams) => ["finance", "invoices", "list", p] as const,
  invoice: (id: string) => ["finance", "invoices", "detail", id] as const,
  eligible: (clientId: string) => ["finance", "invoices", "eligible", clientId] as const,
  paymentList: (p: PaymentListParams) => ["finance", "payments", "list", p] as const,
  payment: (id: string) => ["finance", "payments", "detail", id] as const,
  clients: ["finance", "clients"] as const,
};

/** Active clients from the real Clients API (inactive clients are excluded by the backend queryset). */
export function useFinanceClients() {
  return useQuery({
    queryKey: invoicePaymentKeys.clients,
    queryFn: ({ signal }) => listAllClients({ ordering: "company_name" }, signal),
    staleTime: 60_000,
  });
}

/* ─── Invoices ─── */
export function useInvoices(params: InvoiceListParams) {
  return useQuery({
    queryKey: invoicePaymentKeys.invoiceList(params),
    queryFn: ({ signal }) => financeApiService.listInvoices(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id?: string) {
  return useQuery({
    queryKey: invoicePaymentKeys.invoice(id || ""),
    queryFn: ({ signal }) => financeApiService.getInvoice(id as string, signal),
    enabled: Boolean(id),
  });
}

/**
 * Invoices a payment from `clientId` can be allocated to: ISSUED, same client, outstanding > 0 — the same
 * rules PaymentAllocationCreateSerializer / PaymentService.allocate_payment enforce. Balances are the
 * backend's `outstanding_amount`; always fetched fresh (staleTime 0).
 */
export function useEligibleInvoices(clientId?: string) {
  return useQuery({
    queryKey: invoicePaymentKeys.eligible(clientId || ""),
    queryFn: async ({ signal }) => {
      const all = await financeApiService.listAllInvoices({ client: clientId, status: "ISSUED", ordering: "due_date" }, signal);
      return all.filter((inv) => inv.client === Number(clientId) && Number(inv.outstanding_amount) > 0);
    },
    enabled: Boolean(clientId),
    staleTime: 0,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InvoiceWritePayload) => financeApiService.createInvoice(input),
    onSuccess: (saved) => {
      invalidateFinance(qc);
      toast.success(`Draft invoice ${saved.invoice_number} saved.`);
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number | string; input: Partial<InvoiceWritePayload> }) => financeApiService.updateInvoice(id, input),
    onSuccess: (saved) => {
      invalidateFinance(qc);
      toast.success(`Draft invoice ${saved.invoice_number} updated.`);
    },
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => financeApiService.issueInvoice(id),
    onSuccess: (saved) => {
      invalidateFinance(qc);
      toast.success(`Invoice ${saved.invoice_number} issued.`);
    },
  });
}

export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number | string; reason?: string }) => financeApiService.cancelInvoice(id, reason),
    onSuccess: (saved) => {
      invalidateFinance(qc);
      toast.success(`Invoice ${saved.invoice_number} cancelled.`);
    },
  });
}

export function useDeleteDraftInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number | string; invoiceNumber: string }) => financeApiService.deleteDraftInvoice(id),
    onSuccess: (_d, vars) => {
      qc.removeQueries({ queryKey: invoicePaymentKeys.invoice(String(vars.id)) });
      invalidateFinance(qc);
      toast.success(`Draft invoice ${vars.invoiceNumber} deleted.`);
    },
  });
}

/* ─── Payments ─── */
export function usePayments(params: PaymentListParams) {
  return useQuery({
    queryKey: invoicePaymentKeys.paymentList(params),
    queryFn: ({ signal }) => financeApiService.listPayments(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePayment(id?: string) {
  return useQuery({
    queryKey: invoicePaymentKeys.payment(id || ""),
    queryFn: ({ signal }) => financeApiService.getPayment(id as string, signal),
    enabled: Boolean(id),
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: PaymentCreatePayload; idempotencyKey: string }) =>
      financeApiService.createPayment(payload, { idempotencyKey }),
    onSuccess: (saved) => {
      invalidateFinance(qc);
      toast.success(`Payment ${saved.payment_number} recorded.`);
    },
  });
}

export function useVoidPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => financeApiService.voidPayment(id, reason),
    onSuccess: (saved) => {
      invalidateFinance(qc);
      toast.success(`Payment ${saved.payment_number} voided.`);
    },
  });
}

export function useAllocatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, invoiceId, amount }: { paymentId: string; invoiceId: number; amount: string }) =>
      financeApiService.allocatePayment(paymentId, invoiceId, amount),
    onSuccess: (alloc) => {
      invalidateFinance(qc);
      toast.success(`Allocated to ${alloc.invoice_number}.`);
    },
  });
}

export function useReverseAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, allocationId, reason }: { paymentId: string; allocationId: string; reason?: string }) =>
      financeApiService.reverseAllocation(paymentId, allocationId, reason),
    onSuccess: (alloc) => {
      invalidateFinance(qc);
      toast.success(`Allocation to ${alloc.invoice_number} reversed.`);
    },
  });
}
