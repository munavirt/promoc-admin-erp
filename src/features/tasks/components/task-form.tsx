import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ClipboardList, FolderKanban, Flag, CircleDot, UserRound,
  Clock3, CalendarDays, FileText, Plus, AlertCircle, ChevronDown, Loader2, X, Paperclip, RefreshCcw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAllProjects } from "@/api/projects.api";
import { listAllEmployees } from "@/api/employees.api";
import {
  ATTACHMENT_ALLOWED_EXTENSIONS, SELECTABLE_TASK_STATUSES, TASK_STATUS_LABELS, validateAttachment,
  type TaskWritePayload,
} from "@/api/tasks.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { todayLocalISO } from "@/features/employees/lib/dates";

/* ─── Schema ───────────────────────────────────────────
 * Mirrors work_item.models.WorkItem + WorkItemCreateSerializer:
 *   title required ≤255 · project required · assigned_to optional (ACTIVE employee) · priority / status enums
 *   progress 0–100, and 100 when status is COMPLETED · estimated_hours Decimal(5,1) nullable · due_date required,
 *   not in the past on create (server date).
 */
const UNASSIGNED = "__unassigned__";

function buildSchema(mode: "create" | "edit") {
  return z
    .object({
      title: z.string().trim().min(1, "Task title is required").max(255, "Max 255 characters"),
      project: z.string().min(1, "Project is required"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      taskStatus: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "BLOCKED", "CANCELLED"]),
      assignee: z.string(),
      estimatedHours: z.string().trim().refine((v) => v === "" || /^\d{1,4}(\.\d)?$/.test(v), "Up to 4 digits and 1 decimal, e.g. 2.5"),
      due: z.string().min(1, "Due date is required"),
      progress: z.number().int().min(0).max(100),
      description: z.string(),
    })
    .refine((d) => mode === "edit" || !d.due || d.due >= todayLocalISO(), { message: "Due date cannot be in the past", path: ["due"] })
    .refine((d) => d.taskStatus !== "COMPLETED" || d.progress === 100, { message: "Completed tasks must have 100% progress", path: ["progress"] });
}

export type TaskFormValues = z.infer<ReturnType<typeof buildSchema>>;

export const EMPTY_TASK_FORM: TaskFormValues = {
  title: "", project: "", priority: "MEDIUM", taskStatus: "TODO", assignee: UNASSIGNED,
  estimatedHours: "", due: "", progress: 0, description: "",
};

export const toAssigneeField = (assignedTo: number | string | null | undefined) =>
  assignedTo === null || assignedTo === undefined || assignedTo === "" ? UNASSIGNED : String(assignedTo);

/** Form values → WorkItemCreateSerializer fields. */
export function toTaskPayload(v: TaskFormValues): TaskWritePayload {
  return {
    title: v.title.trim(),
    project: Number(v.project),
    assigned_to: v.assignee === UNASSIGNED ? null : Number(v.assignee),
    priority: v.priority,
    status: v.taskStatus,
    progress: v.progress,
    estimated_hours: v.estimatedHours.trim() === "" ? null : v.estimatedHours.trim(),
    due_date: v.due,
    description: v.description.trim(),
  };
}

const FIELD_MAP: Record<string, keyof TaskFormValues> = {
  title: "title", project: "project", assigned_to: "assignee", priority: "priority", status: "taskStatus",
  progress: "progress", estimated_hours: "estimatedHours", due_date: "due", description: "description",
};

export function applyTaskFieldErrors(err: unknown, setError: (n: keyof TaskFormValues, e: { type: string; message: string }) => void) {
  const { message, fieldErrors } = extractApiErrorMessage(err, "Failed to save task.");
  const unmapped: string[] = [];
  let mapped = false;
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    if (!messages.length) continue;
    const target = FIELD_MAP[field];
    if (target) {
      setError(target, { type: "server", message: messages[0] });
      mapped = true;
    } else unmapped.push(messages[0]);
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

const PRIORITY_CONFIG = {
  LOW:    { active: "border-blue-500 bg-blue-50 text-blue-700",     inactive: "border-border/70 text-muted-foreground", dot: "bg-blue-400", label: "Low" },
  MEDIUM: { active: "border-amber-500 bg-amber-50 text-amber-700",  inactive: "border-border/70 text-muted-foreground", dot: "bg-amber-400", label: "Medium" },
  HIGH:   { active: "border-orange-500 bg-orange-50 text-orange-700", inactive: "border-border/70 text-muted-foreground", dot: "bg-orange-500", label: "High" },
  URGENT: { active: "border-red-500 bg-red-50 text-red-700",        inactive: "border-border/70 text-muted-foreground", dot: "bg-red-500", label: "Urgent" },
};

function TaskPreview({ title, project, priority, assignee, due, taskStatus }: {
  title: string; project: string; priority: string; assignee: string; due: string; taskStatus: string;
}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  const dueLabel = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";
  return (
    <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden sticky top-6">
      <div className="px-5 py-4 border-b border-border/50 bg-slate-50/60">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</p>
      </div>
      <div className="px-5 py-5 space-y-4">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1">Task Title</p>
          <p className="text-[14px] font-semibold text-foreground break-words">{title || "—"}</p>
        </div>
        {[
          { label: "Project",  value: project    || "—", icon: <FolderKanban className="h-3.5 w-3.5" /> },
          { label: "Priority", value: priority   || "—", icon: <Flag className="h-3.5 w-3.5" /> },
          { label: "Assignee", value: assignee   || "—", icon: <UserRound className="h-3.5 w-3.5" /> },
          { label: "Due Date", value: dueLabel, icon: <CalendarDays className="h-3.5 w-3.5" /> },
          { label: "Status",   value: taskStatus || "—", icon: <CircleDot className="h-3.5 w-3.5" /> },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">{row.icon}{row.label}</span>
            <span className="text-[12px] font-semibold text-foreground truncate max-w-[120px]">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TaskFormProps {
  mode: "create" | "edit";
  defaultValues: TaskFormValues;
  /** Edit: current project/assignee, kept selectable even if archived / inactive. */
  current?: { projectId: string; projectName: string; assigneeId: string | null; assigneeName?: string | null };
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  onCancel: () => void;
  /** Create only: files queued for upload once the task exists. */
  onSubmit: (values: TaskFormValues, helpers: { setError: (n: keyof TaskFormValues, e: { type: string; message: string }) => void; files: File[] }) => Promise<void>;
}

export function TaskForm({ mode, defaultValues, current, submitLabel, pendingLabel, isPending, onCancel, onSubmit }: TaskFormProps) {
  // Projects: the API lists every non-archived project. Employees: only ACTIVE ones can be assigned.
  const projectsQuery = useQuery({ queryKey: ["projects", "all", "picker"], queryFn: ({ signal }) => listAllProjects({ ordering: "-created_at" }, signal) });
  const employeesQuery = useQuery({ queryKey: ["employees", "active"], queryFn: ({ signal }) => listAllEmployees({ status: "ACTIVE" }, signal) });
  const projects = projectsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];

  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, setValue, control, reset, setError, formState: { errors, isSubmitting } } = useForm<TaskFormValues>({
    resolver: zodResolver(buildSchema(mode)),
    defaultValues,
  });
  useEffect(() => reset(defaultValues), [defaultValues, reset]);

  const busy = isPending || isSubmitting;
  const progress = watch("progress");
  const projectMissing = Boolean(current && !projects.some((p) => String(p.id) === current.projectId));
  const assigneeMissing = Boolean(current?.assigneeId && !employees.some((e) => String(e.id) === current.assigneeId));

  const watched = {
    title: watch("title") || "",
    project: projects.find((p) => String(p.id) === watch("project"))?.project_name || "",
    priority: PRIORITY_CONFIG[watch("priority") as keyof typeof PRIORITY_CONFIG]?.label || "Medium",
    assignee: watch("assignee") === UNASSIGNED ? "Unassigned" : employees.find((e) => String(e.id) === watch("assignee"))?.name || "",
    due: watch("due") || "",
    taskStatus: TASK_STATUS_LABELS[watch("taskStatus") as keyof typeof TASK_STATUS_LABELS] || "To Do",
  };

  const addFiles = (list: File[]) => {
    const problems: string[] = [];
    const ok = list.filter((f) => {
      const bad = validateAttachment(f);
      if (bad) problems.push(bad);
      return !bad;
    });
    setFileErrors(problems);
    setFiles((prev) => [...prev, ...ok]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = handleSubmit(async (values) => {
    if (busy) return;
    await onSubmit(values, { setError, files });
  });

  const noProjects = !projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0 && !current;

  return (
    <>
      <form onSubmit={submit} noValidate className="pb-24">
        <div className={cn("grid grid-cols-1 gap-6", mode === "create" && "xl:grid-cols-3")}>
          <div className={cn("space-y-6", mode === "create" && "xl:col-span-2")}>

            {/* Section 1 — Task Information */}
            <SectionCard title="Task Information" subtitle="Basic information about this task.">
              <div className="space-y-5">
                <Field label="Task Title" error={errors.title?.message} required htmlFor="task-title">
                  <div className="relative">
                    <LeadIcon><ClipboardList className="h-4 w-4" /></LeadIcon>
                    <input id="task-title" {...register("title")} maxLength={255} placeholder="Enter task title..." className={cn(inputClass(errors.title?.message), withIcon)} />
                  </div>
                </Field>

                <Field
                  label="Project" error={errors.project?.message} required htmlFor="task-project"
                  hint={
                    projectsQuery.isError ? (
                      <span className="inline-flex items-center gap-1.5 text-red-600">
                        Projects could not be loaded: {extractApiErrorMessage(projectsQuery.error).message}
                        <button type="button" onClick={() => void projectsQuery.refetch()} className="inline-flex items-center gap-1 font-medium underline"><RefreshCcw className="h-3 w-3" /> Retry</button>
                      </span>
                    ) : noProjects ? (
                      <span className="text-amber-700">No projects exist yet. <Link to="/projects/new" className="font-medium underline">Create a project</Link> first.</span>
                    ) : projectMissing ? (
                      <span className="text-amber-700">The current project is archived. Keep it, or move the task to an active project.</span>
                    ) : undefined
                  }
                >
                  <div className="relative">
                    <LeadIcon>{projectsQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderKanban className="h-4 w-4" />}</LeadIcon>
                    <select id="task-project" {...register("project")} disabled={projectsQuery.isLoading || projectsQuery.isError || noProjects} className={cn(inputClass(errors.project?.message), withIcon, "appearance-none pr-8")}>
                      <option value="">{projectsQuery.isLoading ? "Loading projects..." : "Select Project"}</option>
                      {projectMissing && current && <option value={current.projectId}>{current.projectName} (archived)</option>}
                      {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}{p.client_name ? ` — ${p.client_name}` : ""}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </Field>

                <Field label="Priority" error={errors.priority?.message} required>
                  <div className="flex flex-wrap gap-2">
                    {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => {
                      const selected = watch("priority") === p;
                      const cfg = PRIORITY_CONFIG[p];
                      return (
                        <label key={p} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all", selected ? cfg.active : cfg.inactive + " hover:border-border")}>
                          <input {...register("priority")} type="radio" value={p} className="sr-only" />
                          <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
                          {cfg.label}
                        </label>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Status" error={errors.taskStatus?.message} required htmlFor="task-status" hint="To cancel a task, use Archive on the task page.">
                  <div className="relative">
                    <LeadIcon><CircleDot className="h-4 w-4" /></LeadIcon>
                    <select
                      id="task-status"
                      {...register("taskStatus", {
                        // Completed requires 100% progress (backend rule) — move the slider visibly.
                        onChange: (e) => { if (e.target.value === "COMPLETED") setValue("progress", 100, { shouldValidate: true }); },
                      })}
                      className={cn(inputClass(errors.taskStatus?.message), withIcon, "appearance-none pr-8")}
                    >
                      {SELECTABLE_TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </Field>
              </div>
            </SectionCard>

            {/* Section 2 — Assignment */}
            <SectionCard title="Assignment" subtitle="Assign this task to a team member.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field
                  label="Assignee" error={errors.assignee?.message}
                  hint={
                    employeesQuery.isError ? <span className="text-red-600">Employees could not be loaded: {extractApiErrorMessage(employeesQuery.error).message}</span>
                    : assigneeMissing ? <span className="text-amber-700">The current assignee is no longer active. Keep them, or choose an active employee.</span>
                    : mode === "create" ? "The assignee gets an in-app notification when the task is created."
                    : "Reassigning does not send a notification (the backend only notifies on creation)."
                  }
                >
                  <div className="relative">
                    <LeadIcon><UserRound className="h-4 w-4 z-10" /></LeadIcon>
                    <Controller
                      name="assignee"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || UNASSIGNED} disabled={employeesQuery.isLoading}>
                          <SelectTrigger className={cn(inputClass(errors.assignee?.message), withIcon)} aria-label="Assignee">
                            <SelectValue placeholder={employeesQuery.isLoading ? "Loading employees..." : "Select employee"} />
                          </SelectTrigger>
                          <SelectContent className="z-[100]">
                            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                            {assigneeMissing && current?.assigneeId && (
                              <SelectItem value={current.assigneeId}>{current.assigneeName || `Employee #${current.assigneeId}`} (inactive)</SelectItem>
                            )}
                            {employees.map((e) => (
                              <SelectItem key={e.id} value={String(e.id)}>{e.name} — {e.designation}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </Field>

                <Field label="Estimated Hours" error={errors.estimatedHours?.message} hint="Optional. One decimal, e.g. 2.5" htmlFor="task-hours">
                  <div className="relative flex">
                    <LeadIcon><Clock3 className="h-4 w-4" /></LeadIcon>
                    <input id="task-hours" {...register("estimatedHours")} type="number" step="0.1" min="0" inputMode="decimal" placeholder="8" className={cn(inputClass(errors.estimatedHours?.message), withIcon, "rounded-r-none")} />
                    <span className="flex h-11 shrink-0 items-center rounded-r-xl border border-l-0 border-border/70 bg-secondary/40 px-3 text-[13px] text-muted-foreground font-medium">hours</span>
                  </div>
                </Field>
              </div>
            </SectionCard>

            {/* Section 3 — Schedule */}
            <SectionCard title="Schedule">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Due Date" error={errors.due?.message} required htmlFor="task-due">
                  <div className="relative">
                    <LeadIcon><CalendarDays className="h-4 w-4" /></LeadIcon>
                    <input id="task-due" {...register("due")} type="date" min={mode === "create" ? todayLocalISO() : undefined} className={cn(inputClass(errors.due?.message), withIcon)} />
                  </div>
                </Field>

                <Field label={`Progress — ${progress}%`} error={errors.progress?.message}>
                  <div className="flex flex-col gap-3 pt-1">
                    <input
                      type="range" min={0} max={100} step={5} value={progress}
                      aria-label="Progress"
                      onChange={(e) => setValue("progress", Number(e.target.value), { shouldValidate: true })}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      {[0, 25, 50, 75, 100].map((v) => <span key={v}>{v}%</span>)}
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </Field>
              </div>
            </SectionCard>

            {/* Section 4 — Description */}
            <SectionCard title="Description">
              <Field label="Task Description" htmlFor="task-description">
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <textarea
                    id="task-description"
                    {...register("description")}
                    rows={7}
                    placeholder="Describe the task in detail. Include context, requirements, and acceptance criteria..."
                    className="w-full rounded-xl border border-border/70 bg-white pl-10 pr-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none resize-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/10 hover:border-border"
                  />
                </div>
              </Field>
            </SectionCard>

            {/* Section 5 — Attachments (create only; uploaded to the new task after it is saved) */}
            {mode === "create" && (
              <SectionCard title="Attachments" subtitle="Files are uploaded right after the task is created.">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInput.current?.click()}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-slate-50/40 py-10 text-center hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-border/60 shadow-sm mb-3 group-hover:border-primary/40 transition-colors">
                    <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-[13px] font-semibold text-foreground">Drag files here</p>
                  <p className="text-[12px] text-muted-foreground mt-1">or <span className="text-primary underline cursor-pointer">Browse Files</span></p>
                  <p className="text-[11px] text-muted-foreground/60 mt-2">Max 10 MB · {ATTACHMENT_ALLOWED_EXTENSIONS.map((x) => x.slice(1).toUpperCase()).join(", ")}</p>
                  <input ref={fileInput} type="file" multiple className="sr-only" accept={ATTACHMENT_ALLOWED_EXTENSIONS.join(",")} onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
                </div>
                {fileErrors.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {fileErrors.map((e, i) => <li key={i} className="flex items-start gap-1 text-[11px] text-red-500"><AlertCircle className="mt-px h-3 w-3 shrink-0" />{e}</li>)}
                  </ul>
                )}
                {files.length > 0 && (
                  <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-border/70 bg-white px-3 py-2 text-[12px]">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                        <span className="shrink-0 text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                        <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground" disabled={busy}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            )}
          </div>

          {mode === "create" && (
            <div className="hidden xl:block">
              <TaskPreview {...watched} />
            </div>
          )}
        </div>
      </form>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-white/95 backdrop-blur-sm px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="h-11 px-6 rounded-xl text-[13px]">Cancel</Button>
          <Button type="button" disabled={busy || noProjects} onClick={() => void submit()} className="h-11 min-w-[160px] gap-2 rounded-xl text-[13px] shadow-sm">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{pendingLabel}</> : <><ClipboardList className="h-4 w-4" />{submitLabel}</>}
          </Button>
        </div>
      </div>
    </>
  );
}
