import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Building2, User, Mail, Phone, Globe, MapPin, NotebookPen, AlertCircle, Loader2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import type { ClientWritePayload } from "@/api/clients.api";

/* ─── Schema ───────────────────────────────────────────
 * Mirrors clients.models.Client + ClientCreateSerializer:
 *   company_name  required, ≤255, unique (case-insensitive; checked by the backend on create)
 *   contact_person required, ≤150
 *   email / phone / website / address / notes optional (blank allowed)
 *   phone ≤20, digits only (ClientCreateSerializer.validate_phone; applied on edit too for consistency)
 *   website URLField (≤200, scheme required)
 *   status ACTIVE | INACTIVE
 */
const schema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(255, "Max 255 characters"),
  contact_person: z.string().trim().min(1, "Contact person name is required").max(150, "Max 150 characters"),
  email: z.string().trim().max(254, "Max 254 characters")
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address"),
  phone: z.string().trim().max(20, "Max 20 digits")
    .refine((v) => v === "" || /^\d+$/.test(v), "Digits only — no spaces, dashes or +"),
  website: z.string().trim().max(200, "Max 200 characters")
    .refine((v) => v === "" || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v), "Enter a valid URL including http:// or https://"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  address: z.string(),
  notes: z.string(),
});

export type ClientFormValues = z.infer<typeof schema>;

export const EMPTY_CLIENT_FORM: ClientFormValues = {
  company_name: "", contact_person: "", email: "", phone: "", website: "", status: "ACTIVE", address: "", notes: "",
};

export function toClientPayload(v: ClientFormValues): ClientWritePayload {
  return {
    company_name: v.company_name.trim(),
    contact_person: v.contact_person.trim(),
    email: v.email.trim(),
    phone: v.phone.trim(),
    website: v.website.trim(),
    status: v.status,
    address: v.address.trim(),
    notes: v.notes.trim(),
  };
}

const FORM_FIELDS = new Set<keyof ClientFormValues>(Object.keys(EMPTY_CLIENT_FORM) as (keyof ClientFormValues)[]);

/* ─── Sub-components (unchanged visual design) ───────── */
function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border/50">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}

function Field({ label, error, required, children, hint, htmlFor }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode; hint?: React.ReactNode; htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-500">
          <AlertCircle className="h-3 w-3 shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

const inputClass = (error?: string) => cn(
  "h-11 w-full rounded-xl border bg-white px-4 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all",
  "focus:border-primary/60 focus:ring-2 focus:ring-primary/10",
  error ? "border-red-400 focus:border-red-400 focus:ring-red-500/10" : "border-border/70 hover:border-border"
);
const withIcon = "pl-10";

function LeadIcon({ children }: { children: React.ReactNode }) {
  return <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{children}</span>;
}

interface ClientFormProps {
  mode: "create" | "edit";
  defaultValues: ClientFormValues;
  /** Created By display only — `created_by` is read-only and assigned by the backend. */
  createdByName: string;
  submitLabel: string;
  isPending: boolean;
  onCancel: () => void;
  /** Throw (e.g. the ApiError) to have backend field errors mapped onto the inputs. */
  onSubmit: (values: ClientFormValues) => Promise<void>;
}

export function ClientForm({ mode, defaultValues, createdByName, submitLabel, isPending, onCancel, onSubmit }: ClientFormProps) {
  const { register, handleSubmit, watch, reset, setError, formState: { errors, isSubmitting } } = useForm<ClientFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const selectedStatus = watch("status");
  const busy = isPending || isSubmitting;

  const submit = handleSubmit(async (values) => {
    if (busy) return;
    try {
      await onSubmit(values);
    } catch (err) {
      const { message, fieldErrors } = extractApiErrorMessage(err, "Failed to save client.");
      const unmapped: string[] = [];
      let mapped = false;
      for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
        if (!messages.length) continue;
        if (FORM_FIELDS.has(field as keyof ClientFormValues)) {
          setError(field as keyof ClientFormValues, { type: "server", message: messages[0] });
          mapped = true;
        } else {
          unmapped.push(messages[0]);
        }
      }
      if (unmapped.length) toast.error(unmapped.join(" · "));
      else if (mapped) toast.error("Please correct the highlighted fields.");
      else toast.error(message);
    }
  });

  return (
    <>
      <form onSubmit={submit} noValidate className="space-y-6 pb-24">
        {/* Section 1 — Basic Information */}
        <SectionCard title="Basic Information" subtitle="Primary company information.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Company Name" error={errors.company_name?.message} required htmlFor="client-company">
              <div className="relative">
                <LeadIcon><Building2 className="h-4 w-4" /></LeadIcon>
                <input id="client-company" {...register("company_name")} maxLength={255} placeholder="PromoCraft Technologies Pvt Ltd" className={cn(inputClass(errors.company_name?.message), withIcon)} />
              </div>
            </Field>

            <Field label="Contact Person" error={errors.contact_person?.message} required htmlFor="client-contact">
              <div className="relative">
                <LeadIcon><User className="h-4 w-4" /></LeadIcon>
                <input id="client-contact" {...register("contact_person")} maxLength={150} placeholder="John Smith" className={cn(inputClass(errors.contact_person?.message), withIcon)} />
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* Section 2 — Contact Information */}
        <SectionCard title="Contact Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Email Address" error={errors.email?.message} htmlFor="client-email">
              <div className="relative">
                <LeadIcon><Mail className="h-4 w-4" /></LeadIcon>
                <input id="client-email" {...register("email")} type="email" autoComplete="off" placeholder="contact@company.com" className={cn(inputClass(errors.email?.message), withIcon)} />
              </div>
            </Field>

            <Field label="Phone Number" error={errors.phone?.message} htmlFor="client-phone" hint="Digits only.">
              <div className="relative">
                <LeadIcon><Phone className="h-4 w-4" /></LeadIcon>
                <input id="client-phone" {...register("phone")} type="tel" inputMode="numeric" maxLength={20} placeholder="9876543210" className={cn(inputClass(errors.phone?.message), withIcon)} />
              </div>
            </Field>

            <Field label="Website" error={errors.website?.message} hint="Include https:// for validation." htmlFor="client-website">
              <div className="relative">
                <LeadIcon><Globe className="h-4 w-4" /></LeadIcon>
                <input id="client-website" {...register("website")} type="url" maxLength={200} placeholder="https://company.com" className={cn(inputClass(errors.website?.message), withIcon)} />
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* Section 3 — Business Information */}
        <SectionCard title="Business Information">
          <div className="space-y-5">
            <Field
              label="Status"
              error={errors.status?.message}
              required
              hint={
                mode === "create"
                  ? "New clients start Active. The API hides Inactive clients, so a client created Inactive could not be opened again."
                  : selectedStatus === "INACTIVE"
                    ? (
                      <span className="inline-flex items-start gap-1 text-amber-700">
                        <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                        Saving as Inactive deactivates this client: it disappears from the client list, detail page and project client picker, and cannot be reactivated from this app.
                      </span>
                    )
                    : undefined
              }
            >
              <div className="flex flex-wrap gap-3 mt-1">
                {([
                  { value: "ACTIVE",   label: "Active", color: "text-emerald-600", dot: "bg-emerald-500", ring: "border-emerald-500" },
                  { value: "INACTIVE", label: "Inactive", color: "text-slate-500",   dot: "bg-slate-400",   ring: "border-slate-400" },
                ] as const).map(({ value, label, color, dot, ring }) => {
                  const selected = selectedStatus === value;
                  const disabled = mode === "create" && value === "INACTIVE";
                  return (
                    <label key={value} className={cn("flex items-center gap-2.5", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                      <input {...register("status")} type="radio" value={value} disabled={disabled} className="sr-only" />
                      <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors", selected ? ring : "border-border")}>
                        {selected && <span className="h-2 w-2 rounded-full bg-current" />}
                      </span>
                      <span className={cn("flex items-center gap-1.5 text-[13px] font-medium", selected ? color : "text-muted-foreground")}>
                        <span className={cn("h-2 w-2 rounded-full", dot)} />
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </Field>

            <Field label="Created By" hint={mode === "create" ? "Automatically set by the server to the logged-in user." : "Set by the server when the client was created."}>
              <div className="relative">
                <LeadIcon><User className="h-4 w-4" /></LeadIcon>
                <input
                  disabled
                  value={createdByName || "—"}
                  className={cn(inputClass(), withIcon, "cursor-not-allowed opacity-60 bg-secondary/30")}
                />
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* Section 4 — Address */}
        <SectionCard title="Address">
          <Field label="Full Address" error={errors.address?.message} htmlFor="client-address">
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <textarea
                id="client-address"
                {...register("address")}
                rows={5}
                placeholder="Enter company address..."
                className="w-full rounded-xl border border-border/70 bg-white pl-10 pr-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none resize-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/10 hover:border-border"
              />
            </div>
          </Field>
        </SectionCard>

        {/* Section 5 — Notes */}
        <SectionCard title="Notes">
          <Field label="Internal Notes" error={errors.notes?.message} hint="Not visible to the client." htmlFor="client-notes">
            <div className="relative">
              <NotebookPen className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <textarea
                id="client-notes"
                {...register("notes")}
                rows={5}
                placeholder="Additional client information, meeting notes, special requirements..."
                className="w-full rounded-xl border border-border/70 bg-white pl-10 pr-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none resize-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/10 hover:border-border"
              />
            </div>
          </Field>
        </SectionCard>
      </form>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-white/95 backdrop-blur-sm px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="h-11 px-6 rounded-xl text-[13px]">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="h-11 min-w-[160px] gap-2 rounded-xl text-[13px] shadow-sm"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
