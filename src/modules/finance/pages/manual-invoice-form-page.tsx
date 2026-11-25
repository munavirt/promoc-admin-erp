import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { AlertTriangle, Calendar, ChevronDown, Info, Plus, Trash2 } from "lucide-react";
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
import { MoneyDisplay } from "../components/money-display";
import { useAgencySettings } from "../hooks/use-finance-workspace";
import { useCreateInvoice, useFinanceClients, useInvoice, useUpdateInvoice } from "../hooks/use-invoices-payments";
import { SUPPORTED_GST_RATES, type InvoiceDTO, type InvoiceWritePayload } from "../types/api-contracts";
import type { FinancePermissions } from "../types/finance.types";
import { centsToNumber, isDecimal2, multiplyCents, sumCents, toCents } from "../utils/decimal";
import { getTodayISO } from "../utils/formatters";

/*
 * InvoiceSerializer (writable): client, issue_date, due_date, client_state, client_gstin, notes, terms, items[].
 * InvoiceItem: description ≤255 (required), hsn_sac ≤50, quantity Decimal(10,2) > 0, unit_price Decimal(14,2) ≥ 0,
 * discount_amount ≥ 0 and ≤ quantity × unit_price, gst_rate ∈ SUPPORTED_GST_RATES.
 * invoice_number, status and every total are read-only — computed by Django.
 */
const decimalField = (label: string, maxInt: number) =>
  z.string().trim()
    .refine((v) => isDecimal2(v), `${label}: enter a number with up to 2 decimals`)
    .refine((v) => v.split(".")[0].replace(/^0+(?=\d)/, "").length <= maxInt, `${label} is too large`);

const itemSchema = z
  .object({
    description: z.string().trim().min(1, "Description is required").max(255, "Max 255 characters"),
    hsn_sac: z.string().trim().max(50, "Max 50 characters"),
    quantity: decimalField("Quantity", 8).refine((v) => (toCents(v) ?? 0n) > 0n, "Quantity must be greater than zero"),
    unit_price: decimalField("Unit price", 12),
    discount_amount: decimalField("Discount", 12),
    gst_rate: z.enum(SUPPORTED_GST_RATES),
  })
  .superRefine((it, ctx) => {
    const q = toCents(it.quantity), p = toCents(it.unit_price), d = toCents(it.discount_amount);
    if (q !== null && p !== null && d !== null && d > multiplyCents(q, p)) {
      ctx.addIssue({ code: "custom", path: ["discount_amount"], message: "Discount cannot exceed quantity × unit price" });
    }
  });

const schema = z
  .object({
    client: z.string().min(1, "Select a client"),
    issue_date: z.string().min(1, "Issue date is required"),
    due_date: z.string(),
    client_state: z.string().trim().max(100, "Max 100 characters"),
    client_gstin: z.string().trim().max(15, "GSTIN is 15 characters"),
    notes: z.string(),
    terms: z.string(),
    items: z.array(itemSchema).min(1, "Add at least one line item"),
  })
  .superRefine((v, ctx) => {
    if (v.due_date && v.issue_date && v.due_date < v.issue_date) {
      ctx.addIssue({ code: "custom", path: ["due_date"], message: "Due date cannot be earlier than issue date" });
    }
  });

type FormValues = z.infer<typeof schema>;
type ItemValues = FormValues["items"][number];
const TOP_FIELDS = new Set(["client", "issue_date", "due_date", "client_state", "client_gstin", "notes", "terms"]);

const emptyItem = (): ItemValues => ({ description: "", hsn_sac: "", quantity: "1", unit_price: "", discount_amount: "0", gst_rate: "0.00" });

/** Backend returns "18.00"; normalise to the enum spelling. */
function rateOf(v: string): ItemValues["gst_rate"] {
  const match = SUPPORTED_GST_RATES.find((r) => toCents(r) === toCents(v));
  return match ?? "0.00";
}

function toForm(inv?: InvoiceDTO, preset?: { client?: string }): FormValues {
  return {
    client: inv ? String(inv.client) : preset?.client ?? "",
    issue_date: inv?.issue_date ?? getTodayISO(),
    due_date: inv?.due_date ?? "",
    client_state: inv?.client_state ?? "",
    client_gstin: inv?.client_gstin ?? "",
    notes: inv?.notes ?? "",
    terms: inv?.terms ?? "",
    items: inv?.items.length
      ? inv.items.map((it) => ({
          description: it.description,
          hsn_sac: it.hsn_sac ?? "",
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_amount: it.discount_amount,
          gst_rate: rateOf(it.gst_rate),
        }))
      : [emptyItem()],
  };
}

function toPayload(v: FormValues): InvoiceWritePayload {
  return {
    client: Number(v.client),
    issue_date: v.issue_date,
    due_date: v.due_date || null,
    client_state: v.client_state.trim(),
    client_gstin: v.client_gstin.trim().toUpperCase(),
    notes: v.notes.trim(),
    terms: v.terms.trim(),
    // Decimal strings are sent as typed; Django parses them as Decimal (no float conversion here).
    items: v.items.map((it) => ({
      description: it.description.trim(),
      hsn_sac: it.hsn_sac.trim(),
      quantity: it.quantity.trim(),
      unit_price: it.unit_price.trim(),
      discount_amount: it.discount_amount.trim() || "0",
      gst_rate: it.gst_rate,
    })),
  };
}

/** Preview of quantity × price − discount per line. Display only; Django recomputes everything on save. */
function linePreview(it: Partial<ItemValues> | undefined) {
  const q = toCents(it?.quantity), p = toCents(it?.unit_price), d = toCents(it?.discount_amount || "0");
  if (q === null || p === null || d === null) return null;
  const gross = multiplyCents(q, p);
  return { gross, discount: d, taxable: gross - d };
}

function InvoiceFormInner({ permissions }: { permissions: FinancePermissions }) {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const existingQuery = useInvoice(id);
  const existing = existingQuery.data;
  const clientsQuery = useFinanceClients();
  const settingsQuery = useAgencySettings();
  const createMutation = useCreateInvoice();
  const updateMutation = useUpdateInvoice();

  const settings = settingsQuery.data;
  // InvoiceCalculationService: GST applies only when tax_enabled AND gst_registered.
  const gstActive = Boolean(settings && settings.tax_enabled && settings.gst_registered);

  const { register, control, handleSubmit, reset, setError, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toForm(undefined, { client: searchParams.get("client") ?? undefined }),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });

  useEffect(() => {
    if (isEditing && existing) reset(toForm(existing));
  }, [isEditing, existing, reset]);

  // When GST is not active the backend ignores rates; keep them at 0% so the stored draft matches what's shown.
  useEffect(() => {
    if (!settingsQuery.isLoading && !gstActive) {
      (watchedItems ?? []).forEach((it, i) => {
        if (it?.gst_rate !== "0.00") setValue(`items.${i}.gst_rate`, "0.00");
      });
    }
  }, [gstActive, settingsQuery.isLoading, watchedItems, setValue]);

  const preview = useMemo(() => {
    const lines = (watchedItems ?? []).map(linePreview);
    if (lines.some((l) => l === null)) return null;
    return {
      subtotal: sumCents(lines.map((l) => l!.gross)),
      discount: sumCents(lines.map((l) => l!.discount)),
      taxable: sumCents(lines.map((l) => l!.taxable)),
    };
  }, [watchedItems]);

  if (!permissions.canCreateInvoices) {
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-8 text-center shadow-sm">
        <p className="text-[14px] font-medium text-foreground">You do not have permission to create or edit invoices.</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/finance/invoices")}>Back to Invoices</Button>
      </div>
    );
  }

  if (isEditing && existingQuery.isLoading) return <div className="h-64 rounded-2xl bg-secondary/50 animate-pulse" />;

  if (isEditing && (!existing || existing.status !== "DRAFT")) {
    const notFound = !existing && (existingQuery.error as { status?: number | null } | null)?.status === 404;
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-8 text-center shadow-sm">
        <p className="text-[14px] font-medium text-foreground">
          {existing
            ? `Invoice ${existing.invoice_number} is ${existing.status.toLowerCase()} and can no longer be modified. Only draft invoices can be edited.`
            : notFound
              ? "Invoice not found."
              : extractApiErrorMessage(existingQuery.error, "Unable to load this invoice.").message}
        </p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate(existing ? `/finance/invoices/${existing.id}` : "/finance/invoices")}>
          {existing ? "View invoice" : "Back to Invoices"}
        </Button>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    if (gstActive && values.items.some((it) => (toCents(it.gst_rate) ?? 0n) > 0n) && !values.client_state.trim()) {
      setError("client_state", { type: "manual", message: "Client state is required when GST is applied (decides CGST/SGST vs IGST)" });
      return;
    }
    const payload = toPayload(values);
    try {
      if (isEditing && existing) {
        const before = toPayload(toForm(existing));
        const patch: Partial<InvoiceWritePayload> = {};
        (Object.keys(payload) as (keyof InvoiceWritePayload)[]).forEach((k) => {
          if (JSON.stringify(payload[k]) !== JSON.stringify(before[k])) (patch as Record<string, unknown>)[k] = payload[k];
        });
        if (Object.keys(patch).length === 0) {
          toast.info("No changes to save.");
          navigate(`/finance/invoices/${existing.id}`);
          return;
        }
        const saved = await updateMutation.mutateAsync({ id: existing.id, input: patch });
        navigate(`/finance/invoices/${saved.id}`);
      } else {
        const saved = await createMutation.mutateAsync(payload);
        navigate(`/finance/invoices/${saved.id}`);
      }
    } catch (err) {
      const { message, fieldErrors } = extractApiErrorMessage(err, "Failed to save invoice.");
      let mapped = false;
      const other: string[] = [];
      for (const [k, msgs] of Object.entries(fieldErrors ?? {})) {
        if (!msgs.length) continue;
        // Nested item errors arrive as "items.0.quantity".
        const itemMatch = /^items\.(\d+)\.(\w+)$/.exec(k);
        if (TOP_FIELDS.has(k)) {
          setError(k as keyof FormValues, { type: "server", message: msgs[0] });
          mapped = true;
        } else if (itemMatch && ["description", "hsn_sac", "quantity", "unit_price", "discount_amount", "gst_rate"].includes(itemMatch[2])) {
          setError(`items.${Number(itemMatch[1])}.${itemMatch[2] as keyof ItemValues}`, { type: "server", message: msgs[0] });
          mapped = true;
        } else other.push(msgs[0]);
      }
      toast.error(other.length ? other.join(" · ") : mapped ? "Please correct the highlighted fields." : message);
    }
  };

  const isPending = isSubmitting || createMutation.isPending || updateMutation.isPending;
  const clients = clientsQuery.data ?? [];
  const clientHint = clientsQuery.isError
    ? `Clients could not be loaded: ${extractApiErrorMessage(clientsQuery.error).message}`
    : !clientsQuery.isLoading && clients.length === 0
      ? "No active clients exist. Add a client first."
      : undefined;
  // Keep the draft's client selectable on edit even if it is no longer listed (inactive).
  const clientMissing = existing && !clients.some((c) => Number(c.id) === existing.client);

  return (
    <div>
      <FinanceBackHeader
        backTo={isEditing && existing ? `/finance/invoices/${existing.id}` : "/finance/invoices"}
        backLabel={isEditing ? "Back to Invoice" : "Back to Invoices"}
        title={isEditing ? `Edit Draft — ${existing?.invoice_number}` : "New Invoice"}
        description={isEditing ? "Only draft invoices can be changed. Saving replaces all line items." : "Saved as a draft. You can review it and issue it from the invoice page."}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 pb-24">
        {!settingsQuery.isLoading && (
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 px-5 py-4 text-[13px] text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              {settingsQuery.isError ? (
                <p>Agency settings could not be loaded ({extractApiErrorMessage(settingsQuery.error).message}). GST will be calculated by the backend using the saved settings.</p>
              ) : !settings ? (
                <p><strong>Agency settings are not configured</strong>, so the backend will not apply GST. Set up the agency profile in Settings before issuing invoices — otherwise the issued invoice snapshot uses placeholder agency details.</p>
              ) : !gstActive ? (
                <p><strong>GST is not applied</strong>: the agency is {settings.gst_registered ? "GST-registered but tax is disabled" : "not GST-registered"} in Settings. All lines are saved at 0%.</p>
              ) : (
                <p>GST is enabled for <strong>{settings.agency_name}</strong> ({settings.state}). The backend applies CGST + SGST when the client state matches the agency state, otherwise IGST.</p>
              )}
              <p className="text-blue-800/80">The invoice number is assigned by the backend when the draft is first saved (financial-year sequence).</p>
            </div>
          </div>
        )}

        <FinanceSectionCard title="Client" subtitle="Invoices are billed to a client">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FinanceField label="Client" required error={errors.client?.message ?? clientHint} className="md:col-span-2">
              <div className="relative">
                <select {...register("client")} aria-label="Client" disabled={clientsQuery.isLoading || (clients.length === 0 && !existing)} className={financeSelectClass(errors.client?.message ?? clientHint)}>
                  <option value="">{clientsQuery.isLoading ? "Loading clients..." : "Select client"}</option>
                  {clientMissing && existing && <option value={String(existing.client)}>{existing.client_name}</option>}
                  {clients.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.company_name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </FinanceField>
            <FinanceField label="Client State" required={gstActive} error={errors.client_state?.message} hint="Place of supply, e.g. Kerala or KL. Decides CGST/SGST vs IGST.">
              <input {...register("client_state")} maxLength={100} aria-label="Client state" placeholder="e.g. Kerala" className={financeInputClass(errors.client_state?.message)} />
            </FinanceField>
            <FinanceField label="Client GSTIN (Optional)" error={errors.client_gstin?.message}>
              <input {...register("client_gstin")} maxLength={15} aria-label="Client GSTIN" placeholder="15-character GSTIN" className={`${financeInputClass(errors.client_gstin?.message)} uppercase font-mono`} />
            </FinanceField>
          </div>
        </FinanceSectionCard>

        <FinanceSectionCard title="Invoice Details" subtitle="Dates and currency">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FinanceField label="Issue Date" required error={errors.issue_date?.message} hint="Also decides the financial year of the invoice number.">
              <div className="relative">
                <FinanceLeadIcon><Calendar className="h-4 w-4" /></FinanceLeadIcon>
                <input type="date" aria-label="Issue date" {...register("issue_date")} className={`${financeInputClass(errors.issue_date?.message)} pl-10`} />
              </div>
            </FinanceField>
            <FinanceField label="Due Date (Optional)" error={errors.due_date?.message}>
              <div className="relative">
                <FinanceLeadIcon><Calendar className="h-4 w-4" /></FinanceLeadIcon>
                <input type="date" aria-label="Due date" {...register("due_date")} className={`${financeInputClass(errors.due_date?.message)} pl-10`} />
              </div>
            </FinanceField>
            <FinanceField label="Currency" hint="Set by the backend.">
              <input value={existing?.currency ?? "INR"} readOnly aria-label="Currency" className={`${financeInputClass()} bg-slate-50 text-muted-foreground`} />
            </FinanceField>
          </div>
        </FinanceSectionCard>

        <FinanceSectionCard
          title="Line Items"
          subtitle="Taxable amount = quantity × unit price − discount"
          action={
            <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl" onClick={() => append(emptyItem())}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
          }
        >
          <div className="space-y-4">
            {fields.map((field, i) => {
              const e = errors.items?.[i];
              const lp = linePreview(watchedItems?.[i]);
              return (
                <div key={field.id} className="rounded-xl border border-border/70 bg-slate-50/40 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <FinanceField label={`Item ${i + 1} — Description`} required error={e?.description?.message} className="md:col-span-5">
                      <input {...register(`items.${i}.description`)} maxLength={255} aria-label={`Item ${i + 1} description`} placeholder="e.g. Website design — Phase 1" className={financeInputClass(e?.description?.message)} />
                    </FinanceField>
                    <FinanceField label="HSN/SAC" error={e?.hsn_sac?.message} className="md:col-span-2">
                      <input {...register(`items.${i}.hsn_sac`)} maxLength={50} aria-label={`Item ${i + 1} HSN/SAC`} placeholder="998314" className={financeInputClass(e?.hsn_sac?.message)} />
                    </FinanceField>
                    <FinanceField label="Qty" required error={e?.quantity?.message} className="md:col-span-1">
                      <input {...register(`items.${i}.quantity`)} inputMode="decimal" aria-label={`Item ${i + 1} quantity`} className={`${financeInputClass(e?.quantity?.message)} tabular-nums px-3`} />
                    </FinanceField>
                    <FinanceField label="Unit Price (₹)" required error={e?.unit_price?.message} className="md:col-span-2">
                      <input {...register(`items.${i}.unit_price`)} inputMode="decimal" aria-label={`Item ${i + 1} unit price`} placeholder="0.00" className={`${financeInputClass(e?.unit_price?.message)} tabular-nums`} />
                    </FinanceField>
                    <FinanceField label="Discount (₹)" error={e?.discount_amount?.message} className="md:col-span-2">
                      <input {...register(`items.${i}.discount_amount`)} inputMode="decimal" aria-label={`Item ${i + 1} discount`} className={`${financeInputClass(e?.discount_amount?.message)} tabular-nums`} />
                    </FinanceField>
                    <FinanceField label="GST Rate" error={e?.gst_rate?.message} hint={!gstActive ? "GST not active" : undefined} className="md:col-span-2">
                      {gstActive ? (
                        <div className="relative">
                          <select {...register(`items.${i}.gst_rate`)} aria-label={`Item ${i + 1} GST rate`} className={financeSelectClass(e?.gst_rate?.message)}>
                            {SUPPORTED_GST_RATES.map((r) => <option key={r} value={r}>{`${Number(r)}%`}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          <input type="hidden" {...register(`items.${i}.gst_rate`)} />
                          <input readOnly value="0%" aria-label={`Item ${i + 1} GST rate`} className={`${financeInputClass()} bg-slate-50 text-muted-foreground`} />
                        </>
                      )}
                    </FinanceField>
                    <div className="md:col-span-10 flex items-end justify-end text-[12.5px] text-muted-foreground">
                      Taxable (preview):{" "}
                      <span className="ml-1 font-semibold text-foreground">{lp ? <MoneyDisplay amount={centsToNumber(lp.taxable)} showDecimals /> : "—"}</span>
                    </div>
                    <div className="md:col-span-2 flex items-end justify-end">
                      <Button type="button" variant="ghost" size="sm" disabled={fields.length === 1} onClick={() => remove(i)} className="h-9 gap-1.5 text-[12px] text-red-600 hover:text-red-700" aria-label={`Remove item ${i + 1}`}>
                        <Trash2 className="h-4 w-4" /> Remove
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {errors.items?.root?.message || errors.items?.message ? (
              <p className="flex items-center gap-1 text-[12px] text-red-500"><AlertTriangle className="h-3.5 w-3.5" />{errors.items?.root?.message ?? errors.items?.message}</p>
            ) : null}

            <div className="ml-auto w-full max-w-sm space-y-1.5 rounded-xl border border-border/70 bg-white p-4 text-[13px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{preview ? <MoneyDisplay amount={centsToNumber(preview.subtotal)} showDecimals /> : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{preview ? <MoneyDisplay amount={-centsToNumber(preview.discount)} showDecimals /> : "—"}</span></div>
              <div className="flex justify-between font-semibold"><span>Taxable value</span><span>{preview ? <MoneyDisplay amount={centsToNumber(preview.taxable)} showDecimals /> : "—"}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>GST (CGST/SGST/IGST)</span><span>{gstActive ? "Calculated on save" : "₹0.00 (not active)"}</span></div>
              <p className="pt-1 text-[11.5px] text-muted-foreground">Preview only. The backend calculates the GST split and the invoice total; the saved figures appear on the invoice page.</p>
            </div>
          </div>
        </FinanceSectionCard>

        <FinanceSectionCard title="Additional Information" subtitle="Printed on the invoice">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FinanceField label="Notes for the client" error={errors.notes?.message}>
              <textarea rows={4} aria-label="Notes" {...register("notes")} className={financeTextareaClass()} placeholder="Optional message shown on the invoice" />
            </FinanceField>
            <FinanceField label="Terms & Conditions" error={errors.terms?.message} hint={settings?.default_invoice_terms ? "Leave blank to use the agency's default terms." : undefined}>
              <textarea rows={4} aria-label="Terms and conditions" {...register("terms")} className={financeTextareaClass()} placeholder={settings?.default_invoice_terms || "Payment terms"} />
            </FinanceField>
          </div>
        </FinanceSectionCard>

        <FinanceFixedFooter
          onCancel={() => navigate(isEditing && existing ? `/finance/invoices/${existing.id}` : "/finance/invoices")}
          submitLabel={isEditing ? "Save Draft" : "Save as Draft"}
          isSubmitting={isPending}
        />
      </form>
    </div>
  );
}

export function ManualInvoiceFormPage() {
  return (
    <AppLayout>
      <FinanceGuard>{(permissions) => <InvoiceFormInner permissions={permissions} />}</FinanceGuard>
    </AppLayout>
  );
}

export { ManualInvoiceFormPage as InvoiceFormPage };
