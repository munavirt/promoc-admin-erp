import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useStore } from "@/store";
import { financeApiService } from "@/services/api/finance.service";
import type {
  CategoryType,
  ExpenseWritePayload,
  FinanceListParams,
  IncomeWritePayload,
} from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";

/**
 * Finance data hooks — real Django API only (Phase 4). There is no mock or localStorage fallback:
 * failures surface as query/mutation errors.
 *
 * Query keys (all under ["finance"] so any write refreshes overview, dashboard and lists):
 *   ["finance","categories",type] · ["finance","income","list",params] · ["finance","income",id]
 *   ["finance","expenses","list",params] · ["finance","expenses",id]
 *   ["finance","overview",…] · ["finance","agency-settings"]
 */
export const financeKeys = {
  all: ["finance"] as const,
  categories: (type?: CategoryType, activeOnly?: boolean) => ["finance", "categories", type ?? "all", activeOnly ? "active" : "any"] as const,
  incomeList: (params: FinanceListParams) => ["finance", "income", "list", params] as const,
  income: (id: string) => ["finance", "income", id] as const,
  expenseList: (params: FinanceListParams) => ["finance", "expenses", "list", params] as const,
  expense: (id: string) => ["finance", "expenses", id] as const,
};

export const invalidateFinance = (qc: QueryClient) => qc.invalidateQueries({ queryKey: financeKeys.all });

/**
 * Finance permissions come from the authenticated role: every finance endpoint is IsAdmin on the backend,
 * which stays the enforcement point (401/403 are rendered as errors). Features without a backend
 * endpoint (expense reversal, finance audit history) are off for everyone.
 */
export function useFinancePermissions() {
  const role = String(useStore((s) => s.currentUser?.role) || "").toUpperCase();
  const isAdmin = role === "ADMIN";
  const permissions: FinancePermissions = {
    role: (isAdmin ? "ADMIN" : "EMPLOYEE") as FinancePermissions["role"],
    canViewFinance: isAdmin,
    canManageIncome: isAdmin,
    canManageExpenses: isAdmin,
    canReverseExpenses: false,
    canCreateInvoices: isAdmin,
    canIssueInvoices: isAdmin,
    canCancelInvoices: isAdmin,
    canRecordPayments: isAdmin,
    canAllocateAdvances: isAdmin,
    canViewAuditHistory: false,
    canManageSettings: isAdmin,
  };
  return { data: { permissions }, isLoading: false };
}

/* ─── Categories ─── */
export function useFinanceCategories(type?: CategoryType, activeOnly = false) {
  return useQuery({
    queryKey: financeKeys.categories(type, activeOnly),
    queryFn: ({ signal }) => financeApiService.listCategories({ type, ...(activeOnly ? { is_active: true } : {}) }, signal),
    staleTime: 60_000,
  });
}

/* ─── Income ─── */
export function useIncomes(params: FinanceListParams, enabled = true) {
  return useQuery({
    queryKey: financeKeys.incomeList(params),
    queryFn: ({ signal }) => financeApiService.listIncome(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useIncome(id?: string) {
  return useQuery({
    queryKey: financeKeys.income(id || ""),
    queryFn: ({ signal }) => financeApiService.getIncome(id as string, signal),
    enabled: Boolean(id),
  });
}

/** Callers show errors on the form; success toast only after the backend returns the saved record. */
export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IncomeWritePayload) => financeApiService.createIncome(input),
    onSuccess: (saved) => {
      invalidateFinance(qc);
      toast.success(`Income #${saved.id} saved.`);
    },
  });
}

export function useUpdateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number | string; input: Partial<IncomeWritePayload> }) => financeApiService.updateIncome(id, input),
    onSuccess: (saved) => {
      invalidateFinance(qc);
      toast.success(`Income #${saved.id} updated.`);
    },
  });
}

/* ─── Expenses ─── */
export function useExpenses(params: FinanceListParams) {
  return useQuery({
    queryKey: financeKeys.expenseList(params),
    queryFn: ({ signal }) => financeApiService.listExpenses(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useExpense(id?: string) {
  return useQuery({
    queryKey: financeKeys.expense(id || ""),
    queryFn: ({ signal }) => financeApiService.getExpense(id as string, signal),
    enabled: Boolean(id),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, receipt, onProgress }: { input: ExpenseWritePayload; receipt?: File | null; onProgress?: (f: number) => void }) =>
      financeApiService.createExpense(input, receipt, onProgress),
    onSuccess: (saved) => {
      invalidateFinance(qc);
      toast.success(`Expense #${saved.id} saved.`);
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input, receipt, onProgress }: { id: number | string; input: Partial<ExpenseWritePayload>; receipt?: File | null; onProgress?: (f: number) => void }) =>
      financeApiService.updateExpense(id, input, receipt, onProgress),
    onSuccess: (saved) => {
      invalidateFinance(qc);
      toast.success(`Expense #${saved.id} updated.`);
    },
  });
}
