import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { ArrowLeft, Calendar, CheckCircle2, IndianRupee, Users, CircleDashed, Trash2, AlertTriangle, RefreshCcw, Loader2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useArchiveProject, useProject, useProjectMembers, useProjectWorkItems, useRemoveMember,
} from "@/features/projects/hooks/use-projects";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import {
  labelFor, projectClientId, projectClientName,
  PROJECT_PRIORITY_LABELS, PROJECT_ROLE_LABELS, PROJECT_STATUS_LABELS,
  type ProjectMemberBackend,
} from "@/api/projects.api";

const WORK_ITEM_STATUS_LABELS: Record<string, string> = {
  TODO: "Todo", IN_PROGRESS: "In Progress", IN_REVIEW: "Review", COMPLETED: "Completed", BLOCKED: "Blocked", CANCELLED: "Cancelled",
};

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

function formatDate(value?: string | null) {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!m) return value || "—";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ProjectDetailsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const { data: project, isLoading: loadingProject, isError, error, refetch, isFetching } = useProject(projectId);
  const membersQuery = useProjectMembers(project ? projectId : undefined);
  const workItemsQuery = useProjectWorkItems(project ? projectId : undefined);
  const members = membersQuery.data ?? [];
  const workItems = workItemsQuery.data ?? [];

  const removeMemberMutation = useRemoveMember();
  const archiveMutation = useArchiveProject();

  const [activeTab, setActiveTab] = useState("Overview");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMemberBackend | null>(null);

  if (loadingProject) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6 max-w-[1200px] mx-auto">
          <div className="h-4 w-24 rounded bg-secondary/60" />
          <div className="h-32 rounded-2xl bg-secondary/60" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 h-64 rounded-2xl bg-secondary/60" />
            <div className="h-64 rounded-2xl bg-secondary/60" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError || !project) {
    const status = (error as { status?: number | null } | null)?.status;
    const notFound = status === 404 || !isError;
    return (
      <AppLayout>
        <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
          <h2 className="text-[18px] font-semibold text-foreground">{notFound ? "Project not found" : status === 403 ? "Access denied" : "Unable to load project"}</h2>
          <p className="max-w-sm text-[13px] text-muted-foreground">
            {notFound
              ? "It may not exist, or it was archived (the API hides archived projects)."
              : extractApiErrorMessage(error, "Please try again.").message}
          </p>
          {!notFound && status !== 403 && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Link to="/projects" className="text-[13px] text-primary hover:underline">Return to projects</Link>
        </div>
      </AppLayout>
    );
  }

  const clientName = projectClientName(project);
  const clientId = projectClientId(project);
  const tabs = ["Overview", "Members", "Tasks", "Activity"];
  const budget = project.budget === null || project.budget === undefined || project.budget === ""
    ? null
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(project.budget));
  const memberCount = membersQuery.data ? members.length : project.members?.length ?? 0;

  return (
    <AppLayout>
      <div className="mb-8 max-w-[1200px] mx-auto">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <h1 className="text-[28px] font-semibold tracking-tight text-foreground leading-none break-words">{project.project_name}</h1>
              <StatusBadge status={labelFor(PROJECT_STATUS_LABELS, project.status)} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground mt-2">
              {clientId && clientId !== "undefined" ? (
                <Link to={`/clients/${clientId}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium text-primary">
                  {clientName}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{clientName}</span>
              )}
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Due {formatDate(project.deadline)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" className="h-[34px] text-[13px]" onClick={() => navigate(`/projects/${project.id}/edit`)}>Edit Details</Button>
            <Button size="sm" variant="outline" className="h-[34px] gap-1.5 text-[13px] text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" onClick={() => setConfirmArchive(true)} disabled={archiveMutation.isPending}>
              {archiveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />} Archive Project
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6 border-b border-border/50 max-w-[1200px] mx-auto overflow-x-auto hide-scrollbar">
        <nav className="-mb-px flex space-x-6 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "whitespace-nowrap border-b-2 py-3 text-[13px] font-medium transition-colors",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="max-w-[1200px] mx-auto pb-12">
        {activeTab === "Overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <IndianRupee className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-[14px] font-semibold text-foreground">Budget</h3>
                  </div>
                  <p className="text-[24px] font-semibold text-foreground mt-2">{budget ?? "—"}</p>
                  {budget === null && <p className="text-[11px] text-muted-foreground">Not set</p>}
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-[12px] font-medium text-muted-foreground mb-1">Progress</p>
                  <p className="text-[20px] font-semibold text-foreground">{project.progress}%</p>
                  <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }} />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col justify-center">
                  <p className="text-[12px] font-medium text-muted-foreground mb-1">Team Members</p>
                  <p className="text-[20px] font-semibold text-foreground">{memberCount}</p>
                </div>
              </div>

              <section className="rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between p-5 border-b border-border/50">
                  <h3 className="text-[14px] font-semibold text-foreground">Description</h3>
                </div>
                <div className="p-5 text-[14px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {project.description || "No description provided."}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-[14px] font-semibold text-foreground mb-4">Project Info</h3>
                <div className="space-y-4 text-[13px]">
                  {[
                    ["Client", clientName],
                    ["Start Date", formatDate(project.start_date)],
                    ["Deadline", formatDate(project.deadline)],
                    ["Priority", labelFor(PROJECT_PRIORITY_LABELS, project.priority)],
                    ["Project Manager", project.project_manager?.name || "Not assigned"],
                    ["Created By", project.created_by_name || "—"],
                    ["Created", formatDateTime(project.created_at)],
                    ["Last Updated", formatDateTime(project.updated_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "Members" && (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border/50">
              <h3 className="text-[14px] font-semibold text-foreground">Team Members</h3>
              <Button size="sm" onClick={() => navigate(`/projects/${project.id}/edit`)} className="h-8 gap-1.5 text-xs">Assign Member</Button>
            </div>

            {membersQuery.isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading members...</div>
            ) : membersQuery.isError ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <p className="text-sm font-medium text-foreground">Unable to load members</p>
                <p className="text-xs text-muted-foreground">{extractApiErrorMessage(membersQuery.error).message}</p>
                <Button size="sm" variant="outline" className="mt-1 h-8 text-xs" onClick={() => void membersQuery.refetch()}>Retry</Button>
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">No team members assigned.</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Assign your first employee to this project.</p>
                <Button size="sm" onClick={() => navigate(`/projects/${project.id}/edit`)}>Assign Employee</Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {members.map(member => (
                  <div key={member.id} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/40 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[12px] font-bold text-foreground shadow-sm overflow-hidden">
                        {getInitials(member.employee_name)}
                      </div>
                      <div className="min-w-0">
                        <Link to={`/employees/${member.employee}`} className="font-medium text-[14px] text-foreground hover:underline">
                          {member.employee_name || "Unknown Member"}
                        </Link>
                        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                          {labelFor(PROJECT_ROLE_LABELS, member.role_in_project)}
                          {member.employee_designation ? ` · ${member.employee_designation}` : ""}
                          {member.joined_at ? ` · since ${formatDate(member.joined_at)}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      aria-label={`Remove ${member.employee_name || "member"}`}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setMemberToRemove(member)}
                      disabled={removeMemberMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "Tasks" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h3 className="text-[14px] font-semibold text-foreground">
                  Project Tasks {workItemsQuery.data ? `(${workItems.length})` : ""}
                </h3>
                <Button size="sm" onClick={() => navigate(`/tasks/new?project=${project.id}`)} className="h-8 gap-1.5 text-xs">New Task</Button>
              </div>
              {workItemsQuery.isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading tasks...</div>
              ) : workItemsQuery.isError ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <p className="text-sm font-medium text-foreground">Unable to load tasks</p>
                  <p className="text-xs text-muted-foreground">{extractApiErrorMessage(workItemsQuery.error).message}</p>
                  <Button size="sm" variant="outline" className="mt-1 h-8 text-xs" onClick={() => void workItemsQuery.refetch()}>Retry</Button>
                </div>
              ) : workItems.length === 0 ? (
                <div className="flex h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
                  No tasks created for this project yet.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {workItems.map((t) => (
                    <Link key={t.id} to={`/tasks/${t.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        {t.status === "COMPLETED" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {t.assigned_to_name || "Unassigned"} · Due {formatDate(t.due_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {t.progress !== undefined && <span className="text-[11px] font-medium text-muted-foreground">{t.progress}%</span>}
                        <StatusBadge status={WORK_ITEM_STATUS_LABELS[t.status] || t.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "Activity" && (
          <div className="space-y-4">
            <DataSourceNotice kind="pending">
              The backend does not expose a project activity log yet. Created and last-updated times are on the Overview tab.
            </DataSourceNotice>
            <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-border bg-card text-sm text-muted-foreground">
              Not connected yet.
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title={`Archive ${project.project_name}?`}
        description={
          <>
            <p>The project is not permanently deleted. Its status is set to <strong>Cancelled</strong>, and the API then hides it from project lists, this page and the employee portal.</p>
            <p>Its {memberCount} team membership{memberCount === 1 ? "" : "s"} and its work items stay in the database. This app cannot restore archived projects.</p>
          </>
        }
        confirmLabel="Archive"
        pendingLabel="Archiving..."
        pending={archiveMutation.isPending}
        onConfirm={() =>
          archiveMutation.mutate(project.id, {
            onSuccess: () => navigate("/projects"),
            onSettled: () => setConfirmArchive(false),
          })
        }
        onCancel={() => setConfirmArchive(false)}
      />

      <ConfirmDialog
        open={!!memberToRemove}
        title={`Remove ${memberToRemove?.employee_name || "this member"} from the project?`}
        description={<p>The membership is deleted and the employee loses access to this project in the employee portal. The employee record itself is not changed.</p>}
        confirmLabel="Remove"
        pendingLabel="Removing..."
        pending={removeMemberMutation.isPending}
        onConfirm={() =>
          memberToRemove &&
          removeMemberMutation.mutate(
            { projectId: project.id, memberId: memberToRemove.id },
            { onSettled: () => setMemberToRemove(null) },
          )
        }
        onCancel={() => setMemberToRemove(null)}
      />
    </AppLayout>
  );
}
