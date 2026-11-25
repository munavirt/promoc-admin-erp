import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import {
  projectClientId, projectClientName,
  type ProjectBackend, type ProjectMemberBackend, type UpdateProjectPayload,
} from "@/api/projects.api";
import { invalidateProjectData, useProject, useProjectMembers, useRemoveMember, useUpdateProject } from "../hooks/use-projects";
import { ProjectForm, applyProjectFieldErrors, toProjectPayload, type ProjectFormValues, type NewMember } from "../components/project-form";
import { assignMembersSequentially, describeFailures } from "../lib/assign-members";
import { getEmployeeLabelMap } from "../lib/employee-labels";

function toFormValues(p: ProjectBackend, newMembers: NewMember[] = []): ProjectFormValues {
  return {
    project_name: p.project_name || "",
    client: projectClientId(p),
    description: p.description || "",
    priority: (p.priority as ProjectFormValues["priority"]) || "MEDIUM",
    status: (p.status as ProjectFormValues["status"]) || "PLANNING",
    budget: p.budget === null || p.budget === undefined ? "" : String(p.budget),
    progress: String(p.progress ?? 0),
    start_date: p.start_date || "",
    deadline: p.deadline || "",
    newMembers,
  };
}

export function EditProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: project, isLoading, isError, error, refetch, isFetching } = useProject(projectId);
  const { data: existingMembers = [], isLoading: loadingMembers } = useProjectMembers(projectId);
  const updateMutation = useUpdateProject();
  const removeMutation = useRemoveMember();

  const [retryMembers, setRetryMembers] = useState<NewMember[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMemberBackend | null>(null);

  // Form defaults come from a snapshot that only changes when this page saves — background refetches
  // (e.g. after removing a member) must not wipe unsaved edits.
  const [snapshot, setSnapshot] = useState<ProjectBackend | null>(null);
  useEffect(() => {
    if (project && (!snapshot || String(snapshot.id) !== String(project.id))) setSnapshot(project);
  }, [project, snapshot]);
  const defaults = useMemo(() => (snapshot ? toFormValues(snapshot, retryMembers ?? []) : null), [snapshot, retryMembers]);

  const handleSubmit: React.ComponentProps<typeof ProjectForm>["onSubmit"] = async (values, { setError }) => {
    if (!project || !defaults) return;
    setSaving(true);
    try {
      // 1. PATCH only fields that changed. `client` is sent only if changed: ProjectSerializer only
      //    accepts ACTIVE clients, so re-sending an inactive current client would be rejected.
      const next = toProjectPayload(values);
      const prev = toProjectPayload({ ...defaults, newMembers: [] });
      const payload: UpdateProjectPayload = {};
      (Object.keys(next) as (keyof typeof next)[]).forEach((key) => {
        if (String(next[key] ?? "") !== String(prev[key] ?? "")) (payload as Record<string, unknown>)[key] = next[key];
      });
      let saved: ProjectBackend | null = null;
      if (Object.keys(payload).length > 0) {
        try {
          saved = await updateMutation.mutateAsync({ id: project.id, data: payload });
        } catch (err) {
          applyProjectFieldErrors(err, setError);
          return;
        }
      }

      // 2. Members — separate endpoint, one request each.
      if (values.newMembers.length > 0) {
        const labels = getEmployeeLabelMap(queryClient);
        const { failed } = await assignMembersSequentially(
          project.id,
          values.newMembers.map((m) => ({ ...m, label: labels.get(m.employee) })),
        );
        invalidateProjectData(queryClient, project.id);
        if (failed.length) {
          // Keep only the rows that failed so they can be fixed and retried; other fields show the saved values.
          if (saved) setSnapshot(saved);
          setRetryMembers(failed.map((f) => ({ employee: f.member.employee, role_in_project: f.member.role_in_project })));
          toast.error(
            `${Object.keys(payload).length ? "Project details saved, but " : ""}${failed.length} team member${failed.length === 1 ? "" : "s"} could not be added. ${describeFailures(failed)}`,
            { duration: 12000 },
          );
          return;
        }
      }

      if (Object.keys(payload).length === 0 && values.newMembers.length === 0) {
        toast.info("No changes to save.");
      } else {
        toast.success("Project updated successfully.");
      }
      setRetryMembers(null);
      navigate(`/projects/${project.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || (project && !defaults)) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-24 rounded bg-secondary/60" />
          <div className="h-10 w-64 rounded bg-secondary/60" />
          <div className="h-64 rounded-2xl bg-secondary/60" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !project || !defaults) {
    const status = (error as { status?: number | null } | null)?.status;
    const notFound = status === 404 || !isError;
    return (
      <AppLayout>
        <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
          <h2 className="text-[18px] font-semibold text-foreground">{notFound ? "Project not found" : status === 403 ? "Access denied" : "Unable to load project"}</h2>
          <p className="max-w-sm text-[13px] text-muted-foreground">
            {notFound ? "It may not exist, or it was archived (the API hides archived projects)." : extractApiErrorMessage(error, "Please try again.").message}
          </p>
          {!notFound && status !== 403 && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Link to="/projects" className="text-sm text-primary hover:underline">Return to Projects</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Project
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update details for {project.project_name}.</p>
      </div>

      <ProjectForm
        mode="edit"
        defaultValues={defaults}
        currentClient={{ id: projectClientId(project), name: projectClientName(project) }}
        existingMembers={existingMembers}
        membersLoading={loadingMembers}
        onRemoveMember={setMemberToRemove}
        removingMemberId={removeMutation.isPending ? removeMutation.variables?.memberId ?? null : null}
        submitLabel="Save Changes"
        pendingLabel="Saving..."
        isPending={saving}
        onCancel={() => navigate(`/projects/${project.id}`)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!memberToRemove}
        title={`Remove ${memberToRemove?.employee_name || "this member"} from the project?`}
        description={<p>This removes the membership right away (it is not part of Save). The employee loses access to this project in the employee portal. The employee record itself is not changed.</p>}
        confirmLabel="Remove"
        pendingLabel="Removing..."
        pending={removeMutation.isPending}
        onConfirm={() =>
          memberToRemove &&
          removeMutation.mutate(
            { projectId: project.id, memberId: memberToRemove.id },
            { onSettled: () => setMemberToRemove(null) },
          )
        }
        onCancel={() => setMemberToRemove(null)}
      />
    </AppLayout>
  );
}
