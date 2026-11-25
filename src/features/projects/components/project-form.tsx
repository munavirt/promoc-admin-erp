import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  FolderKanban, AlertCircle, Calendar as CalendarIcon, IndianRupee, Building2,
  AlignLeft, BarChart2, Plus, Trash2, Shield, Loader2, RefreshCcw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listAllClients } from "@/api/clients.api";
import { listAllEmployees } from "@/api/employees.api";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_ROLE_LABELS,
  PROJECT_STATUS_LABELS,
  SELECTABLE_PROJECT_STATUSES,
  labelFor,
  type ProjectMemberBackend,
  type ProjectPriority,
  type ProjectRole,
  type ProjectStatus,
} from "@/api/projects.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";

const PROJECT_ROLES = Object.entries(PROJECT_ROLE_LABELS).map(([value, label]) => ({ value, label }));

/* ─── Schema ───────────────────────────────────────────
 * Mirrors projects.models.Project + ProjectSerializer:
 *   project_name required ≤255 · client required (ACTIVE client PK) · description optional
 *   status PLANNING|IN_PROGRESS|ON_HOLD|COMPLETED (CANCELLED only via archive) · priority LOW..URGENT
 *   budget optional, ≥0, DecimalField(12,2) · progress int 0–100 · start_date/deadline required, deadline ≥ start_date
 * ProjectMemberCreateSerializer: active employees only, one PROJECT_MANAGER per project, no duplicates.
 */
const memberSchema = z.object({
  employee: z.string().min(1, "Employee is required"),
  role_in_project: z.string().min(1, "Role is required"),
});

const schema = z
  .object({
    project_name: z.string().trim().min(1, "Project name is required").max(255, "Max 255 characters"),
    client: z.string().min(1, "Client is required"),
    description: z.string(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]),
    budget: z.string().trim().refine(
      (v) => v === "" || /^\d{1,10}(\.\d{1,2})?$/.test(v),
      "Enter a non-negative amount (max 10 digits, 2 decimals)",
    ),
    progress: z.string().trim().refine(
      (v) => /^\d{1,3}$/.test(v) && Number(v) <= 100,
      "Progress must be a whole number between 0 and 100",
    ),
    start_date: z.string().min(1, "Start date is required"),
    deadline: z.string().min(1, "Deadline is required"),
    newMembers: z.array(memberSchema),
  })
  .refine((d) => !d.start_date || !d.deadline || d.deadline >= d.start_date, {
    message: "Deadline cannot be earlier than the start date",
    path: ["deadline"],
  });

export type ProjectFormValues = z.infer<typeof schema>;
export type NewMember = z.infer<typeof memberSchema>;

export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  project_name: "", client: "", description: "", priority: "MEDIUM", status: "PLANNING",
  budget: "", progress: "0", start_date: "", deadline: "", newMembers: [],
};

/** Form → ProjectSerializer write fields (budget "" → null, progress → int). */
export function toProjectPayload(v: ProjectFormValues) {
  return {
    project_name: v.project_name.trim(),
    client: Number(v.client),
    description: v.description.trim(),
    priority: v.priority as ProjectPriority,
    status: v.status as ProjectStatus,
    budget: v.budget.trim() === "" ? null : v.budget.trim(),
    progress: Number(v.progress),
    start_date: v.start_date,
    deadline: v.deadline,
  };
}

/** Backend field → form field for 400 responses on the project itself. */
const PROJECT_FIELDS = new Set(["project_name", "client", "description", "priority", "status", "budget", "progress", "start_date", "deadline"]);

/** Applies backend field errors from a project create/update to the form; returns true if any were mapped. */
export function applyProjectFieldErrors(
  err: unknown,
  setError: (name: keyof ProjectFormValues, e: { type: string; message: string }) => void,
): void {
  const { message, fieldErrors } = extractApiErrorMessage(err, "Failed to save project.");
  const unmapped: string[] = [];
  let mapped = false;
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    if (!messages.length) continue;
    if (PROJECT_FIELDS.has(field)) {
      setError(field as keyof ProjectFormValues, { type: "server", message: messages[0] });
      mapped = true;
    } else {
      unmapped.push(messages[0]);
    }
  }
  if (unmapped.length) toast.error(unmapped.join(" · "));
  else if (mapped) toast.error("Please correct the highlighted fields.");
  else toast.error(message);
}

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

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
}

interface ProjectFormProps {
  mode: "create" | "edit";
  defaultValues: ProjectFormValues;
  /** Edit only: the project's current client, kept selectable even if it is no longer active. */
  currentClient?: { id: string; name: string };
  /** Edit only: current members (removal is immediate, via its own endpoint). */
  existingMembers?: ProjectMemberBackend[];
  membersLoading?: boolean;
  onRemoveMember?: (member: ProjectMemberBackend) => void;
  removingMemberId?: string | number | null;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  onCancel: () => void;
  /** Receives form helpers so the page can map backend errors after its own request sequence. */
  onSubmit: (values: ProjectFormValues, helpers: { setError: (name: keyof ProjectFormValues, e: { type: string; message: string }) => void }) => Promise<void>;
}

export function ProjectForm({
  mode, defaultValues, currentClient, existingMembers = [], membersLoading, onRemoveMember, removingMemberId,
  submitLabel, pendingLabel, isPending, onCancel, onSubmit,
}: ProjectFormProps) {
  // Only ACTIVE clients are accepted by ProjectSerializer (and the clients API only returns active ones).
  const clientsQuery = useQuery({
    queryKey: ["clients", "all"],
    queryFn: ({ signal }) => listAllClients({ ordering: "company_name" }, signal),
  });
  // Only ACTIVE employees can be assigned (ProjectMemberCreateSerializer).
  const employeesQuery = useQuery({
    queryKey: ["employees", "active"],
    queryFn: ({ signal }) => listAllEmployees({ status: "ACTIVE" }, signal),
  });
  const clients = clientsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];

  const { register, control, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "newMembers" });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const busy = isPending || isSubmitting;
  const assignedEmployeeIds = new Set(existingMembers.map((m) => String(m.employee)));
  const hasManager = existingMembers.some((m) => m.role_in_project === "PROJECT_MANAGER");
  const currentClientMissing = Boolean(currentClient && !clients.some((c) => String(c.id) === currentClient.id));

  const submit = handleSubmit(async (values) => {
    if (busy) return;
    // Mirror ProjectMemberCreateSerializer rules before any request is sent.
    const seen = new Set<string>();
    let invalid = false;
    let managers = hasManager ? 1 : 0;
    values.newMembers.forEach((m, i) => {
      if (assignedEmployeeIds.has(m.employee) || seen.has(m.employee)) {
        setError(`newMembers.${i}.employee` as keyof ProjectFormValues, { type: "manual", message: "This employee is already on the team" });
        invalid = true;
      }
      seen.add(m.employee);
      if (m.role_in_project === "PROJECT_MANAGER" && ++managers > 1) {
        setError(`newMembers.${i}.role_in_project` as keyof ProjectFormValues, { type: "manual", message: "A project can only have one Project Manager" });
        invalid = true;
      }
    });
    if (invalid) return;
    await onSubmit(values, { setError });
  });

  const clientPickerBlocked = clientsQuery.isError || (!clientsQuery.isLoading && clients.length === 0 && !currentClient);

  return (
    <>
      <form onSubmit={submit} noValidate className="space-y-6 pb-24">
        {/* Section 1 — Basic Information */}
        <SectionCard title="Basic Information" subtitle="Primary project information.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Project Name" error={errors.project_name?.message} required htmlFor="project-name">
              <div className="relative">
                <LeadIcon><FolderKanban className="h-4 w-4" /></LeadIcon>
                <input id="project-name" {...register("project_name")} maxLength={255} placeholder="Website Redesign" className={cn(inputClass(errors.project_name?.message), withIcon)} />
              </div>
            </Field>

            <Field
              label="Client"
              error={errors.client?.message}
              required
              htmlFor="project-client"
              hint={
                clientsQuery.isError ? (
                  <span className="inline-flex items-center gap-1.5 text-red-600">
                    Clients could not be loaded: {extractApiErrorMessage(clientsQuery.error).message}
                    <button type="button" onClick={() => void clientsQuery.refetch()} className="inline-flex items-center gap-1 font-medium underline">
                      <RefreshCcw className="h-3 w-3" /> Retry
                    </button>
                  </span>
                ) : !clientsQuery.isLoading && clients.length === 0 && !currentClient ? (
                  <span className="text-amber-700">
                    No active clients exist yet. <Link to="/clients/new" className="font-medium underline">Add a client</Link> first.
                  </span>
                ) : currentClientMissing ? (
                  <span className="text-amber-700">The current client is inactive. Keep it, or choose an active client.</span>
                ) : (
                  "Only active clients can be selected."
                )
              }
            >
              <div className="relative">
                <LeadIcon>{clientsQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}</LeadIcon>
                <select id="project-client" {...register("client")} className={cn(inputClass(errors.client?.message), withIcon, "appearance-none")} disabled={clientsQuery.isLoading || clientPickerBlocked}>
                  <option value="">{clientsQuery.isLoading ? "Loading clients..." : "Select a client..."}</option>
                  {currentClientMissing && currentClient && (
                    <option value={currentClient.id}>{currentClient.name} (inactive)</option>
                  )}
                  {clients.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.company_name}</option>
                  ))}
                </select>
              </div>
            </Field>

            <div className="md:col-span-2">
              <Field label="Description" error={errors.description?.message} htmlFor="project-description">
                <div className="relative">
                  <AlignLeft className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <textarea
                    id="project-description"
                    {...register("description")}
                    rows={4}
                    placeholder="Brief description of the project scope..."
                    className="w-full rounded-xl border border-border/70 bg-white pl-10 pr-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none resize-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/10 hover:border-border"
                  />
                </div>
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* Section 2 — Planning */}
        <SectionCard title="Planning">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="Priority" error={errors.priority?.message} required htmlFor="project-priority">
              <select id="project-priority" {...register("priority")} className={cn(inputClass(errors.priority?.message), "appearance-none")}>
                {(Object.keys(PROJECT_PRIORITY_LABELS) as ProjectPriority[]).map((p) => (
                  <option key={p} value={p}>{PROJECT_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </Field>

            <Field label="Status" error={errors.status?.message} required htmlFor="project-status" hint="To cancel a project, use Archive on the project.">
              <select id="project-status" {...register("status")} className={cn(inputClass(errors.status?.message), "appearance-none")}>
                {SELECTABLE_PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </Field>

            <Field label="Budget" error={errors.budget?.message} htmlFor="project-budget" hint="Optional. INR, up to 2 decimals.">
              <div className="relative">
                <LeadIcon><IndianRupee className="h-4 w-4" /></LeadIcon>
                <input id="project-budget" {...register("budget")} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" className={cn(inputClass(errors.budget?.message), withIcon)} />
              </div>
            </Field>

            <Field label={mode === "create" ? "Initial Progress (%)" : "Progress (%)"} error={errors.progress?.message} required htmlFor="project-progress">
              <div className="relative">
                <LeadIcon><BarChart2 className="h-4 w-4" /></LeadIcon>
                <input id="project-progress" {...register("progress")} type="number" min="0" max="100" step="1" inputMode="numeric" className={cn(inputClass(errors.progress?.message), withIcon)} />
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* Section 3 — Timeline */}
        <SectionCard title="Timeline">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Start Date" error={errors.start_date?.message} required htmlFor="project-start">
              <div className="relative">
                <LeadIcon><CalendarIcon className="h-4 w-4" /></LeadIcon>
                <input id="project-start" {...register("start_date")} type="date" className={cn(inputClass(errors.start_date?.message), withIcon)} />
              </div>
            </Field>

            <Field label="Deadline" error={errors.deadline?.message} required htmlFor="project-deadline">
              <div className="relative">
                <LeadIcon><CalendarIcon className="h-4 w-4" /></LeadIcon>
                <input id="project-deadline" {...register("deadline")} type="date" className={cn(inputClass(errors.deadline?.message), withIcon)} />
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* Section 4 — Team */}
        <SectionCard
          title="Team Assignment"
          subtitle={mode === "create"
            ? "Assign initial members. They are added right after the project is created."
            : "Manage the team. Removing a member takes effect immediately; new members are added when you save."}
        >
          <div className="space-y-4">
            {mode === "edit" && (
              <>
                <h3 className="text-[13px] font-medium text-foreground border-b border-border/50 pb-2">Current Members</h3>
                {membersLoading ? (
                  <div className="h-14 rounded-xl bg-secondary/60 animate-pulse" />
                ) : existingMembers.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No members assigned yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {existingMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-white px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">
                            {getInitials(member.employee_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-foreground">{member.employee_name || "Unknown Member"}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{labelFor(PROJECT_ROLE_LABELS, member.role_in_project)}{member.employee_designation ? ` · ${member.employee_designation}` : ""}</p>
                          </div>
                        </div>
                        <Button
                          type="button" variant="ghost" size="sm"
                          aria-label={`Remove ${member.employee_name || "member"}`}
                          onClick={() => onRemoveMember?.(member)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={busy || removingMemberId !== null && removingMemberId !== undefined}
                        >
                          {String(removingMemberId) === String(member.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <h3 className="text-[13px] font-medium text-foreground border-b border-border/50 pb-2">Add New Members</h3>
              </>
            )}

            {employeesQuery.isError && (
              <p className="flex items-center gap-1.5 text-[12px] text-red-600">
                <AlertCircle className="h-3.5 w-3.5" /> Employees could not be loaded: {extractApiErrorMessage(employeesQuery.error).message}
              </p>
            )}

            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-secondary/20 p-4 rounded-xl border border-border/50">
                <div className="flex-1 w-full">
                  <Field label="Employee" error={errors.newMembers?.[index]?.employee?.message}>
                    <select {...register(`newMembers.${index}.employee`)} className={cn(inputClass(errors.newMembers?.[index]?.employee?.message), "appearance-none bg-white")} disabled={employeesQuery.isLoading}>
                      <option value="">{employeesQuery.isLoading ? "Loading employees..." : "Select employee..."}</option>
                      {employees.filter((e) => !assignedEmployeeIds.has(String(e.id))).map((e) => (
                        <option key={e.id} value={String(e.id)}>{e.name} ({e.designation})</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="flex-1 w-full">
                  <Field label="Role in Project" error={errors.newMembers?.[index]?.role_in_project?.message}>
                    <div className="relative">
                      <LeadIcon><Shield className="h-4 w-4 z-10" /></LeadIcon>
                      <select {...register(`newMembers.${index}.role_in_project`)} className={cn(inputClass(errors.newMembers?.[index]?.role_in_project?.message), withIcon, "appearance-none bg-white")}>
                        <option value="">Select role...</option>
                        {PROJECT_ROLES.map((r) => (
                          <option key={r.value} value={r.value} disabled={r.value === "PROJECT_MANAGER" && hasManager}>
                            {r.label}{r.value === "PROJECT_MANAGER" && hasManager ? " (already assigned)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Field>
                </div>
                <div className="sm:pt-6">
                  <Button type="button" variant="ghost" aria-label="Remove row" onClick={() => remove(index)} className="h-11 px-3 text-red-600 hover:text-red-700 hover:bg-red-50" disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button" variant="outline"
              onClick={() => append({ employee: "", role_in_project: "" as ProjectRole })}
              disabled={busy || employeesQuery.isError}
              className="gap-2 border-dashed border-border/80 hover:border-primary/50 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add Team Member
            </Button>
            {!employeesQuery.isLoading && !employeesQuery.isError && employees.length === 0 && (
              <p className="text-[12px] text-muted-foreground">There are no active employees to assign.</p>
            )}
          </div>
        </SectionCard>
      </form>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-white/95 backdrop-blur-sm px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <Button type="button" variant="outline" onClick={onCancel} className="h-11 px-6 rounded-xl text-[13px]" disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || clientPickerBlocked}
            onClick={() => void submit()}
            className="h-11 min-w-[160px] gap-2 rounded-xl text-[13px] shadow-sm"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {pendingLabel}
              </>
            ) : (
              <>
                <FolderKanban className="h-4 w-4" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
