import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Calendar, ChevronDown, Hash, IndianRupee } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
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
import { useCreateIncome, useFinanceCategories, useIncome, useUpdateIncome } from "../hooks/use-finance";
import {
  BACKEND_PAYMENT_METHODS,
  paymentMethodLabel,
  type BackendPaymentMethod,
  type IncomeRecordDTO,
  type IncomeWritePayload,
} from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { getTodayISO } from "../utils/formatters";

/* IncomeRecordSerializer: description ≤255 (required), amount Decimal(12,2) > 0, category = active INCOME category,
 * received_date required, payment_method enum, reference_number ≤100, notes optional. */
const schema = z.object({
  description: z.string().trim().min(1, "Income title is required").max(255, "Max 255 characters"),
  amount: z.string().trim()
    .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Enter an amount with up to 2 decimals")
    .refine((v) => Number(v) > 0, "Amount must be greater than zero"),
  category: z.string().min(1, "Category is required"),
  received_date: z.string().min(1, "Received date is required"),
  payment_method: z.enum(BACKEND_PAYMENT_METHODS as [BackendPaymentMethod, ...BackendPaymentMethod[]]),
  reference_number: z.string().trim().max(100, "Max 100 characters"),
  notes: z.string(),
});
type FormValues = z.infer<typeof schema>;
const FORM_FIELDS = new Set(Object.keys(schema.shape));

function toForm(r?: IncomeRecordDTO): FormValues {
  return {
    description: r?.description ?? "",
    amount: r ? String(r.amount) : "",
    category: r ? String(r.category) : "",
    received_date: r?.received_date ?? getTodayISO(),
    payment_method: r?.payment_method ?? "BANK_TRANSFER",
    reference_number: r?.reference_number ?? "",
    notes: r?.notes ?? "",
  };
}

function toPayload(v: FormValues): IncomeWritePayload {
  return {
    description: v.description.trim(),
    amount: v.amount.trim(),
    category: Number(v.category),
    received_date: v.received_date,
    payment_method: v.payment_method,
    reference_number: v.reference_number.trim(),
    notes: v.notes.trim(),
  };
}

function IncomeFormInner({ permissions }: { permissions: FinancePermissions }) {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const existingQuery = useIncome(id);
  const existing = existingQuery.data;
  const categoriesQuery = useFinanceCategories("INCOME");
  const createMutation = useCreateIncome();
  const updateMutation = useUpdateIncome();

  // Active INCOME categories; on edit, keep the record's current (possibly inactive) category selectable.
  const categoryOptions = useMemo(() => {
    const all = categoriesQuery.data ?? [];
    return all.filter((c) => c.is_active || (existing && c.id === existing.category));
  }, [categoriesQuery.data, existing]);

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toForm(),
  });

  useEffect(() => {
    if (isEditing && existing) reset(toForm(existing));
  }, [isEditing, existing, reset]);

  if (!permissions.canManageIncome) {
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-8 text-center shadow-sm">
        <p className="text-[14px] font-medium text-foreground">You do not have permission to add or edit income records.</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/finance/income")}>Back to Income</Button>
      </div>
    );
  }

  if (isEditing && existingQuery.isLoading) {
    return <div className="h-64 rounded-2xl bg-secondary/50 animate-pulse" />;
  }

  if (isEditing && (!existing || existing.is_payment_receipt)) {
    const notFound = !existing && (existingQuery.error as { status?: number | null } | null)?.status === 404;
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-8 text-center shadow-sm">
        <p className="text-[14px] font-medium text-foreground">
          {existing
            ? "Income generated from a client payment cannot be edited here."
            : notFound
              ? "Income record not found."
              : extractApiErrorMessage(existingQuery.error, "Unable to load this income record.").message}
        </p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/finance/income")}>Back to Income</Button>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    const payload = toPayload(values);
    try {
      if (isEditing && existing) {
        // PATCH only changed fields.
        const before = toPayload(toForm(existing));
        const patch: Partial<IncomeWritePayload> = {};
        (Object.keys(payload) as (keyof IncomeWritePayload)[]).forEach((k) => {
          if (String(payload[k]) !== String(before[k])) (patch as Record<string, unknown>)[k] = payload[k];
        });
        if (Object.keys(patch).length === 0) {
          toast.info("No changes to save.");
          navigate(`/finance/income/${existing.id}`);
          return;
        }
        const saved = await updateMutation.mutateAsync({ id: existing.id, input: patch });
        navigate(`/finance/income/${saved.id}`);
      } else {
        const saved = await createMutation.mutateAsync(payload);
        navigate(`/finance/income/${saved.id}`);
      }
    } catch (err) {
      const { message, fieldErrors } = extractApiErrorMessage(err, "Failed to save income record.");
      let mapped = false;
      const other: string[] = [];
      for (const [k, msgs] of Object.entries(fieldErrors ?? {})) {
        if (FORM_FIELDS.has(k) && msgs.length) {
          setError(k as keyof FormValues, { type: "server", message: msgs[0] });
          mapped = true;
        } else if (msgs.length) other.push(msgs[0]);
      }
      toast.error(other.length ? other.join(" · ") : mapped ? "Please correct the highlighted fields." : message);
    }
  };

  const isPending = isSubmitting || createMutation.isPending || updateMutation.isPending;
  const categoryHint = categoriesQuery.isError
    ? `Categories could not be loaded: ${extractApiErrorMessage(categoriesQuery.error).message}`
    : !categoriesQuery.isLoading && categoryOptions.length === 0
      ? "No active income categories exist. Create one in Django Admin first."
      : undefined;

  return (
    <div>
      <FinanceBackHeader
        backTo="/finance/income"
        backLabel="Back to Income"
        title={isEditing ? `Edit Income — #${existing?.id}` : "Add Income"}
        description={isEditing ? "Update direct income entry details." : "Record direct agency income, retainers, or miscellaneous inflows."}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 pb-24">
        <FinanceSectionCard title="Income Details" subtitle="Core transaction information for this income entry">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FinanceField label="Income Title" required error={errors.description?.message} className="md:col-span-2">
              <input
                {...register("description")}
                maxLength={255}
                aria-label="Income title"
                placeholder="e.g. Monthly Creative Retainer — November"
                className={financeInputClass(errors.description?.message)}
              />
            </FinanceField>

            <FinanceField label="Amount (INR)" required error={errors.amount?.message}>
              <div className="relative">
                <FinanceLeadIcon><IndianRupee className="h-4 w-4" /></FinanceLeadIcon>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  aria-label="Amount"
                  {...register("amount")}
                  className={`${financeInputClass(errors.amount?.message)} pl-10 tabular-nums`}
                />
              </div>
            </FinanceField>

            <FinanceField label="Category" required error={errors.category?.message ?? categoryHint} hint={undefined}>
              <div className="relative">
                <select
                  {...register("category")}
                  aria-label="Category"
                  disabled={categoriesQuery.isLoading || categoryOptions.length === 0}
                  className={financeSelectClass(errors.category?.message ?? categoryHint)}
                >
                  <option value="">{categoriesQuery.isLoading ? "Loading categories..." : "Select category"}</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.is_active ? c.name : `${c.name} (inactive)`}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </FinanceField>
          </div>
        </FinanceSectionCard>

        <FinanceSectionCard title="Payment" subtitle="Settlement details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FinanceField label="Received Date" required error={errors.received_date?.message}>
              <div className="relative">
                <FinanceLeadIcon><Calendar className="h-4 w-4" /></FinanceLeadIcon>
                <input type="date" aria-label="Received date" {...register("received_date")} className={`${financeInputClass(errors.received_date?.message)} pl-10`} />
              </div>
            </FinanceField>

            <FinanceField label="Payment Method" required error={errors.payment_method?.message}>
              <div className="relative">
                <select {...register("payment_method")} aria-label="Payment method" className={financeSelectClass(errors.payment_method?.message)}>
                  {BACKEND_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{paymentMethodLabel(m)}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </FinanceField>

            <FinanceField label="Transaction Reference (Optional)" error={errors.reference_number?.message} className="md:col-span-2">
              <div className="relative">
                <FinanceLeadIcon><Hash className="h-4 w-4" /></FinanceLeadIcon>
                <input
                  {...register("reference_number")}
                  maxLength={100}
                  aria-label="Transaction reference"
                  placeholder="NEFT / UPI UTR / Bank reference"
                  className={`${financeInputClass(errors.reference_number?.message)} pl-10`}
                />
              </div>
            </FinanceField>
          </div>
        </FinanceSectionCard>

        <FinanceSectionCard title="Notes" subtitle="Supporting remarks">
          <FinanceField label="Description / Notes" error={errors.notes?.message}>
            <textarea
              rows={3}
              aria-label="Notes"
              {...register("notes")}
              placeholder="Optional context, contract details, or remarks..."
              className={financeTextareaClass()}
            />
          </FinanceField>
        </FinanceSectionCard>

        <FinanceFixedFooter
          onCancel={() => navigate(isEditing && existing ? `/finance/income/${existing.id}` : "/finance/income")}
          submitLabel={isEditing ? "Save Changes" : "Save Income"}
          isSubmitting={isPending}
        />
      </form>
    </div>
  );
}

export function IncomeFormPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <IncomeFormInner permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}
