import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Calendar, ChevronDown, Hash, IndianRupee, Store } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { AttachmentUploader } from "../components/attachment-uploader";
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
import { useCreateExpense, useExpense, useFinanceCategories, useUpdateExpense } from "../hooks/use-finance";
import {
  BACKEND_PAYMENT_METHODS,
  paymentMethodLabel,
  type BackendPaymentMethod,
  type ExpenseRecordDTO,
  type ExpenseWritePayload,
} from "../types/api-contracts";
import type { AttachmentFile, FinancePermissions } from "../types/finance.types";
import { getTodayISO } from "../utils/formatters";

/* ExpenseRecordSerializer: description ≤255 (required), amount Decimal(12,2) > 0, category = active EXPENSE category,
 * expense_date required, payment_method enum, vendor_name ≤150, reference_number ≤100, notes, receipt_file (multipart). */
const schema = z.object({
  description: z.string().trim().min(1, "Expense title is required").max(255, "Max 255 characters"),
  vendor_name: z.string().trim().max(150, "Max 150 characters"),
  amount: z.string().trim()
    .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Enter an amount with up to 2 decimals")
    .refine((v) => Number(v) > 0, "Amount must be greater than zero"),
  category: z.string().min(1, "Category is required"),
  expense_date: z.string().min(1, "Expense date is required"),
  payment_method: z.enum(BACKEND_PAYMENT_METHODS as [BackendPaymentMethod, ...BackendPaymentMethod[]]),
  reference_number: z.string().trim().max(100, "Max 100 characters"),
  notes: z.string(),
});
type FormValues = z.infer<typeof schema>;
const FORM_FIELDS = new Set(Object.keys(schema.shape));

function toForm(r?: ExpenseRecordDTO): FormValues {
  return {
    description: r?.description ?? "",
    vendor_name: r?.vendor_name ?? "",
    amount: r ? String(r.amount) : "",
    category: r ? String(r.category) : "",
    expense_date: r?.expense_date ?? getTodayISO(),
    payment_method: r?.payment_method ?? "BANK_TRANSFER",
    reference_number: r?.reference_number ?? "",
    notes: r?.notes ?? "",
  };
}

function toPayload(v: FormValues): ExpenseWritePayload {
  return {
    description: v.description.trim(),
    vendor_name: v.vendor_name.trim(),
    amount: v.amount.trim(),
    category: Number(v.category),
    expense_date: v.expense_date,
    payment_method: v.payment_method,
    reference_number: v.reference_number.trim(),
    notes: v.notes.trim(),
  };
}

function fileNameFromUrl(url: string) {
  try {
    return decodeURIComponent(new URL(url, window.location.origin).pathname.split("/").pop() || url);
  } catch {
    return url;
  }
}

function ExpenseFormInner({ permissions }: { permissions: FinancePermissions }) {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const existingQuery = useExpense(id);
  const existing = existingQuery.data;
  const categoriesQuery = useFinanceCategories("EXPENSE");
  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();
  const [attachment, setAttachment] = useState<AttachmentFile | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const categoryOptions = useMemo(() => {
    const all = categoriesQuery.data ?? [];
    return all.filter((c) => c.is_active || (existing && c.id === existing.category));
  }, [categoriesQuery.data, existing]);

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toForm(),
  });

  useEffect(() => {
    if (isEditing && existing) {
      reset(toForm(existing));
      setAttachment(
        existing.receipt_file
          ? { id: `stored-${existing.id}`, name: fileNameFromUrl(existing.receipt_file), size: 0, mimeType: "", url: existing.receipt_file, uploadedAt: existing.updated_at }
          : null,
      );
    }
  }, [isEditing, existing, reset]);

  if (!permissions.canManageExpenses) {
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-8 text-center shadow-sm">
        <p className="text-[14px] font-medium text-foreground">You do not have permission to add or edit expenses.</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/finance/expenses")}>Back to Expenses</Button>
      </div>
    );
  }

  if (isEditing && existingQuery.isLoading) {
    return <div className="h-64 rounded-2xl bg-secondary/50 animate-pulse" />;
  }

  if (isEditing && !existing) {
    const notFound = (existingQuery.error as { status?: number | null } | null)?.status === 404;
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-8 text-center shadow-sm">
        <p className="text-[14px] font-medium text-foreground">
          {notFound ? "Expense not found." : extractApiErrorMessage(existingQuery.error, "Unable to load this expense.").message}
        </p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/finance/expenses")}>Back to Expenses</Button>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    const payload = toPayload(values);
    // Only a newly selected file is uploaded; a stored receipt is kept as-is (the API has no receipt delete).
    const receipt = attachment?.file ?? null;
    try {
      setProgress(receipt ? 0 : null);
      if (isEditing && existing) {
        const before = toPayload(toForm(existing));
        const patch: Partial<ExpenseWritePayload> = {};
        (Object.keys(payload) as (keyof ExpenseWritePayload)[]).forEach((k) => {
          if (String(payload[k] ?? "") !== String(before[k] ?? "")) (patch as Record<string, unknown>)[k] = payload[k];
        });
        if (Object.keys(patch).length === 0 && !receipt) {
          toast.info("No changes to save.");
          navigate(`/finance/expenses/${existing.id}`);
          return;
        }
        const saved = await updateMutation.mutateAsync({ id: existing.id, input: patch, receipt, onProgress: setProgress });
        navigate(`/finance/expenses/${saved.id}`);
      } else {
        const saved = await createMutation.mutateAsync({ input: payload, receipt, onProgress: setProgress });
        navigate(`/finance/expenses/${saved.id}`);
      }
    } catch (err) {
      const { message, fieldErrors } = extractApiErrorMessage(err, "Failed to save expense.");
      let mapped = false;
      const other: string[] = [];
      for (const [k, msgs] of Object.entries(fieldErrors ?? {})) {
        if (!msgs.length) continue;
        if (FORM_FIELDS.has(k)) {
          setError(k as keyof FormValues, { type: "server", message: msgs[0] });
          mapped = true;
        } else other.push(k === "receipt_file" ? `Receipt: ${msgs.join(" ")}` : msgs[0]);
      }
      toast.error(other.length ? other.join(" · ") : mapped ? "Please correct the highlighted fields." : message);
    } finally {
      setProgress(null);
    }
  };

  const isPending = isSubmitting || createMutation.isPending || updateMutation.isPending;
  const categoryHint = categoriesQuery.isError
    ? `Categories could not be loaded: ${extractApiErrorMessage(categoriesQuery.error).message}`
    : !categoriesQuery.isLoading && categoryOptions.length === 0
      ? "No active expense categories exist. Create one in Django Admin first."
      : undefined;

  return (
    <div>
      <FinanceBackHeader
        backTo="/finance/expenses"
        backLabel="Back to Expenses"
        title={isEditing ? `Edit Expense — #${existing?.id}` : "Add Expense"}
        description={isEditing ? "Update expense details and receipt." : "Record an agency expense, vendor payout, or operating cost."}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 pb-24">
        <FinanceSectionCard title="Expense Details" subtitle="Vendor, amount, and expense classification">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FinanceField label="Expense Title" required error={errors.description?.message} className="md:col-span-2">
              <input {...register("description")} maxLength={255} aria-label="Expense title" placeholder="e.g. Figma Organization Annual Seats" className={financeInputClass(errors.description?.message)} />
            </FinanceField>

            <FinanceField label="Vendor / Paid To (Optional)" error={errors.vendor_name?.message}>
              <div className="relative">
                <FinanceLeadIcon><Store className="h-4 w-4" /></FinanceLeadIcon>
                <input {...register("vendor_name")} maxLength={150} aria-label="Vendor" placeholder="e.g. Figma Inc. / AWS" className={`${financeInputClass(errors.vendor_name?.message)} pl-10`} />
              </div>
            </FinanceField>

            <FinanceField label="Category" required error={errors.category?.message ?? categoryHint}>
              <div className="relative">
                <select {...register("category")} aria-label="Category" disabled={categoriesQuery.isLoading || categoryOptions.length === 0} className={financeSelectClass(errors.category?.message ?? categoryHint)}>
                  <option value="">{categoriesQuery.isLoading ? "Loading categories..." : "Select category"}</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.is_active ? c.name : `${c.name} (inactive)`}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </FinanceField>

            <FinanceField label="Amount (INR)" required error={errors.amount?.message}>
              <div className="relative">
                <FinanceLeadIcon><IndianRupee className="h-4 w-4" /></FinanceLeadIcon>
                <input type="number" step="0.01" min="0.01" inputMode="decimal" aria-label="Amount" {...register("amount")} className={`${financeInputClass(errors.amount?.message)} pl-10 tabular-nums`} />
              </div>
            </FinanceField>

            <FinanceField label="Expense Date" required error={errors.expense_date?.message}>
              <div className="relative">
                <FinanceLeadIcon><Calendar className="h-4 w-4" /></FinanceLeadIcon>
                <input type="date" aria-label="Expense date" {...register("expense_date")} className={`${financeInputClass(errors.expense_date?.message)} pl-10`} />
              </div>
            </FinanceField>
          </div>
        </FinanceSectionCard>

        <FinanceSectionCard title="Payment Reference" subtitle="Payout method and reference">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                <input {...register("reference_number")} maxLength={100} aria-label="Transaction reference" placeholder="Card / NEFT / UTR / Receipt reference" className={`${financeInputClass(errors.reference_number?.message)} pl-10`} />
              </div>
            </FinanceField>
          </div>
        </FinanceSectionCard>

        <FinanceSectionCard title="Description & Receipt" subtitle="Additional context and downloadable receipt">
          <div className="space-y-5">
            <FinanceField label="Description" error={errors.notes?.message}>
              <textarea rows={3} aria-label="Notes" {...register("notes")} placeholder="Additional cost notes or reimbursement details..." className={financeTextareaClass()} />
            </FinanceField>

            <AttachmentUploader
              label={isEditing && existing?.receipt_file && !attachment?.file ? "Receipt Attachment (choose a file to replace it)" : "Receipt Attachment (Optional)"}
              value={attachment}
              onChange={(next) => setAttachment(next ?? (existing?.receipt_file ? { id: `stored-${existing.id}`, name: fileNameFromUrl(existing.receipt_file), size: 0, mimeType: "", url: existing.receipt_file, uploadedAt: existing.updated_at } : null))}
            />
            {progress !== null && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground">Uploading receipt… {Math.round(progress * 100)}%</p>
              </div>
            )}
          </div>
        </FinanceSectionCard>

        <FinanceFixedFooter
          onCancel={() => navigate(isEditing && existing ? `/finance/expenses/${existing.id}` : "/finance/expenses")}
          submitLabel={isEditing ? "Save Changes" : "Save Expense"}
          isSubmitting={isPending}
        />
      </form>
    </div>
  );
}

export function ExpenseFormPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <ExpenseFormInner permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}
