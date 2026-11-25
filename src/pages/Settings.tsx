import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  MapPin,
  ReceiptIndianRupee,
  RotateCcw,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/section";
import { IconTile, type Pastel } from "@/components/shared/icon-tile";
import { FormField, inputClass, textareaClass } from "@/components/shared/form-field";
import { ErrorState, SkeletonBlock } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { useFinancePermissions } from "@/modules/finance/hooks/use-finance";
import { useAgencySettings, useCreateAgencySettings, useUpdateAgencySettings } from "@/modules/finance/hooks/use-finance-workspace";
import { GSTIN_PATTERN, PAN_PATTERN } from "@/modules/finance/utils/tax-ids";
import type { AgencySettingsDTO, AgencySettingsPatch } from "@/modules/finance/types/api-contracts";

type SectionKey = "agency" | "business" | "tax" | "invoice" | "account" | "permissions" | "audit" | "data";

const LEGACY_TABS: Record<string, SectionKey> = {
  Profile: "account",
  Workspace: "agency",
  "Finance & GST": "invoice",
  "Finance Permissions": "permissions",
  "Audit Trail": "audit",
};

interface NavEntry {
  key: SectionKey;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: Pastel;
  group: "Agency" | "Finance" | "You" | "Advanced";
}

/* ─── Agency settings section forms (PATCH /api/settings/) ─────────────── */

type FieldDef = {
  name: keyof AgencySettingsDTO;
  label: string;
  placeholder?: string;
  optional?: boolean;
  span?: boolean;
  textarea?: boolean;
  upper?: boolean;
  hint?: string;
};

function AgencySectionForm({
  settings,
  fields,
  schema,
  extra,
}: {
  settings: AgencySettingsDTO;
  fields: FieldDef[];
  schema: z.ZodType<Record<string, unknown>, Record<string, unknown>>;
  extra?: (ctx: { values: Record<string, unknown>; set: (k: string, v: unknown) => void }) => ReactNode;
}) {
  const update = useUpdateAgencySettings();
  const pick = () => Object.fromEntries([...fields.map((f) => f.name), ...(extra ? ["gst_registered", "tax_enabled"] : [])].map((k) => [k, settings[k as keyof AgencySettingsDTO]]));
  const form = useForm<Record<string, unknown>>({ resolver: zodResolver(schema), defaultValues: pick() });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  useEffect(() => {
    reset(pick());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.updated_at]);

  const onSubmit = async (values: Record<string, unknown>) => {
    try {
      await update.mutateAsync(values as AgencySettingsPatch);
    } catch (err) {
      const { fieldErrors } = extractApiErrorMessage(err);
      Object.entries(fieldErrors || {}).forEach(([k, v]) => setError(k, { message: v[0] }));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {extra?.({ values: watch(), set: (k, v) => setValue(k, v, { shouldDirty: true }) })}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <FormField key={f.name} label={f.label} htmlFor={f.name} optional={f.optional} hint={f.hint} error={errors[f.name]?.message as string | undefined} className={cn(f.span && "sm:col-span-2")}>
            {f.textarea ? (
              <textarea id={f.name} rows={3} className={textareaClass} placeholder={f.placeholder} aria-invalid={!!errors[f.name]} {...register(f.name)} />
            ) : (
              <input id={f.name} className={cn(inputClass, f.upper && "font-mono uppercase")} placeholder={f.placeholder} aria-invalid={!!errors[f.name]} {...register(f.name)} />
            )}
          </FormField>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-end gap-3 border-t border-hairline pt-4">
        {isDirty && <span className="text-[12px] font-medium text-subtle">Unsaved changes</span>}
        <Button type="button" variant="ghost" size="sm" disabled={!isDirty} onClick={() => reset(pick())}>
          Discard
        </Button>
        <Button type="submit" size="sm" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

const optionalText = z.string().trim().optional().or(z.literal(""));

const agencySchema = z.object({
  agency_name: z.string().trim().min(1, "Agency name is required.").max(255, "Max 255 characters."),
  legal_name: optionalText,
  email: z.string().trim().email("Enter a valid email.").or(z.literal("")),
  phone: optionalText,
  website: z.string().trim().url("Include https://").or(z.literal("")),
});

// agency_settings.models.AgencySettings: address_line_1, city, state, postal_code are required (blank not allowed).
const requiredText = (label: string, max: number) => z.string().trim().min(1, `${label} is required.`).max(max, `Max ${max} characters.`);
const businessSchema = z.object({
  address_line_1: requiredText("Address line 1", 255),
  address_line_2: optionalText,
  city: requiredText("City", 100),
  state: requiredText("State", 100),
  postal_code: requiredText("PIN / postal code", 20),
  country: requiredText("Country", 100),
  pan: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => !v || PAN_PATTERN.test(v), "Enter a valid PAN, e.g. ABCDE1234F."),
});

const taxSchema = z
  .object({
    gst_registered: z.boolean(),
    tax_enabled: z.boolean(),
    gstin: z
      .string()
      .transform((v) => v.trim().toUpperCase())
      .refine((v) => !v || GSTIN_PATTERN.test(v), "Enter a valid 15-character GSTIN."),
  })
  .refine((v) => !v.gst_registered || !!v.gstin, { path: ["gstin"], message: "GSTIN is required when GST registered." });

const termsSchema = z.object({ default_invoice_terms: optionalText });

/* ─── First-time setup (POST /api/settings/) ─────────────────────────────── */

const setupSchema = agencySchema.merge(businessSchema.omit({ pan: true })).extend({ pan: businessSchema.shape.pan });

function AgencyInitialSetup() {
  const create = useCreateAgencySettings();
  const fields: FieldDef[] = [
    { name: "agency_name", label: "Agency name", placeholder: "PromoCraft" },
    { name: "legal_name", label: "Legal name", optional: true },
    { name: "email", label: "Billing email", optional: true },
    { name: "phone", label: "Phone", optional: true },
    { name: "website", label: "Website", optional: true, span: true, placeholder: "https://" },
    { name: "address_line_1", label: "Address line 1", span: true },
    { name: "address_line_2", label: "Address line 2", optional: true, span: true },
    { name: "city", label: "City" },
    { name: "state", label: "State" },
    { name: "postal_code", label: "PIN / postal code" },
    { name: "country", label: "Country" },
    { name: "pan", label: "PAN", optional: true, upper: true, hint: "10 characters, e.g. ABCDE1234F" },
  ];
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Record<string, unknown>>({
    resolver: zodResolver(setupSchema as unknown as z.ZodType<Record<string, unknown>, Record<string, unknown>>),
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, f.name === "country" ? "India" : ""])),
  });
  const onSubmit = async (values: Record<string, unknown>) => {
    try {
      await create.mutateAsync(values as AgencySettingsPatch);
    } catch (err) {
      const { fieldErrors } = extractApiErrorMessage(err);
      Object.entries(fieldErrors || {}).forEach(([k, v]) => setError(k, { message: v[0] }));
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <p className="mb-5 rounded-[14px] bg-secondary px-4 py-3 text-[12.5px] text-muted-foreground">
        Agency settings have not been configured on the server yet. Fill in the required details to create them.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <FormField key={f.name} label={f.label} htmlFor={`setup-${f.name}`} optional={f.optional} hint={f.hint} error={errors[f.name]?.message as string | undefined} className={cn(f.span && "sm:col-span-2")}>
            <input id={`setup-${f.name}`} className={cn(inputClass, f.upper && "font-mono uppercase")} placeholder={f.placeholder} aria-invalid={!!errors[f.name]} {...register(f.name)} />
          </FormField>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-end gap-3 border-t border-hairline pt-4">
        <Button type="submit" size="sm" disabled={isSubmitting || create.isPending}>
          {isSubmitting || create.isPending ? "Creating…" : "Create agency settings"}
        </Button>
      </div>
    </form>
  );
}

/* ─── Account (profile) ─────────────────────────────────────────────────── */

const profileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  timezone: z.string(),
});

function AccountSection() {
  const { currentUser, updateCurrentUser } = useStore();
  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: currentUser?.name || "", email: currentUser?.email || "", timezone: currentUser?.timezone || "Asia/Kolkata (IST)" },
  });
  useEffect(() => {
    reset({ name: currentUser?.name || "", email: currentUser?.email || "", timezone: currentUser?.timezone || "Asia/Kolkata (IST)" });
  }, [currentUser, reset]);

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (d) => {
        await updateCurrentUser(d);
        toast.success("Account details updated.");
      })}
    >
      <div className="mb-6 flex items-center gap-4 rounded-[18px] bg-gradient-to-br from-[#f2f7ff] to-[#e8f1ff] p-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#cfe0ff] to-[#d6e6ff] text-[18px] font-extrabold text-[#004fcc] ring-4 ring-white">{currentUser?.initials || "U"}</span>
        <div>
          <div className="text-[15px] font-bold">{currentUser?.name}</div>
          <div className="text-[12.5px] font-medium text-muted-foreground capitalize">{(currentUser?.role || "").toLowerCase()} · role is managed by an administrator</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="name" error={errors.name?.message}>
          <input id="name" className={inputClass} {...register("name")} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" className={inputClass} {...register("email")} />
        </FormField>
        <FormField label="Timezone" htmlFor="timezone">
          <select id="timezone" className={inputClass} {...register("timezone")}>
            {["Asia/Kolkata (IST)", "Asia/Dubai (GST)", "Europe/London (GMT)", "America/New_York (EST)", "America/Los_Angeles (PST)"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="mt-6 flex justify-end border-t border-hairline pt-4">
        <Button type="submit" size="sm" disabled={!isDirty || isSubmitting}>
          Save account
        </Button>
      </div>
    </form>
  );
}

/* ─── Demo data ─────────────────────────────────────────────────────────── */

function DemoDataSection() {
  const { resetAllDemoData } = useStore();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Users and Meetings still run on a demo dataset stored in your browser. Resetting restores that demo data only. Employees, clients, projects, tasks, notifications and finance live on the server and are not affected.
      </p>
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[16px] bg-negative-soft p-3">
          <span className="text-[13px] font-semibold text-negative">Reset all demo data? This can't be undone.</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await resetAllDemoData();
                await qc.invalidateQueries();
                setConfirm(false);
                toast.success("Demo data reset.");
              }}
            >
              Reset everything
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirm(true)}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
        </Button>
      )}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { currentUser } = useStore();
  const isAdmin = (currentUser?.role || "").toUpperCase() === "ADMIN";
  const { data: perm } = useFinancePermissions();
  const settingsQ = useAgencySettings();

  useEffect(() => {
    if ((currentUser?.role || "").toUpperCase() === "EMPLOYEE") navigate("/");
  }, [currentUser, navigate]);

  const nav: NavEntry[] = [
    ...(isAdmin
      ? ([
          { key: "agency", label: "Agency profile", hint: "Name, contact, website", icon: Building2, tone: "blue", group: "Agency" },
          { key: "business", label: "Business information", hint: "Address and PAN", icon: MapPin, tone: "sky", group: "Agency" },
          { key: "tax", label: "GST & tax", hint: "Registration and GSTIN", icon: ReceiptIndianRupee, tone: "butter", group: "Finance" },
        ] as NavEntry[])
      : []),
    ...(perm?.permissions.canManageSettings ? ([{ key: "invoice", label: "Invoice defaults", hint: "Terms printed on invoices", icon: FileText, tone: "peach", group: "Finance" }] as NavEntry[]) : []),
    { key: "account", label: "Account", hint: "Your name, email, timezone", icon: UserRound, tone: "rose", group: "You" },
    { key: "data", label: "Demo data", hint: "Reset the local dataset", icon: RotateCcw, tone: "peach", group: "Advanced" },
  ];

  const raw = params.get("tab") || "";
  const requested = (LEGACY_TABS[raw] || raw) as SectionKey;
  const active = nav.find((n) => n.key === requested)?.key ?? nav[0].key;
  const current = nav.find((n) => n.key === active)!;
  const go = (key: SectionKey) => setParams({ tab: key }, { replace: true });

  const settings = settingsQ.data;
  const needsSettings = ["agency", "business", "tax", "invoice"].includes(active);

  return (
    <AppLayout>
      <PageHeader eyebrow="System" title="Settings" description="How PromoCraft presents your agency on invoices, and how the workspace works for you." />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-4 lg:overflow-visible">
            {(["Agency", "Finance", "You", "Advanced"] as const).map((g) => {
              const items = nav.filter((n) => n.group === g);
              if (!items.length) return null;
              return (
                <div key={g} className="flex shrink-0 gap-2 lg:flex-col lg:gap-1">
                  <div className="eyebrow hidden px-3 lg:block">{g}</div>
                  {items.map((n) => (
                    <button
                      key={n.key}
                      type="button"
                      onClick={() => go(n.key)}
                      aria-current={active === n.key ? "page" : undefined}
                      className={cn(
                        "flex shrink-0 items-center gap-3 rounded-[16px] px-2.5 py-2 text-left transition-[background-color,box-shadow]",
                        active === n.key ? "bg-card shadow-md" : "hover:bg-card/60",
                      )}
                    >
                      <IconTile icon={n.icon} tone={n.tone} size="sm" />
                      <span className="min-w-0 pr-2">
                        <span className={cn("block text-[13px] font-bold whitespace-nowrap", active === n.key ? "text-primary-deep" : "text-foreground")}>{n.label}</span>
                        <span className="hidden truncate text-[11.5px] text-subtle lg:block">{n.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-5">
          <Surface className="p-5 sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <IconTile icon={current.icon} tone={current.tone} size="lg" />
              <div>
                <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">{current.label}</h2>
                <p className="text-[12.5px] text-muted-foreground">{current.hint}</p>
              </div>
            </div>

            {needsSettings && settingsQ.isLoading && <SkeletonBlock className="h-48 w-full" />}
            {needsSettings && settingsQ.isError && (
              <ErrorState description={extractApiErrorMessage(settingsQ.error, "Agency settings could not be loaded.").message} onRetry={() => settingsQ.refetch()} />
            )}
            {/* GET /api/settings/ → 404: the singleton has not been created yet. */}
            {needsSettings && settingsQ.data === null && <AgencyInitialSetup />}

            {settings && active === "agency" && (
              <AgencySectionForm
                settings={settings}
                schema={agencySchema}
                fields={[
                  { name: "agency_name", label: "Agency name", placeholder: "PromoCraft" },
                  { name: "legal_name", label: "Legal name", optional: true, placeholder: "PromoCraft Agency Pvt. Ltd." },
                  { name: "email", label: "Billing email", optional: true },
                  { name: "phone", label: "Phone", optional: true },
                  { name: "website", label: "Website", optional: true, span: true, placeholder: "https://" },
                ]}
              />
            )}
            {settings && active === "business" && (
              <AgencySectionForm
                settings={settings}
                schema={businessSchema}
                fields={[
                  { name: "address_line_1", label: "Address line 1", span: true },
                  { name: "address_line_2", label: "Address line 2", optional: true, span: true },
                  { name: "city", label: "City" },
                  { name: "state", label: "State" },
                  { name: "postal_code", label: "PIN / postal code" },
                  { name: "country", label: "Country" },
                  { name: "pan", label: "PAN", optional: true, upper: true, hint: "10 characters, e.g. ABCDE1234F" },
                ]}
              />
            )}
            {settings && active === "tax" && (
              <AgencySectionForm
                settings={settings}
                schema={taxSchema}
                fields={[{ name: "gstin", label: "GSTIN", upper: true, span: true, hint: "15 characters. The first two digits are your state code." }]}
                extra={({ values, set }) => (
                  <div className="mb-5 divide-y divide-hairline rounded-[16px] bg-secondary">
                    {[
                      ["gst_registered", "GST registered", "Your agency holds a GSTIN and charges GST on invoices."],
                      ["tax_enabled", "Apply tax on invoices", "Calculate CGST/SGST or IGST on new invoices."],
                    ].map(([k, label, hint]) => (
                      <label key={k} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5">
                        <span>
                          <span className="block text-[13px] font-bold">{label}</span>
                          <span className="block text-[12px] text-muted-foreground">{hint}</span>
                        </span>
                        <Switch checked={Boolean(values[k])} onCheckedChange={(v) => set(k, v)} />
                      </label>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3.5 text-[13px]">
                      <span className="font-bold">Currency</span>
                      <span className="rounded-full bg-card px-2.5 py-0.5 font-bold text-muted-foreground">INR · fixed</span>
                    </div>
                  </div>
                )}
              />
            )}
            {active === "invoice" && (
              <div className="space-y-8">
                {settings && (
                  <AgencySectionForm
                    settings={settings}
                    schema={termsSchema}
                    fields={[{ name: "default_invoice_terms", label: "Default invoice terms", textarea: true, span: true, optional: true, hint: "Stored on agency settings (default_invoice_terms)." }]}
                  />
                )}
              </div>
            )}
            {active === "account" && <AccountSection />}
            {active === "data" && <DemoDataSection />}
          </Surface>
        </div>
      </div>
    </AppLayout>
  );
}
