import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, FolderKanban, Flag, CheckCircle2, CircleDashed, Pencil, Archive,
  MessageSquare, Paperclip, History, FileText, CalendarDays, Clock3,
  UserRound, AlertTriangle, RefreshCcw, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTask, useUpdateTaskStatus, useArchiveTask } from "@/features/tasks/hooks/use-tasks";
import { TaskComments } from "@/features/tasks/components/task-comments";
import { TaskAttachments } from "@/features/tasks/components/task-attachments";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";

/* ─── Config ─────────────────────────────────────────── */
const PRIORITY_CONFIG = {
  URGENT: { cls: "bg-red-50 text-red-700 ring-red-500/20",      dot: "bg-red-500",    label: "Urgent" },
  HIGH:   { cls: "bg-orange-50 text-orange-700 ring-orange-500/20", dot: "bg-orange-500", label: "High" },
  MEDIUM: { cls: "bg-amber-50 text-amber-700 ring-amber-500/20", dot: "bg-amber-400", label: "Medium" },
  LOW:    { cls: "bg-blue-50 text-blue-700 ring-blue-500/20",   dot: "bg-blue-400",   label: "Low" },
} as Record<string, { cls: string; dot: string; label: string }>;

const STATUS_CONFIG = {
  "TODO":        { cls: "bg-slate-100 text-slate-600",     dot: "bg-slate-400",    label: "To Do" },
  "IN_PROGRESS": { cls: "bg-blue-50 text-blue-700",        dot: "bg-blue-500",     label: "In Progress" },
  "IN_REVIEW":   { cls: "bg-amber-50 text-amber-700",      dot: "bg-amber-500",    label: "In Review" },
  "COMPLETED":   { cls: "bg-emerald-50 text-emerald-700",  dot: "bg-emerald-500",  label: "Completed" },
  "BLOCKED":     { cls: "bg-red-50 text-red-700",          dot: "bg-red-500",      label: "Blocked" },
  "CANCELLED":   { cls: "bg-slate-100 text-slate-500",     dot: "bg-slate-300",    label: "Cancelled" },
} as Record<string, { cls: string; dot: string; label: string }>;

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || { cls: "bg-secondary text-foreground ring-border", dot: "bg-slate-400", label: priority };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset", cfg.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />{cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { cls: "bg-secondary text-foreground", dot: "bg-slate-400", label: status };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold", cfg.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />{cfg.label}
    </span>
  );
}

/** YYYY-MM-DD as a local calendar date (new Date("YYYY-MM-DD") is UTC). */
function parseLocalDate(value?: string | null) {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function formatDue(due?: string, closed?: boolean) {
  const d = parseLocalDate(due);
  if (!d) return { label: "No due date", color: "text-foreground" };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  const full = d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  if (!closed && diff < 0) return { label: `${full} · ${Math.abs(diff)}d overdue`, color: "text-red-600 font-semibold" };
  if (!closed && diff === 0) return { label: `${full} · Today`, color: "text-amber-600 font-semibold" };
  if (!closed && diff === 1) return { label: `${full} · Tomorrow`, color: "text-amber-500" };
  return { label: full, color: "text-foreground" };
}

function formatDateTime(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function InfoRow({ icon, label, value, className }: { icon: React.ReactNode; label: string; value?: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-border/40 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
        <div className={cn("mt-0.5 text-[13px] font-medium text-foreground", className)}>{value || "—"}</div>
      </div>
    </div>
  );
}

/* ─── Tabs ───────────────────────────────────────────── */
const TABS = ["Overview", "Comments", "Attachments", "Activity"] as const;
type Tab = typeof TABS[number];

/* ─── Main ───────────────────────────────────────────── */
export default function TaskDetailPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const { data: task, isLoading, isError, error, refetch, isFetching } = useTask(taskId);
  const updateStatusMutation = useUpdateTaskStatus();
  const archiveMutation = useArchiveTask();

  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6 max-w-[1000px] mx-auto">
          <div className="h-4 w-24 rounded bg-secondary/60" />
          <div className="h-48 rounded-2xl bg-secondary/60" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !task) {
    const status = (error as { status?: number | null } | null)?.status;
    const notFound = status === 404 || !isError;
    return (
      <AppLayout>
        <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
          <h2 className="text-[18px] font-semibold">{notFound ? "Task not found" : status === 403 ? "Access denied" : "Unable to load task"}</h2>
          {!notFound && <p className="max-w-sm text-[13px] text-muted-foreground">{extractApiErrorMessage(error, "Please try again.").message}</p>}
          {!notFound && status !== 403 && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Link to="/tasks" className="text-sm text-primary hover:underline">Return to Tasks</Link>
        </div>
      </AppLayout>
    );
  }

  const isCompleted = task.status === "COMPLETED";
  const isArchived = task.status === "CANCELLED";
  const due = formatDue(task.due_date, isCompleted || isArchived);
  const progress = Math.max(0, Math.min(100, task.progress ?? 0));
  const projectName = task.project_name || `Project #${task.project}`;
  const assigneeName = task.assigned_to_name || "Unassigned";
  const assigneeInitials = assigneeName !== "Unassigned" ? assigneeName.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() : "U";

  const handleStatusToggle = () => {
    // PATCH update_status: COMPLETED also sets progress 100 + completed_at; reopening keeps progress as-is.
    updateStatusMutation.mutate({ id: task.id, status: isCompleted ? "IN_PROGRESS" : "COMPLETED" });
  };

  const timeline = [
    { label: "Task created", at: task.created_at, by: task.created_by_name, dot: "bg-blue-500" },
    { label: "Work started", at: task.started_at, dot: "bg-amber-500" },
    { label: "Marked completed", at: task.completed_at, dot: "bg-emerald-500" },
    { label: "Last updated", at: task.updated_at, dot: "bg-slate-400" },
  ].filter((e) => e.at);

  return (
    <AppLayout>
      <Link to="/tasks" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </Link>

      {isArchived && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          <Archive className="mt-0.5 h-4 w-4 shrink-0" />
          This task is archived (Cancelled). It is hidden from task lists and the employee portal.
        </div>
      )}

      {/* Hero Card */}
      <div className="mb-6 rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
        <div className="h-2 w-full bg-secondary">
          <div className={cn("h-full rounded-none", STATUS_CONFIG[task.status]?.dot || "bg-primary")} style={{ width: `${progress}%` }} />
        </div>
        <div className="px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
              </div>
              <h1 className={cn("text-2xl font-bold text-foreground break-words", isCompleted && "line-through opacity-60")}>
                {task.title}
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <FolderKanban className="h-4 w-4" />
                <Link to={`/projects/${task.project}`} className="hover:text-primary transition-colors">{projectName}</Link>
              </p>
            </div>

            {!isArchived && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl text-[13px]" onClick={() => navigate(`/tasks/${task.id}/edit`)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                {!isCompleted ? (
                  <Button size="sm" className="h-9 gap-2 rounded-xl text-[13px]" onClick={handleStatusToggle} disabled={updateStatusMutation.isPending}>
                    {updateStatusMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Mark Complete
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-9 gap-2 rounded-xl text-[13px]" onClick={handleStatusToggle} disabled={updateStatusMutation.isPending}>
                    {updateStatusMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleDashed className="h-3.5 w-3.5" />} Reopen
                  </Button>
                )}
                <Button size="sm" variant="outline" aria-label="Archive task" title="Archive task" className="h-9 gap-2 rounded-xl text-[13px] text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmArchive(true)}>
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-[12px] font-medium mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className={cn(progress === 100 ? "text-emerald-600" : "text-foreground")}>{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex max-w-full gap-1 overflow-x-auto rounded-full bg-card p-1 shadow-sm w-fit hide-scrollbar">
        {TABS.map((tab) => {
          const icons: Record<Tab, React.ReactNode> = {
            Overview:    <FileText className="h-3.5 w-3.5" />,
            Comments:    <MessageSquare className="h-3.5 w-3.5" />,
            Attachments: <Paperclip className="h-3.5 w-3.5" />,
            Activity:    <History className="h-3.5 w-3.5" />,
          };
          const count = tab === "Comments" ? task.comments?.length : tab === "Attachments" ? task.attachments?.length : undefined;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-all whitespace-nowrap",
                activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}>
              {icons[tab]}{tab}
              {count !== undefined && count > 0 && (
                <span className={cn("ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px]", activeTab === tab ? "bg-primary-foreground/20" : "bg-secondary")}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50"><h3 className="text-[14px] font-semibold">Task Details</h3></div>
            <div className="px-5">
              <InfoRow icon={<FolderKanban className="h-4 w-4" />} label="Project"  value={<Link to={`/projects/${task.project}`} className="hover:text-primary">{projectName}</Link>} />
              <InfoRow icon={<Flag className="h-4 w-4" />}         label="Priority" value={<PriorityBadge priority={task.priority} />} />
              <InfoRow icon={<UserRound className="h-4 w-4" />}    label="Assignee" value={
                task.assigned_to ? (
                  <Link to={`/employees/${task.assigned_to}`} className="flex items-center gap-2 hover:text-primary">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white">{assigneeInitials}</div>
                    <span>{assigneeName}{task.assigned_to_designation ? <span className="text-muted-foreground font-normal"> · {task.assigned_to_designation}</span> : null}</span>
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )
              } />
              <InfoRow icon={<UserRound className="h-4 w-4" />} label="Created By" value={task.created_by_name} />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50"><h3 className="text-[14px] font-semibold">Schedule</h3></div>
            <div className="px-5">
              <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Due Date" value={<span className={due.color}>{due.label}</span>} />
              <InfoRow icon={<Clock3 className="h-4 w-4" />}       label="Estimated Time" value={task.estimated_hours !== null && task.estimated_hours !== undefined && task.estimated_hours !== "" ? `${task.estimated_hours}h` : "—"} />
              <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Created" value={formatDateTime(task.created_at)} />
              <InfoRow icon={<History className="h-4 w-4" />} label="Last Updated" value={formatDateTime(task.updated_at)} />
            </div>
          </div>

          {/* Description */}
          <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-border/50"><h3 className="text-[14px] font-semibold">Description</h3></div>
            <div className="px-5 py-5">
              <p className="text-[14px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {task.description || "No description provided."}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Comments" && (
        <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border/50">
            <h3 className="text-[14px] font-semibold">Comments</h3>
          </div>
          <div className="px-6 py-5">
            <TaskComments taskId={task.id} />
          </div>
        </div>
      )}

      {activeTab === "Attachments" && (
        <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">Attachments</h3>
          </div>
          <div className="px-6 py-5">
            <TaskAttachments taskId={task.id} />
          </div>
        </div>
      )}

      {activeTab === "Activity" && (
        <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border/50">
            <h3 className="text-[14px] font-semibold">Activity Timeline</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Built from the task's recorded timestamps. The backend does not keep a full change history.</p>
          </div>
          <div className="px-6 py-5 space-y-5">
            {timeline.map((e, i) => (
              <div key={e.label} className="flex gap-4 relative">
                {i !== timeline.length - 1 && <div className="absolute left-[11px] top-[24px] bottom-[-20px] w-[2px] bg-border/50" />}
                <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-white">
                  <div className={cn("h-2 w-2 rounded-full", e.dot)} />
                </div>
                <div className="flex flex-col pt-0.5">
                  <span className="text-[13px] font-semibold text-foreground">{e.label}</span>
                  <span className="text-[12px] font-medium text-muted-foreground mt-0.5">{formatDateTime(e.at)}{e.by ? ` · by ${e.by}` : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmArchive}
        title={`Archive "${task.title}"?`}
        description={
          <>
            <p>The task is not permanently deleted. Its status is set to <strong>Cancelled</strong>, and it disappears from task lists, the project's task tab and the assignee's portal.</p>
            <p>Its comments and attachments are kept. This app cannot restore archived tasks, though the record stays reachable at its own address.</p>
          </>
        }
        confirmLabel="Archive"
        pendingLabel="Archiving..."
        pending={archiveMutation.isPending}
        onConfirm={() =>
          archiveMutation.mutate(task.id, {
            onSuccess: () => navigate("/tasks"),
            onSettled: () => setConfirmArchive(false),
          })
        }
        onCancel={() => setConfirmArchive(false)}
      />
    </AppLayout>
  );
}
